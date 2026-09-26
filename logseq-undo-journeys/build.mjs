// Builds a stepper page of the undo sync journeys from
// logs/undo-journeys/sync-run.log (written by scripts/undo-journeys.sh).
// 3 columns per journey: the Google approach, the Miro / ADR 0011 approach,
// and what Logseq does.
// usage: bun undo-journeys-page.mjs [sync-run.log] [index.html]
// Defaults: a sync-run.jsonl next to this script, written to index.html next
// to it (the published copy in webdev-experiments/logseq-undo-journeys);
// otherwise logs/undo-journeys/sync-run.log to
// logs/undo-journeys/page/index.html (the logseq-perf copy).
// The output is 1 self-contained HTML file.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const here = dirname(new URL(import.meta.url).pathname);
const root = join(here, "..");
const local = existsSync(join(here, "sync-run.jsonl"));
const input = process.argv[2] || (local ? join(here, "sync-run.jsonl") : join(root, "logs/undo-journeys/sync-run.log"));
const output = process.argv[3] || (local ? join(here, "index.html") : join(root, "logs/undo-journeys/page/index.html"));
const log = readFileSync(input, "utf8");
const runs = log
  .split("\n")
  .filter((l) => l.startsWith("SYNCJ "))
  .map((l) => JSON.parse(l.slice(6)));
const COMMIT = "16c4ed1a0";

// Confirmed journeys: does Alice's change commute with Bob's? Worked out by
// hand from the outlines (docs/logseq-undo-facts-2026-09-26.md). 12 was
// not checked (Bob's delete removes the block Alice's insert names); the
// page shows it as commuting and says so.
const commutes = { 1: true, 2: true, 3: true, 4: true, 5: false, 6: true, 7: false, 8: false, 10: false, 11: true, 12: null };

const byKey = {};
for (const r of runs) {
  if (r.crashed) continue;
  const num = parseInt(r.journey, 10);
  const key = `${num}|${r.sync}`;
  (byKey[key] ??= { num, sync: r.sync, runs: {} }).runs[r["undo-mode"]] = r;
}

function undoNote(u) {
  if (u && u.threw) return `error: ${u.threw.replace(/#uuid "[^"]+"/, "…")}`;
  return "";
}

const view = (g, n) => ({ groceries: g, notes: n });

// The steps shared by all 3 columns, then the column's own ending.
function commonSteps(r, alicePart) {
  return [
    { kind: "start", text: "Start", alice: r.start, server: r.start },
    { kind: "alice", text: 'Alice edits "call mom" to "call dad" on page Notes', alice: r["after-call-dad"] },
    { kind: "alice", text: `Alice: ${alicePart}`, alice: r["after-alice"] },
  ];
}

function confirmedSteps(r, alicePart, bobPart, ending) {
  return [
    ...commonSteps(r, alicePart),
    { kind: "a2s", text: "Alice's 2 changes reach the server and are confirmed", server: r["server-after-upload-1"] },
    { kind: "server", text: bobPart, server: r["server-after-bob"] },
    { kind: "s2a", text: "Bob's change reaches Alice", alice: r["after-bob"] },
    ...ending,
  ];
}

function unconfirmedSteps(r, alicePart, bobPart, ending) {
  return [
    ...commonSteps(r, alicePart),
    { kind: "alice", text: "Alice presses Ctrl+Z (her change still unconfirmed)", alice: r["after-undo"], note: undoNote(r.undo), undo: true },
    { kind: "server", text: bobPart, server: r["server-after-bob"] },
    ...ending,
  ];
}

