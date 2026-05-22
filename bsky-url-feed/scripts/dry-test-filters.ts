#!/usr/bin/env bun
// Capture 5 minutes of the Jetstream firehose, then report how many posts each
// candidate filter set would match (raw + after bot author exclusion).

import { writeFile } from "fs/promises";
import { isBotAuthor, type Facet, type ReplyRef } from "./classify";

const JETSTREAM_URL =
  "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post";
const APPVIEW = "https://api.bsky.app";
const CAPTURE_MS = 5 * 60 * 1000;
const OUTPUT_FILE = "/tmp/firehose-5min.jsonl";

interface PostEvent {
  did: string;
  rkey: string;
  text: string;
  facets?: Facet[];
  reply?: ReplyRef;
  createdAt?: string;
}

interface JetstreamEvent {
  did: string;
  kind: string;
  commit?: {
    operation: string;
    collection: string;
    rkey: string;
    record?: { text?: string; facets?: Facet[]; reply?: ReplyRef; createdAt?: string };
  };
}

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

async function capture(): Promise<PostEvent[]> {
  const events: PostEvent[] = [];
  let messages = 0;
  const start = Date.now();

  console.log(`connecting to ${JETSTREAM_URL}`);
  const ws = new WebSocket(JETSTREAM_URL);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.log("\n  timeout reached, closing");
      ws.close();
    }, CAPTURE_MS);
    ws.onopen = () => console.log("  connected; capturing 5 min...");
    ws.onerror = (e) => {
      clearTimeout(timeout);
      reject(new Error(`ws error: ${JSON.stringify(e)}`));
    };
    ws.onclose = () => {
      clearTimeout(timeout);
      resolve();
    };
    ws.onmessage = (m) => {
      messages++;
      try {
        const event = JSON.parse(m.data as string) as JetstreamEvent;
        if (event.kind !== "commit") return;
        const c = event.commit;
        if (!c || c.operation !== "create") return;
        if (c.collection !== "app.bsky.feed.post") return;
        if (!c.record) return;
        events.push({
          did: event.did,
          rkey: c.rkey,
          text: c.record.text ?? "",
          facets: c.record.facets,
          reply: c.record.reply,
          createdAt: c.record.createdAt,
        });
      } catch {}
      if (messages % 5000 === 0) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(0);
        process.stdout.write(
          `\r  msgs=${messages.toLocaleString().padStart(7)}  posts=${events.length.toString().padStart(6)}  t=${elapsed}s `,
        );
      }
    };
  });
  console.log(`\ncaptured ${events.length} posts from ${messages} messages`);
  return events;
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
    process.stdout.write(`\r  profiles: ${out.size}/${dids.length}`);
  }
  console.log(`\nfetched ${out.size} profiles of ${dids.length}`);
  return out;
}

async function main() {
  const events = await capture();
  await writeFile(
    OUTPUT_FILE,
    events.map((e) => JSON.stringify(e)).join("\n") + "\n",
  );
  console.log(`saved raw posts → ${OUTPUT_FILE}`);

  const sets = {
    ">=3 links": events.filter((e) => linkFacetCount(e.facets) >= 3),
    ">=4 links": events.filter((e) => linkFacetCount(e.facets) >= 4),
    "is a reply (to anyone)": events.filter((e) => isReply(e.reply)),
    ">=3 links AND is a reply": events.filter(
      (e) => linkFacetCount(e.facets) >= 3 && isReply(e.reply),
    ),
    ">=4 links AND is a reply": events.filter(
      (e) => linkFacetCount(e.facets) >= 4 && isReply(e.reply),
    ),
  };

  // Union of authors across all sets (skip the "is a reply" set — it's huge and
  // not useful to count its bot filter)
  const dids = new Set<string>();
  for (const [name, set] of Object.entries(sets)) {
    if (name === "is a reply (to anyone)") continue; // too many
    for (const e of set) dids.add(e.did);
  }
  console.log(`\nlooking up ${dids.size} unique authors for bot filtering...`);
  const profiles = await fetchProfiles([...dids]);

  function nonBotCount(set: PostEvent[]): { count: number; assumed: number } {
    let count = 0;
    let assumed = 0;
    for (const e of set) {
      const p = profiles.get(e.did);
      if (!p) {
        // Unknown profile (lookup failed) — assume non-bot
        count++;
        assumed++;
        continue;
      }
      if (!isBotAuthor(p.handle, p.labels)) count++;
    }
    return { count, assumed };
  }

  console.log(`\nTotal posts in 5 min:  ${events.length}`);
  console.log(`Extrapolated 24h:      ${(events.length * 288).toLocaleString()}`);
  console.log("");
  console.log(
    "Filter                          | Raw  | NoBot | NoBot/day (×288)",
  );
  console.log(
    "--------------------------------|------|-------|------------------",
  );
  for (const [name, set] of Object.entries(sets)) {
    let nobot: number | string;
    if (name === "is a reply (to anyone)") {
      nobot = "-";
    } else {
      const r = nonBotCount(set);
      nobot = r.count.toString();
    }
    const perDay =
      typeof nobot === "number" ? (nobot * 288).toLocaleString() : "-";
    console.log(
      `${name.padEnd(31)} | ${set.length.toString().padStart(4)} | ${nobot.toString().padStart(5)} | ${perDay.padStart(16)}`,
    );
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
