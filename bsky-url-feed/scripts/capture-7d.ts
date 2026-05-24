#!/usr/bin/env bun
// Replay HOURS_BACK hours of Jetstream and save posts with >=1 link facet to JSONL.
// Default: 168h (7 days). Output to /workspace/firehose-data/firehose-${HOURS}h.jsonl.

const JETSTREAM_URL = "wss://jetstream2.us-east.bsky.network/subscribe";
const HOURS_BACK = Number(process.env.HOURS_BACK ?? 168);
const OUTPUT_FILE = process.env.OUTPUT_FILE ?? `/workspace/firehose-data/firehose-${HOURS_BACK}h.jsonl`;
const DRAIN_IDLE_MS = 5_000;
const DRAIN_HARD_TIMEOUT_MS = 6 * 3600 * 1000; // 6h max wall clock
const STATS_FILE = `${OUTPUT_FILE}.stats.json`;

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

async function main() {
  const wallStart = Date.now();
  const cursorUs = (wallStart - HOURS_BACK * 3_600_000) * 1000;
  const url = `${JETSTREAM_URL}?wantedCollections=app.bsky.feed.post&cursor=${cursorUs}`;
  console.log(`replaying ${HOURS_BACK}h since ${new Date(cursorUs / 1000).toISOString()}`);
  console.log(`output: ${OUTPUT_FILE}`);

  const writer = Bun.file(OUTPUT_FILE).writer();
  const ws = new WebSocket(url);

  let totalCommits = 0;
  let totalReplies = 0;
  let totalWithLink = 0;
  let kept = 0;
  let writtenBytes = 0;
  let maxCursorUs = cursorUs;
  let lastMessageAt = Date.now();
  let lastFlushAt = Date.now();

  await new Promise<void>((resolve) => {
    const checkIdle = setInterval(async () => {
      const idle = Date.now() - lastMessageAt;
      const elapsed = Date.now() - wallStart;
      // Stop conditions: idle drain, hard timeout, OR caught up to live (within 30s of now)
      const liveLag = (Date.now() * 1000 - maxCursorUs) / 1e6;
      const caughtUp = liveLag < 30 && maxCursorUs > cursorUs;
      if (idle >= DRAIN_IDLE_MS || elapsed >= DRAIN_HARD_TIMEOUT_MS || caughtUp) {
        clearInterval(checkIdle);
        try { ws.close(); } catch {}
        resolve();
      }
      // Flush stats periodically
      if (Date.now() - lastFlushAt > 60_000) {
        lastFlushAt = Date.now();
        Bun.write(STATS_FILE, JSON.stringify({
          startedAt: new Date(wallStart).toISOString(),
          updatedAt: new Date().toISOString(),
          totalCommits,
          totalReplies,
          totalWithLink,
          kept,
          writtenBytes,
          replayHours: ((maxCursorUs - cursorUs) / 1e9 / 3600).toFixed(2),
          wallSec: ((Date.now() - wallStart) / 1000).toFixed(0),
        })).catch(() => {});
      }
    }, 1000);

    ws.onopen = () => console.log("  connected, replaying...");
    ws.onerror = () => { clearInterval(checkIdle); resolve(); };
    ws.onclose = () => { clearInterval(checkIdle); resolve(); };
    ws.onmessage = (m) => {
      lastMessageAt = Date.now();
      let event: any;
      try { event = JSON.parse(m.data as string); } catch { return; }
      if (event.time_us > maxCursorUs) maxCursorUs = event.time_us;
      if (event.kind !== "commit") return;
      const c = event.commit;
      if (!c || c.operation !== "create" || c.collection !== "app.bsky.feed.post" || !c.record) return;

      totalCommits++;
      if (c.record.reply?.parent?.uri) totalReplies++;
      if (!hasLinkFacet(c.record.facets)) return;
      totalWithLink++;
      kept++;

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

      if (kept % 10000 === 0) {
        const elapsedSec = ((Date.now() - wallStart) / 1000).toFixed(0);
        const replayHours = ((maxCursorUs - cursorUs) / 1e9 / 3600).toFixed(2);
        const mb = (writtenBytes / 1024 / 1024).toFixed(0);
        process.stdout.write(
          `\r  commits=${totalCommits.toLocaleString().padStart(10)} kept=${kept.toLocaleString().padStart(8)} replay=${replayHours}h wall=${elapsedSec}s out=${mb}MB`,
        );
      }
    };
  });

  await writer.end();
  console.log("");
  console.log(`done. commits=${totalCommits.toLocaleString()} kept=${kept.toLocaleString()} written=${(writtenBytes / 1024 / 1024).toFixed(0)}MB`);
  await Bun.write(STATS_FILE, JSON.stringify({
    startedAt: new Date(wallStart).toISOString(),
    finishedAt: new Date().toISOString(),
    totalCommits,
    totalReplies,
    totalWithLink,
    kept,
    writtenBytes,
    replayHours: ((maxCursorUs - cursorUs) / 1e9 / 3600).toFixed(2),
    wallSec: ((Date.now() - wallStart) / 1000).toFixed(0),
    requestedHoursBack: HOURS_BACK,
  }, null, 2));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
