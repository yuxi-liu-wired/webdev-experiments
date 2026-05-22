#!/usr/bin/env bun
// Long-running live Jetstream consumer. Appends ≥1-link posts to a JSONL file
// until killed or until DURATION_DAYS elapses. Reconnects on disconnect.

const JETSTREAM_URL =
  "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post";
const OUTPUT_FILE = process.env.OUTPUT_FILE ?? "/tmp/firehose-live.jsonl";
const STATS_FILE = `${OUTPUT_FILE}.stats.json`;
const DURATION_DAYS = Number(process.env.DURATION_DAYS ?? 7);
const STATS_INTERVAL_MS = 60_000;

interface Facet {
  index: { byteStart: number; byteEnd: number };
  features: { $type: string }[];
}

function hasLinkFacet(facets?: Facet[]): boolean {
  if (!facets) return false;
  for (const f of facets) {
    for (const x of f.features) {
      if (x.$type === "app.bsky.richtext.facet#link") return true;
    }
  }
  return false;
}

const wallStart = Date.now();
const stopAt = wallStart + DURATION_DAYS * 86_400_000;
let totalCommits = 0;
let kept = 0;
let writtenBytes = 0;
let reconnects = 0;
let lastMessageAt = Date.now();
let maxCursorUs = 0;

const writer = Bun.file(OUTPUT_FILE).writer();

async function flushStats() {
  await Bun.write(
    STATS_FILE,
    JSON.stringify(
      {
        startedAt: new Date(wallStart).toISOString(),
        updatedAt: new Date().toISOString(),
        stopAt: new Date(stopAt).toISOString(),
        durationDays: DURATION_DAYS,
        totalCommits,
        kept,
        writtenBytes,
        reconnects,
        lastMessageAt: new Date(lastMessageAt).toISOString(),
        lastCursorIso: maxCursorUs ? new Date(Math.floor(maxCursorUs / 1000)).toISOString() : null,
        wallSec: ((Date.now() - wallStart) / 1000).toFixed(0),
      },
      null,
      2,
    ),
  ).catch(() => {});
}

setInterval(flushStats, STATS_INTERVAL_MS);

async function run() {
  while (Date.now() < stopAt) {
    let url = JETSTREAM_URL;
    if (maxCursorUs > 0) {
      // Resume from last seen cursor on reconnect
      url += `&cursor=${maxCursorUs}`;
    }
    console.log(`[${new Date().toISOString()}] connecting (reconnects=${reconnects})`);
    const ws = new WebSocket(url);
    await new Promise<void>((resolve) => {
      ws.onopen = () => console.log(`  open`);
      ws.onerror = () => resolve();
      ws.onclose = () => resolve();
      ws.onmessage = (m) => {
        lastMessageAt = Date.now();
        let event: any;
        try {
          event = JSON.parse(m.data as string);
        } catch {
          return;
        }
        if (event.time_us > maxCursorUs) maxCursorUs = event.time_us;
        if (event.kind !== "commit") return;
        const c = event.commit;
        if (!c || c.operation !== "create" || c.collection !== "app.bsky.feed.post" || !c.record)
          return;
        totalCommits++;
        if (!hasLinkFacet(c.record.facets)) return;
        const post = {
          did: event.did,
          rkey: c.rkey,
          text: c.record.text ?? "",
          facets: c.record.facets,
          reply: c.record.reply,
          createdAt: c.record.createdAt,
          langs: c.record.langs,
          embed: c.record.embed,
        };
        const line = JSON.stringify(post) + "\n";
        writer.write(line);
        writtenBytes += line.length;
        kept++;
      };
    });
    reconnects++;
    if (Date.now() < stopAt) {
      const backoff = Math.min(60_000, 1000 * Math.pow(2, Math.min(reconnects, 6)));
      console.log(`  disconnected, sleeping ${backoff}ms before reconnect`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  console.log("duration elapsed, finishing");
  await writer.end();
  await flushStats();
}

process.on("SIGTERM", async () => {
  console.log("SIGTERM, flushing");
  await writer.end();
  await flushStats();
  process.exit(0);
});
process.on("SIGINT", async () => {
  console.log("SIGINT, flushing");
  await writer.end();
  await flushStats();
  process.exit(0);
});

run().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
