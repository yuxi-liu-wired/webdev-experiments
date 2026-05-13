#!/usr/bin/env bun
// Scrape UC Berkeley library hours and build a static interactive page.
//
// Usage:
//   bun build.ts fetch    - scrape lib.berkeley.edu/hours and write data.json + index.html
//   bun build.ts rebuild  - rebuild index.html from cached data.json (no network)
//   bun build.ts serve    - serve index.html on http://localhost:8765 (re-reads on each request)
//   bun build.ts all      - fetch + serve

const START = "2026-05-01";
const END   = "2026-08-31";
const CONCURRENCY = 10;
const OUT_JSON = "data.json";
const OUT_HTML = "index.html";
const PORT = 8765;

function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function decode(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&quot;/g, '"');
}

async function fetchDate(date: string): Promise<Record<string, string>> {
  const url = `https://www.lib.berkeley.edu/hours?date=${date}&library_select=0&hours_date_select=${date}&nid=`;
  const r = await fetch(url);
  const html = await r.text();
  const result: Record<string, string> = {};
  const re = /<h3 class="library-name"><a [^>]*>([^<]+)<\/a>[\s\S]*?<p class="library-hours">([\s\S]*?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const name = decode(m[1].trim());
    const hours = decode(m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()) || "";
    result[name] = hours;
  }
  return result;
}

async function fetchAll(): Promise<Record<string, Record<string, string>>> {
  const dates = dateRange(START, END);
  const data: Record<string, Record<string, string>> = {};
  for (let i = 0; i < dates.length; i += CONCURRENCY) {
    const batch = dates.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(fetchDate));
    batch.forEach((d, j) => { data[d] = results[j]; });
    console.error(`fetched ${Math.min(i + CONCURRENCY, dates.length)}/${dates.length}`);
  }
  return data;
}