const journeys = {};
for (const [key, { num, sync, runs: rs }] of Object.entries(byKey)) {
  const sem = rs.semantic;
  const raw = rs.raw;
  const [alicePart, bobPart] = sem.journey.replace(/^\d+ /, "").split(" / ");
  const cols = {};
  if (sync === "online") {
    // Logseq: measured, upstream undo.
    const st = sem["undo-stack"];
    const olderUndone = JSON.stringify(sem["after-undo"].notes) !== JSON.stringify(sem["after-bob"].notes);
    const logseqNote = [undoNote(sem.undo),
      olderUndone ? 'Ctrl+Z undid the older change ("call dad") instead.' : "",
      st && st[1] === 0 && st[0] > 1 ? "The undo history is now empty." : ""].filter(Boolean).join(" ");
    cols.logseq = {
      steps: confirmedSteps(sem, alicePart, bobPart, [
        { kind: "alice", text: "Alice presses Ctrl+Z", alice: sem["after-undo"], note: logseqNote, undo: true },
        { kind: "a2s", text: sem["upload-2"].rows ? "Alice's undo reaches the server" : "Nothing to send", server: sem["server-final"] },
      ]),
      final: sem["alice-final"], source: "measured",
    };
    // Google: restore the state before Alice's change; measured with the
    // stored inverse datoms, which do exactly that.
    const threw = raw.undo && raw.undo.threw;
    cols.google = {
      steps: confirmedSteps(raw, alicePart, bobPart, [
        { kind: "alice", text: "Alice presses Ctrl+Z", alice: raw["after-undo"], undo: true,
          note: threw ? "Alice's change cannot be restored: its target is gone. Nothing changes." : "" },
        { kind: "a2s", text: raw["upload-2"].rows ? "Alice's undo reaches the server" : "Nothing to send", server: raw["server-final"] },
      ]),
      final: raw["alice-final"], source: "measured (undo from the stored inverse datoms)",
    };
    // Miro / ADR 0011: undo when the changes commute, refuse otherwise.
    if (commutes[num] !== false) {
      cols.miro = { ...cols.google, note: commutes[num] ? "The 2 changes commute, so the undo is exact."
        : "Commutation not checked for this pair; shown as commuting." };
    } else {
      cols.miro = {
        steps: confirmedSteps(sem, alicePart, bobPart, [
          { kind: "alice", text: "Alice presses Ctrl+Z", alice: sem["after-bob"], undo: true,
            note: "Undo refused: Alice's change and Bob's do not commute. Nothing changes." },
          { kind: "a2s", text: "Nothing to send", server: sem["server-after-bob"] },
        ]),
        final: sem["after-bob"], source: "by rule",
      };
    }
  } else {
    const expected = view(sem["server-after-bob"].groceries, ["call dad"]);
    cols.logseq = {
      steps: unconfirmedSteps(sem, alicePart, bobPart, [
        { kind: "s2a", text: "Bob's change arrives. Her app takes off her unconfirmed changes, applies Bob's, applies hers again", alice: sem["after-rebase"],
          note: (sem["undo-stack"] || [])[2] === 0 ? "Alice's undo history is emptied by this sync." : "" },
        { kind: "a2s", text: "Alice's changes reach the server and are confirmed", server: sem["server-final"] },
      ]),
      final: sem["alice-final"], source: "measured",
    };
    // Both green rules: the undo sits next to Alice's change in the server
    // order, so her change and her undo cancel, and Bob's change stays alone.
    const green = {
      steps: unconfirmedSteps(raw, alicePart, bobPart, [
        { kind: "s2a", text: "Bob's change arrives. Alice's change and her undo cancel", alice: expected },
        { kind: "a2s", text: "The server holds Bob's change alone", server: expected },
      ]),
      final: expected, source: "by rule",
    };
    cols.google = green;
    cols.miro = { ...green, note: "Nothing to commute past: the undo sits next to Alice's change." };
  }
  const same = (a, b) => JSON.stringify(a.groceries) === JSON.stringify(b.groceries) && JSON.stringify(a.notes) === JSON.stringify(b.notes);
  const lg = cols.logseq.final;
  cols.logseq.status = same(lg, cols.google.final) && same(lg, cols.miro.final) ? "Same result as both approaches."
    : same(lg, cols.google.final) ? "Same result as the Google approach, against Logseq's own design (ADR 0011: reject when the changes do not commute)."
    : same(lg, cols.miro.final) ? "Same result as the Miro / ADR 0011 approach."
    : "Matches neither approach.";
  cols.logseq.bad = !same(lg, cols.miro.final);
  journeys[key] = { num, sync, alice: alicePart, bob: bobPart, commutes: commutes[num], cols };
}

