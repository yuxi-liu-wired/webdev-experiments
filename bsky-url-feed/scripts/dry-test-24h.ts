#!/usr/bin/env bun
// Replay the last 24h of Jetstream, stream to disk, compute filter counts.
// Writes raw posts to /workspace/firehose-data/firehose-24h.jsonl (~1.3 GB).

import { isBotAuthor, type Facet, type ReplyRef } from "./classify";

const JETSTREAM_URL = "wss://jetstream2.us-east.bsky.network/subscribe";
const APPVIEW = "https://api.bsky.app";
const HOURS_BACK = 24;
const OUTPUT_FILE = "/workspace/firehose-data/firehose-24h.jsonl";
const DRAIN_IDLE_MS = 5_000;
const DRAIN_HARD_TIMEOUT_MS = 90 * 60_000;

interface AuthorInfo {
  handle: string;
  labels: { val: string }[];
}

function linkFacetCount(facets?: Facet[]): number {
  if (!facets) return 0;
  return facets.filter((f) =>
    f.features.some((x) => x.$type === "app.bsky.richtext.facet#link"),
  ).length;
}

function isReply(reply?: ReplyRef): boolean {
  return !!reply?.parent?.uri;
}

async function fetchProfiles(dids: string[]): Promise<Map<string, AuthorInfo>> {
  const out = new Map<string, AuthorInfo>();
  for (let i = 0; i < dids.length; i += 25) {
    const batch = dids.slice(i, i + 25);
    const params = new URLSearchParams();
    for (const did of batch) params.append("actors", did);
    try {
      const res = await fetch(`${APPVIEW}/xrpc/app.bsky.actor.getProfiles?${params}`);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        profiles: { did: string; handle: string; labels?: { val: string }[] }[];
      };
      for (const p of data.profiles) {
        out.set(p.did, { handle: p.handle, labels: p.labels ?? [] });
      }
    } catch {}
    if ((i / 25) % 20 === 0) {
      process.stdout.write(`\r  profiles ${out.size}/${dids.length}`);
    }
  }
  console.log(`\n  fetched ${out.size}/${dids.length} profiles`);
  return out;
}

type FilterName =
  | ">=3 links"
  | ">=4 links"
  | ">=3 links + reply"
  | ">=4 links + reply";