function buildHTML(data: Record<string, Record<string, string>>): string {
  const libraries = [...new Set(Object.values(data).flatMap(d => Object.keys(d)))].sort();
  const dates = Object.keys(data).sort();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>UC Berkeley Library Hours</title>
<style>
  body { font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; margin: 0; background: #fafafa; color: #222; }
  header { padding: 12px 16px; background: #003262; color: #fff; position: sticky; top: 0; z-index: 10; }
  header h1 { margin: 0 0 8px 0; font-size: 16px; font-weight: 600; }
  header h1 a { color: #fdb515; text-decoration: none; }
  .controls { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; font-size: 12px; }
  .controls label { display: flex; gap: 4px; align-items: center; }
  .controls input[type=text], .controls input[type=date] { padding: 3px 6px; font: inherit; border: 0; border-radius: 3px; }
  .controls button { padding: 3px 8px; font: inherit; border: 0; border-radius: 3px; background: #fdb515; color: #003262; cursor: pointer; }
  .libs { padding: 8px 16px; background: #fff; border-bottom: 1px solid #ddd; max-height: 140px; overflow-y: auto; font-size: 11px; }
  .libs label { display: inline-block; margin: 2px 8px 2px 0; white-space: nowrap; }
  .libs button { margin-right: 8px; font-size: 11px; padding: 2px 6px; border: 1px solid #ccc; background: #f0f0f0; cursor: pointer; }
  .wrap { overflow: auto; max-height: calc(100vh - 220px); }
  table { border-collapse: collapse; width: max-content; background: #fff; }
  th, td { padding: 3px 6px; border: 1px solid #e0e0e0; text-align: left; white-space: nowrap; font-variant-numeric: tabular-nums; }
  thead th { position: sticky; top: 0; background: #f0f0f0; z-index: 2; font-weight: 600; font-size: 11px; }
  thead th:not(:first-child), tbody td { width: 12ch; max-width: 12ch; min-width: 12ch; box-sizing: content-box; overflow: hidden; text-overflow: clip; }
  tbody th.date { position: sticky; left: 0; background: #f8f8f8; font-weight: 500; z-index: 1; min-width: 50px; }
  tbody th.date.weekend { background: #fff5e6; }
  tbody th.date.holiday { background: #ffd0d0; }
  tr.month-row th { background: #003262; color: #fff; font-weight: 700; text-align: left; padding: 4px 8px; font-size: 12px; position: sticky; left: 0; z-index: 1; }
  td.closed { background: #ebebeb; color: transparent; }
  td.h24 { background: #d4f4d4; font-weight: 600; }
  td.extended { background: #d4e8f8; }
  td .half { font-size: 0.65em; vertical-align: super; opacity: 0.6; margin-left: 1px; }
  tr.today th.date { background: #fdb515 !important; color: #003262; font-weight: 700; box-shadow: inset 3px 0 0 #003262; }
  tr.today td:not(.closed) { background: #fff5cc; }
  tr.today td.closed { background: #e6dba0; }
  tr:hover td:not(.closed), tr:hover th { background: #fffce0 !important; }
  .meta { padding: 4px 16px; font-size: 11px; color: #666; background: #fff; border-bottom: 1px solid #eee; }
  .data-banner { padding: 4px 16px; background: #fef6d8; border-bottom: 1px solid #fdb515; font-size: 11px; color: #222; display: flex; align-items: center; gap: 8px; }
  .data-banner a.dl { background: #003262; color: #fdb515; padding: 2px 6px; border-radius: 2px; text-decoration: none; font-weight: 600; font-size: 11px; }
  .data-banner a.dl:hover { background: #1a4b80; }
  .data-banner code { background: #fff; padding: 0 3px; border: 1px solid #ddd; border-radius: 2px; font-size: 10px; }
</style>
<link rel="alternate" type="application/json" href="./data.json" title="UC Berkeley library hours JSON">
<meta name="description" content="UC Berkeley library hours scraped from lib.berkeley.edu/hours for ${dates[0]} to ${dates[dates.length-1]}. Raw data: ./data.json">
</head>
<body>
<header>
  <h1>UC Berkeley Library Hours (${dates[0]} to ${dates[dates.length-1]}) <a href="https://www.lib.berkeley.edu/hours">[source]</a></h1>
  <div class="controls">
    <label>Search library: <input type="text" id="search" placeholder="doe, stacks, ..."></label>
    <label>From: <input type="date" id="from" value="${dates[0]}" min="${dates[0]}" max="${dates[dates.length-1]}"></label>
    <label>To: <input type="date" id="to" value="${dates[dates.length-1]}" min="${dates[0]}" max="${dates[dates.length-1]}"></label>
    <label><input type="checkbox" id="hideClosed"> hide always-closed libraries</label>
    <label><input type="checkbox" id="hideWeekend"> hide weekends</label>
  </div>
</header>
<div class="data-banner">
  <a class="dl" href="./data.json">⬇ data.json</a>
  <span style="color:#555;">${dates.length} dates × ${libraries.length} libraries. Schema in the <code>_meta</code> key.</span>
</div>
<div class="libs">
  <button id="selAll">all</button><button id="selNone">none</button><button id="selCore" title="Bioscience, CAP, Doe, East Asian, Math, Main Stacks, Morrison">mine</button>
  <span id="libChecks"></span>
</div>
<div class="meta" id="meta"></div>
<div class="wrap"><table id="tbl"></table></div>
<script>
const DATA = ${JSON.stringify(data)};
const LIBS = ${JSON.stringify(libraries)};
const DATES = ${JSON.stringify(dates)};
const CORE = new Set([
  "Bioscience, Natural Resources & Public Health Library",
  "Chemistry, Astronomy & Physics Library",
  "Doe Library",
  "East Asian Library",
  "Engineering & Mathematical Sciences Library",
  "Main (Gardner) Stacks",
  "Morrison Library"
]);
const HOLIDAYS_2026 = new Set(["2026-05-25","2026-07-03","2026-07-04"]);
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_ABBR = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function isWeekend(d) { const w = new Date(d+"T00:00:00Z").getUTCDay(); return w===0 || w===6; }
function pad2(n) { return n < 10 ? "0" + n : "" + n; }
const TODAY = (() => { const n = new Date(); return n.getFullYear() + "-" + pad2(n.getMonth()+1) + "-" + pad2(n.getDate()); })();

function to24(hStr, ampm) {
  let h = parseInt(hStr, 10);
  const p = ampm.toLowerCase() === "p";
  if (h === 12) h = p ? 12 : 0;
  else if (p) h += 12;
  return h;
}

function fmtPart(hour, min) {
  if (!min) return pad2(hour);
  if (min === "30") return pad2(hour) + '<span class="half">\\u00bd</span>';
  return pad2(hour) + ":" + min;
}

function fmtHours(h) {
  if (!h || h === "-" || h === "—" || /closed/i.test(h)) return { text: "", cls: "closed" };
  if (/24 hours/i.test(h)) return { text: "24h", cls: "h24" };
  if (/appointment/i.test(h)) return { text: "appt", cls: "" };
  const m = h.match(/(\\d+)(?::(\\d+))?\\s*(a|p)\\.m\\.\\s*[-\\u2013]\\s*(\\d+)(?::(\\d+))?\\s*(a|p)\\.m\\./i);
  if (m) {
    const h1 = to24(m[1], m[3]);
    const h2 = to24(m[4], m[6]);
    const cls = h2 >= 21 ? "extended" : "";
    return { text: fmtPart(h1, m[2]) + " \\u2013 " + fmtPart(h2, m[5]), cls };
  }
  return { text: h, cls: "" };
}

function classifyForFilter(h) {
  if (!h || h === "-" || h === "—" || /closed/i.test(h)) return "closed";
  return "open";
}

const libChecks = document.getElementById("libChecks");
const selected = new Set(LIBS);
LIBS.forEach(lib => {
  const lbl = document.createElement("label");
  lbl.innerHTML = '<input type="checkbox" checked data-lib="' + lib.replace(/"/g,"&quot;") + '"> ' + lib;
  libChecks.appendChild(lbl);
});
libChecks.addEventListener("change", e => {
  if (e.target.dataset.lib) {
    if (e.target.checked) selected.add(e.target.dataset.lib); else selected.delete(e.target.dataset.lib);
    render();
  }
});
document.getElementById("selAll").onclick = () => { selected.clear(); LIBS.forEach(l => selected.add(l)); syncChecks(); render(); };
document.getElementById("selNone").onclick = () => { selected.clear(); syncChecks(); render(); };
document.getElementById("selCore").onclick = () => { selected.clear(); LIBS.forEach(l => { if (CORE.has(l)) selected.add(l); }); syncChecks(); render(); };
function syncChecks() {
  libChecks.querySelectorAll("input").forEach(cb => { cb.checked = selected.has(cb.dataset.lib); });
}
["search","from","to","hideClosed","hideWeekend"].forEach(id => {
  document.getElementById(id).addEventListener("input", render);
});

function render() {
  const search = document.getElementById("search").value.toLowerCase();
  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;
  const hideClosed = document.getElementById("hideClosed").checked;
  const hideWeekend = document.getElementById("hideWeekend").checked;

  let visibleLibs = LIBS.filter(l => selected.has(l));
  if (search) visibleLibs = visibleLibs.filter(l => l.toLowerCase().includes(search));
  if (hideClosed) {
    visibleLibs = visibleLibs.filter(l => DATES.some(d => classifyForFilter((DATA[d]||{})[l]) === "open"));
  }

  let visibleDates = DATES.filter(d => d >= from && d <= to);
  if (hideWeekend) visibleDates = visibleDates.filter(d => !isWeekend(d));

  const tbl = document.getElementById("tbl");
  const ncols = visibleLibs.length + 1;
  let html = "<thead><tr><th></th>";
  visibleLibs.forEach(l => {
    let short = l.replace(/ Library$/, "").replace(/Main \\(Gardner\\) Stacks/,"Main Stacks");
    if (short.length > 12) short = short.slice(0, 11) + "\\u2026";
    html += "<th title=\\"" + l.replace(/"/g,"&quot;") + "\\">" + short + "</th>";
  });
  html += "</tr></thead><tbody>";

  let lastMonth = -1;
  visibleDates.forEach(d => {
    const dt = new Date(d+"T00:00:00Z");
    const mo = dt.getUTCMonth();
    const day = dt.getUTCDate();
    const dow = DAY_ABBR[dt.getUTCDay()];
    if (mo !== lastMonth) {
      html += "<tr class=\\"month-row\\"><th colspan=\\"" + ncols + "\\">" + MONTHS[mo] + "</th></tr>";
      lastMonth = mo;
    }
    const wknd = isWeekend(d);
    const hol = HOLIDAYS_2026.has(d);
    const cls = "date" + (hol ? " holiday" : wknd ? " weekend" : "");
    const trCls = d === TODAY ? " class=\\"today\\"" : "";
    html += "<tr" + trCls + "><th class=\\"" + cls + "\\">" + pad2(day) + " " + dow + "</th>";
    visibleLibs.forEach(l => {
      const h = (DATA[d]||{})[l] || "";
      const f = fmtHours(h);
      html += "<td class=\\"" + f.cls + "\\" title=\\"" + h.replace(/"/g,"&quot;") + "\\">" + f.text + "</td>";
    });
    html += "</tr>";
  });
  html += "</tbody>";
  tbl.innerHTML = html;
  document.getElementById("meta").textContent = visibleDates.length + " dates x " + visibleLibs.length + " libraries shown. Green=24h, blue=close at 21:00 or later, grey=closed. Hover a cell for the raw value.";
}
render();
const todayRow = document.querySelector("tr.today");
if (todayRow) todayRow.scrollIntoView({ block: "center" });
</script>
</body>
</html>`;
}

const action = process.argv[2] || "all";

function buildMeta(data: Record<string, Record<string, string>>) {
  const dates = Object.keys(data).sort();
  return {
    description: "UC Berkeley library opening hours, one entry per date in the configured range.",
    source: "https://www.lib.berkeley.edu/hours?date=YYYY-MM-DD&library_select=0&hours_date_select=YYYY-MM-DD",
    schema: { "YYYY-MM-DD": { "Library Name": "raw hours string (verbatim from source, e.g. '9 a.m.-6 p.m.', '24 hours Cal ID required', 'Closed', 'By appointment', or empty when unavailable)" } },
    range: { start: dates[0], end: dates[dates.length - 1], count: dates.length },
    scraped_at: new Date().toISOString(),
    project: "https://github.com/yuxi-liu-wired/webdev-experiments/tree/main/berkeley-library-hours",
    license: "Scraper code MIT. Underlying hours data is from UC Berkeley Library; reuse subject to their terms.",
    note: "Keys starting with underscore (currently just _meta) are metadata; iterate over date keys only.",
  };
}

if (action === "fetch" || action === "all") {
  console.error(`fetching ${dateRange(START, END).length} dates...`);
  const data = await fetchAll();
  const out = { _meta: buildMeta(data), ...data };
  await Bun.write(OUT_JSON, JSON.stringify(out));
  const html = buildHTML(data);
  await Bun.write(OUT_HTML, html);
  console.error(`wrote ${OUT_JSON} and ${OUT_HTML}`);
}

if (action === "rebuild") {
  const raw = JSON.parse(await Bun.file(OUT_JSON).text());
  const { _meta, ...data } = raw;
  const withMeta = { _meta: _meta ?? buildMeta(data), ...data };
  await Bun.write(OUT_JSON, JSON.stringify(withMeta));
  const html = buildHTML(data);
  await Bun.write(OUT_HTML, html);
  console.error(`rebuilt ${OUT_HTML} from cached ${OUT_JSON}`);
}

if (action === "serve" || action === "all") {
  Bun.serve({
    port: PORT,
    fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === "/data.json") {
        return new Response(Bun.file(OUT_JSON), { headers: { "content-type": "application/json; charset=utf-8" } });
      }
      return new Response(Bun.file(OUT_HTML), { headers: { "content-type": "text/html; charset=utf-8" } });
    },
  });
  console.error(`serving on http://localhost:${PORT} (/ -> ${OUT_HTML}, /data.json -> ${OUT_JSON})`);
}