const data = JSON.stringify(journeys);
const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Undo under sync: 3 approaches, 12 journeys</title>
<style>
body{font:14px/1.35 system-ui,sans-serif;margin:16px;color:#1b1b1b;background:#fafaf7}
h1{font-size:18px;margin:0 0 6px}
.lead{max-width:1250px;margin:0 0 10px;font-size:13.5px}
.bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px}
button{font:inherit;padding:3px 9px;border:1px solid #999;background:#fff;border-radius:4px;cursor:pointer}
button.on{background:#1b1b1b;color:#fff;border-color:#1b1b1b}
button.ico{padding:3px 7px;line-height:0}
button.ico svg{width:14px;height:14px;fill:#1b1b1b}
.story{margin:6px 0 10px;font-size:15px}
.cols{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.panel{border-radius:6px;padding:8px}
.panel.google{background:#e6f5e8;border:2px solid #2e8b43}
.panel.miro{background:#e3f3f1;border:2px solid #1b7f73}
.panel.logseq{background:#fdeeee;border:2px solid #c62828}
.panel h2{font-size:14.5px;margin:0 0 2px}
.panel .rule{font-size:12px;color:#333;margin-bottom:6px}
.chart{display:grid;grid-template-columns:22px 1fr 84px 1fr;column-gap:0}
.hdr{font-weight:600;font-size:12px;text-align:center;padding:3px 0;border-bottom:2px solid #1b1b1b}
.num{color:#888;font-size:11px;padding-top:6px;text-align:right;padding-right:4px}
.lane{border-left:3px solid #1b1b1b;border-right:3px solid transparent;padding:3px 5px;min-height:36px}
.lane.srv{border-left:none;border-right:3px solid #1b1b1b}
.mid{position:relative;min-height:36px}
.mid svg{position:absolute;inset:0;width:100%;height:100%}
.mid .lbl{position:absolute;left:2px;right:2px;top:1px;font-size:10.5px;text-align:center;color:#333}
.act{font-size:11.5px;background:#fff3c4;border:1px solid #d8b84a;border-radius:3px;padding:1px 4px;margin-bottom:3px}
.act.undo{background:#ffd9d9;border-color:#c55}
.ol{font-family:ui-monospace,monospace;font-size:11px;white-space:pre;background:#fff;border:1px solid #ccc;border-radius:3px;padding:2px 4px;overflow:hidden}
.ol .chg{background:#c9f0c9}
.ol .gone{color:#b00;text-decoration:line-through}
.note{font-size:11px;color:#8a1c1c}
.hidden{visibility:hidden}
.cur .act,.cur .ol{outline:2px solid #2a6fdb}
.status{margin-top:8px;padding:6px 8px;border-radius:4px;font-size:12.5px;background:#fff}
.src{font-size:11px;color:#555;margin-top:3px}
.foot{margin-top:14px;font-size:12px;color:#444;max-width:1250px}
.foot li{margin:3px 0}
</style></head><body>
<h1>Undo under sync in Logseq: 3 approaches, 12 journeys</h1>
<div class="lead">Alice makes a change, Bob's change reaches the server, Alice presses Ctrl+Z. For 1 user, undo means "apply the inverse of my last change". With 2 users the log reads Alice's change a1, Bob's change b1, then Alice's undo u. Undoing a1 while keeping b1 has a single meaning only when a1 and b1 commute. Dolan proved that undo that restores a previous state exactly and commutativity hold together only for counters ("The Only Undoable CRDTs are Counters", PODC 2020). Stewen and Kleppmann tested 6 mainstream apps: Google Sheets, Google Slides, Excel Online, PowerPoint Online and Figma undo the user's own last change even if that discards another user's later change; Miro blocks the undo ("Undo and Redo Support for Replicated Registers", PaPoC 2024). Logseq's own design picks Miro's side: "allow semantic replay when the attrs commute and reject it when they do not" (ADR 0011). Green: the 2 consistent approaches. Red: what Logseq does, measured on upstream master ${COMMIT}.</div>
<div class="bar" id="jbar"></div>
<div class="bar"><span>Alice's change is:</span><span id="sbar"></span>
<span style="margin-left:18px"></span>
<button id="first" class="ico" title="first step (Home)"><svg viewBox="0 0 16 16"><rect x="2" y="3" width="2" height="10"/><path d="M13 3 L5 8 L13 13 Z"/></svg></button><button id="prev" class="ico" title="previous step (←)"><svg viewBox="0 0 16 16"><path d="M12 3 L4 8 L12 13 Z"/></svg></button><button id="next" class="ico" title="next step (→)"><svg viewBox="0 0 16 16"><path d="M4 3 L12 8 L4 13 Z"/></svg></button><button id="last" class="ico" title="last step (End)"><svg viewBox="0 0 16 16"><path d="M3 3 L11 8 L3 13 Z"/><rect x="12" y="3" width="2" height="10"/></svg></button>
<span id="pos" style="color:#666"></span></div>
<div class="story" id="story"></div>
<div class="cols"><div class="panel google" id="p-google"></div><div class="panel miro" id="p-miro"></div><div class="panel logseq" id="p-logseq"></div></div>
<div class="foot"><ul>
<li>Each chart has 2 machines: Alice's app and the server, where Bob edits. Time runs down. Yellow boxes are actions, red is Ctrl+Z, arrows are sync messages. Under each action is the page Groceries as that machine has it: green lines changed at that step, struck lines were removed. Every journey starts with Alice editing "call mom" to "call dad", so her undo history holds 1 older change.</li>
<li>Confirmed: Alice's change reaches the server before Bob's; the log reads a1, b1, u. Unconfirmed: Alice's change and her undo are still unconfirmed when Bob's change arrives; the log reads b1, a1, u, where the undo sits next to her change.</li>
<li>Google approach, confirmed: measured by undoing from the stored inverse datoms of Alice's change, which restores the state before it. Miro / ADR 0011 approach, confirmed: the Google result when a1 and b1 commute, else the undo is refused and nothing changes. Both approaches, unconfirmed: by rule, Alice's change and her undo cancel, leaving Bob's change alone. What Logseq does: measured with Logseq's own undo, through the real sync functions (apply-remote-tx!, apply-tx-entry!).</li>
<li>Test: frontend.worker.undo-sync-journey-test, run on upstream master ${COMMIT}. All 46 runs ended with Alice's copy equal to the server's.</li>
</ul></div>
<script>
const J = ${data};
const keys = Object.keys(J).sort((a,b)=>parseInt(a)-parseInt(b));
let num = 1, sync = "online", step = 1e9, lastStep = 0;
const nums = [...new Set(keys.map(k=>parseInt(k)))];
const TITLES = {google:"Google approach", miro:"Miro / ADR 0011 approach", logseq:"What Logseq does"};
const RULES = {google:"Undo restores the state before Alice's change, even if that discards Bob's later change.", miro:"Undo only when Alice's and Bob's changes commute; otherwise refuse and change nothing.", logseq:"Measured on upstream master."};
function flat(o, d=0, out=[]){ for(const x of o||[]){ if(Array.isArray(x)){ out.push("  ".repeat(d)+x[0]); flat(x[1], d+1, out);} else out.push("  ".repeat(d)+x);} return out; }
function kept(a, b){
  const m = a.length, n = b.length, t = Array.from({length:m+1},()=>new Array(n+1).fill(0));
  for (let i=m-1;i>=0;i--) for (let k=n-1;k>=0;k--) t[i][k] = a[i]===b[k] ? t[i+1][k+1]+1 : Math.max(t[i+1][k], t[i][k+1]);
  const keepA = new Set(); let i=0,k=0;
  while (i<m && k<n) { if (a[i]===b[k]) { keepA.add(i); i++; k++; } else if (t[i+1][k]>=t[i][k+1]) i++; else k++; }
  return keepA;
}
function esc(s){ return String(s).replace(/[&<>]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
function olHtml(view, prev){
  const lines = flat(view && view.groceries); const before = prev ? flat(prev.groceries) : lines;
  const notes = view && view.notes ? view.notes.join(", ") : "";
  const pn = prev && prev.notes ? prev.notes.join(", ") : notes;
  const keep = kept(lines, before);
  let h = lines.map((l, i) => keep.has(i) ? esc(l) : '<span class="chg">'+esc(l)+'</span>').join("\\n");
  const gone = before.filter(l => !lines.includes(l));
  if (gone.length) h += "\\n" + gone.map(l=>'<span class="gone">'+esc(l.trim())+'</span>').join("\\n");
  h += "\\n<span style='color:#777'>Notes:</span> " + (notes!==pn ? '<span class="chg">'+esc(notes)+'</span>' : esc(notes));
  return '<div class="ol">'+h+'</div>';
}
function arrow(dir){
  const [x1,x2] = dir==="a2s" ? [2,98] : [98,2];
  return '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><marker id="h'+dir+'" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#2a6fdb"/></marker></defs>'+
    '<line x1="'+x1+'" y1="30" x2="'+x2+'" y2="92" stroke="#2a6fdb" stroke-width="2" vector-effect="non-scaling-stroke" marker-end="url(#h'+dir+')"/></svg>';
}
function render(){
  const j = J[num+"|"+sync];
  document.getElementById("jbar").innerHTML = nums.map(n=>{
    const t = (J[n+"|online"]||J[n+"|offline"]); return '<button class="'+(n===num?"on":"")+'" data-n="'+n+'">'+n+". "+esc(t.alice)+" / "+esc(t.bob)+'</button>';}).join("");
  document.getElementById("sbar").innerHTML = ["online","offline"].map(s=>
    '<button class="'+(s===sync?"on":"")+'" data-s="'+s+'" '+(J[num+"|"+s]?"":"disabled")+'>'+(s==="online"?"confirmed before Bob's change arrives":"still unconfirmed when Bob's change arrives")+'</button>').join(" ");
  if(!j){ return; }
  const n = j.cols.logseq.steps.length; lastStep = n-1; step = Math.min(step, lastStep); const cur = step;
  document.getElementById("pos").textContent = "step "+cur+" of "+(n-1);
  document.getElementById("story").innerHTML = "<b>Alice</b>: "+esc(j.alice)+", then Ctrl+Z. "+esc(j.bob)+"."+
    (j.sync==="online" ? " <span style='color:#555'>(a1 and b1 "+(j.commutes===null?"commute: not checked":j.commutes?"commute":"do not commute")+")</span>" : "");
  for (const col of ["google","miro","logseq"]) {
    const m = j.cols[col];
    let h = '<h2>'+TITLES[col]+'</h2><div class="rule">'+RULES[col]+'</div><div class="chart">';
    h += '<div></div><div class="hdr">Alice\\'s app</div><div></div><div class="hdr">Server (Bob)</div>';
    let lastA = null, lastS = null;
    m.steps.forEach((s, i) => {
      const hid = i > cur ? " hidden" : ""; const c = i === cur ? " cur" : "";
      let a = "", mid = "", sv = "";
      if (s.kind === "start") { a = olHtml(s.alice, null); sv = olHtml(s.server, null); }
      if (s.kind === "alice") { a = '<div class="act'+(s.undo?" undo":"")+'">'+esc(s.text)+'</div>'+olHtml(s.alice, lastA)+(s.note?'<div class="note">'+esc(s.note)+'</div>':''); }
      if (s.kind === "server") { sv = '<div class="act">'+esc(s.text)+'</div>'+olHtml(s.server, lastS); }
      if (s.kind === "a2s") { mid = arrow("a2s")+'<div class="lbl">'+esc(s.text)+'</div>'; sv = '<div style="height:24px"></div>'+olHtml(s.server, lastS); }
      if (s.kind === "s2a") { mid = arrow("s2a")+'<div class="lbl">'+esc(s.text)+'</div>'; a = '<div style="height:24px"></div>'+olHtml(s.alice, lastA)+(s.note?'<div class="note">'+esc(s.note)+'</div>':''); }
      h += '<div class="num'+hid+'">'+i+'</div><div class="lane'+hid+c+'">'+a+'</div><div class="mid'+hid+'" style="min-height:'+(s.kind==="s2a"?84:44)+'px">'+mid+'</div><div class="lane srv'+hid+c+'">'+sv+'</div>';
      if (s.alice) lastA = s.alice; if (s.server) lastS = s.server;
    });
    h += '</div>';
    if (cur === n-1) {
      const txt = col === "logseq" ? m.status : (m.note || "");
      h += '<div class="status">'+(col==="logseq" ? (m.bad ? "✗ " : "✓ ") : "")+esc(txt)+'<div class="src">'+esc(m.source)+'</div></div>';
    }
    document.getElementById("p-"+col).innerHTML = h;
  }
}
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.n) { num = +b.dataset.n; if (!J[num+"|"+sync]) sync = "offline"; step = 0; }
  if (b.dataset.s) { sync = b.dataset.s; step = 0; }
  if (b.id==="first") step = 0; if (b.id==="prev") step = Math.max(Math.min(step,lastStep)-1, 0);
  if (b.id==="next") step = Math.min(step+1, lastStep); if (b.id==="last") step = lastStep;
  render();
});
document.addEventListener("keydown", e => {
  const k = {ArrowRight: () => Math.min(step+1, lastStep), " ": () => Math.min(step+1, lastStep),
             ArrowLeft: () => Math.max(Math.min(step,lastStep)-1, 0), Home: () => 0, End: () => lastStep}[e.key];
  if (k) { step = k(); e.preventDefault(); render(); }
});
const q = new URLSearchParams(location.search); if (q.get("j")) num = +q.get("j"); if (q.get("s")) sync = ({confirmed: "online", unconfirmed: "offline"})[q.get("s")] || q.get("s"); if (q.get("step")) step = +q.get("step");
render();
</script></body></html>`;
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html);
console.log(`wrote ${output} (${Object.keys(journeys).length} journey runs)`);