async function main() {
  const wallStart = Date.now();
  const cursorUs = (wallStart - HOURS_BACK * 3_600_000) * 1000;
  const url = `${JETSTREAM_URL}?wantedCollections=app.bsky.feed.post&cursor=${cursorUs}`;
  console.log(`replaying since ${new Date(cursorUs / 1000).toISOString()}`);

  const writer = Bun.file(OUTPUT_FILE).writer();
  const ws = new WebSocket(url);

  const counts: Record<string, number> = {
    "total commits": 0,
    "is reply (any)": 0,
    ">=3 links": 0,
    ">=4 links": 0,
    ">=3 links + reply": 0,
    ">=4 links + reply": 0,
  };
  const authorCounts: Record<FilterName, Map<string, number>> = {
    ">=3 links": new Map(),
    ">=4 links": new Map(),
    ">=3 links + reply": new Map(),
    ">=4 links + reply": new Map(),
  };
  let maxCursorUs = cursorUs;
  let lastMessageAt = Date.now();
  let writtenBytes = 0;

  await new Promise<void>((resolve) => {
    const checkIdle = setInterval(() => {
      const idle = Date.now() - lastMessageAt;
      const elapsed = Date.now() - wallStart;
      if (idle >= DRAIN_IDLE_MS || elapsed >= DRAIN_HARD_TIMEOUT_MS) {
        clearInterval(checkIdle);
        try {
          ws.close();
        } catch {}
        resolve();
      }
    }, 1000);

    ws.onopen = () => console.log("  connected, replaying...");
    ws.onerror = () => {
      clearInterval(checkIdle);
      resolve();
    };
    ws.onclose = () => {
      clearInterval(checkIdle);
      resolve();
    };
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

      counts["total commits"]++;

      const post = {
        did: event.did,
        rkey: c.rkey,
        text: c.record.text ?? "",
        facets: c.record.facets,
        reply: c.record.reply,
        createdAt: c.record.createdAt,
      };
      const line = JSON.stringify(post) + "\n";
      writer.write(line);
      writtenBytes += line.length;

      const lc = linkFacetCount(c.record.facets);
      const ir = isReply(c.record.reply);

      if (ir) counts["is reply (any)"]++;
      if (lc >= 3) {
        counts[">=3 links"]++;
        const m1 = authorCounts[">=3 links"];
        m1.set(event.did, (m1.get(event.did) ?? 0) + 1);
      }
      if (lc >= 4) {
        counts[">=4 links"]++;
        const m1 = authorCounts[">=4 links"];
        m1.set(event.did, (m1.get(event.did) ?? 0) + 1);
      }
      if (lc >= 3 && ir) {
        counts[">=3 links + reply"]++;
        const m1 = authorCounts[">=3 links + reply"];
        m1.set(event.did, (m1.get(event.did) ?? 0) + 1);
      }
      if (lc >= 4 && ir) {
        counts[">=4 links + reply"]++;
        const m1 = authorCounts[">=4 links + reply"];
        m1.set(event.did, (m1.get(event.did) ?? 0) + 1);
      }

      if (counts["total commits"] % 25000 === 0) {
        const elapsedSec = ((Date.now() - wallStart) / 1000).toFixed(0);
        const replayHours = ((maxCursorUs - cursorUs) / 1e9 / 3600).toFixed(2);
        const mb = (writtenBytes / 1024 / 1024).toFixed(0);
        process.stdout.write(
          `\r  commits=${counts["total commits"].toLocaleString().padStart(9)} replay=${replayHours}h wall=${elapsedSec}s out=${mb}MB`,
        );
      }
    };
  });

  await writer.end();
  console.log("");
  console.log(`drained: ${counts["total commits"].toLocaleString()} commits`);
  console.log(`wrote:   ${(writtenBytes / 1024 / 1024).toFixed(0)} MB to ${OUTPUT_FILE}`);

  // Union of authors for bot lookup
  const dids = new Set<string>();
  for (const m of Object.values(authorCounts)) {
    for (const did of m.keys()) dids.add(did);
  }
  console.log(`looking up ${dids.size} unique authors...`);
  const profiles = await fetchProfiles([...dids]);

  function nonBotPosts(name: FilterName): number {
    let n = 0;
    for (const [did, postCount] of authorCounts[name]) {
      const p = profiles.get(did);
      if (!p) {
        // unknown — assume non-bot
        n += postCount;
        continue;
      }
      if (!isBotAuthor(p.handle, p.labels)) n += postCount;
    }
    return n;
  }

  const filters: FilterName[] = [
    ">=3 links",
    ">=4 links",
    ">=3 links + reply",
    ">=4 links + reply",
  ];

  console.log("");
  console.log(`24h replay (rate: ${counts["total commits"].toLocaleString()} commits/day = ${(counts["total commits"] / 86400).toFixed(1)}/sec average)`);
  console.log("");
  console.log("Filter                          | Raw       | NoBot     | NoBot/hr");
  console.log("--------------------------------|-----------|-----------|----------");
  for (const f of filters) {
    const raw = counts[f] ?? 0;
    const nobot = nonBotPosts(f);
    const perHr = (nobot / 24).toFixed(1);
    console.log(
      `${f.padEnd(31)} | ${raw.toString().padStart(9)} | ${nobot.toString().padStart(9)} | ${perHr.padStart(8)}`,
    );
  }
  console.log(`is reply (any)                  | ${counts["is reply (any)"].toString().padStart(9)} |       N/A |     N/A`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
