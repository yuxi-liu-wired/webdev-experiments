#!/usr/bin/env bun
// Compact the 1.6 GB firehose dump into a small JSON consumable by the dashboard.
// Output: /tmp/firehose-compact.json (~3-5 MB)

import { isBotAuthor, type Facet, type ReplyRef } from "./classify";

const INPUT = process.env.INPUT_FILE ?? "/tmp/firehose-24h.jsonl";
const OUTPUT = process.env.OUTPUT_FILE ?? "/tmp/firehose-compact.json";
const APPVIEW = "https://api.bsky.app";
const MIN_LINKS_TO_INCLUDE = 3; // keep posts with >=3 EXTERNAL link facets (was 2, blew the Pages 25 MiB limit)

interface PostEvent {
  did: string;
  rkey?: string;
  text: string;
  facets?: Facet[];
  reply?: ReplyRef;
  createdAt?: string;
}

interface CompactPost {
  d: string;      // did
  k: string;      // rkey
  h?: string;     // handle (filled later)
  n: number;      // link facet count
  c: number;      // char coverage (0-1)
  l: number;      // text length (chars)
  r: 0 | 1 | 2;   // 0=top-level, 1=self-reply, 2=other-reply
  b?: 1;          // bot flag
  D: string[];    // unique domains in link set
  t: string;      // full text (capped at 500 chars)
  f: [number, number, string][];  // link facets: [byteStart, byteEnd, uri]
  ts: number;     // createdAt epoch ms
}

function linkFacets(facets?: Facet[]) {
  if (!facets) return [];
  const out: { byteStart: number; byteEnd: number; uri: string }[] = [];
  for (const f of facets) {
    for (const x of f.features) {
      if (x.$type !== "app.bsky.richtext.facet#link") continue;
      const uri = (x as any).uri ?? "";
      // Skip internal bsky.app self-links (hashtags, profile refs, post refs)
      try {
        const u = new URL(uri);
        if (u.hostname === "bsky.app" || u.hostname.endsWith(".bsky.app")) continue;
      } catch {
        continue;
      }
      out.push({ ...f.index, uri });
    }
  }
  return out;
}

function isReply(reply?: ReplyRef): boolean {
  return !!reply?.parent?.uri;
}

function parseDidFromAtUri(uri: string): string | null {
  const m = uri.match(/^at:\/\/([^/]+)\//);
  return m ? m[1] : null;
}

function tld(uri: string): string {
  try {
    const u = new URL(uri);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "(invalid)";
  }
}

function charCoverage(text: string, facets: { byteStart: number; byteEnd: number }[]) {
  if (text.length === 0) return 0;
  const bytes = new TextEncoder().encode(text);
  const covered = new Uint8Array(bytes.length);
  for (const f of facets) {
    const s = Math.max(0, f.byteStart);
    const e = Math.min(bytes.length, f.byteEnd);
    for (let i = s; i < e; i++) covered[i] = 1;
  }
  const encoder = new TextEncoder();
  let bp = 0, total = 0, cv = 0;
  for (const ch of text) {
    const len = encoder.encode(ch).length;
    if (!/\s/.test(ch)) {
      total++;
      let any = false;
      for (let i = bp; i < bp + len; i++) if (covered[i]) { any = true; break; }
      if (any) cv++;
    }
    bp += len;
  }
  if (total === 0) return 1;
  return cv / total;
}

async function fetchHandles(dids: string[]): Promise<Map<string, { handle: string; bot: boolean }>> {
  const out = new Map<string, { handle: string; bot: boolean }>();
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
        out.set(p.did, { handle: p.handle, bot: isBotAuthor(p.handle, p.labels) });
      }
    } catch {}
    if (i % 500 === 0) process.stdout.write(`\r  profiles ${out.size}/${dids.length}`);
  }
  console.log(`\n  fetched ${out.size}/${dids.length} profiles`);
  return out;
}

async function streamReadAll(): Promise<{
  posts: CompactPost[];
  totalPosts: number;
  withFacets: number;
  withLinks: number;
  linkCountDist: Record<number, number>;
  replies: number;
}> {
  const file = Bun.file(INPUT);
  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const posts: CompactPost[] = [];
  let totalPosts = 0;
  let withFacets = 0;
  let withLinks = 0;
  let replies = 0;
  const linkCountDist: Record<number, number> = {};

  console.log(`streaming ${(file.size / 1024 / 1024).toFixed(0)} MB from ${INPUT}`);
  const start = Date.now();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let p: PostEvent;
      try { p = JSON.parse(line); } catch { continue; }
      totalPosts++;
      const lf = linkFacets(p.facets);
      const lc = lf.length;
      const ir = isReply(p.reply);
      if (p.facets) withFacets++;
      if (lc > 0) withLinks++;
      if (ir) replies++;
      linkCountDist[lc] = (linkCountDist[lc] ?? 0) + 1;

      if (lc < MIN_LINKS_TO_INCLUDE) continue;

      const sr = ir && parseDidFromAtUri(p.reply!.parent!.uri) === p.did;
      const r: 0 | 1 | 2 = !ir ? 0 : sr ? 1 : 2;
      const doms = [...new Set(lf.map((f) => tld(f.uri)))];
      const cov = charCoverage(p.text, lf);
      const ts = p.createdAt ? new Date(p.createdAt).getTime() : 0;

      // Cap text at 250 chars (text-heavy posts otherwise dominate compact size).
      const TEXT_CAP = 250;
      const keptText = p.text.length > TEXT_CAP ? p.text.slice(0, TEXT_CAP) + "…" : p.text;
      const keptBytes = new TextEncoder().encode(keptText).length;
      const compactFacets: [number, number, string][] = lf
        .filter((f) => f.byteStart < keptBytes)
        .map((f) => [f.byteStart, Math.min(f.byteEnd, keptBytes), f.uri]);

      posts.push({
        d: p.did,
        k: p.rkey ?? "",
        n: lc,
        c: Math.round(cov * 1000) / 1000,
        l: p.text.length,
        r,
        D: doms,
        t: keptText,
        f: compactFacets,
        ts,
      });

      if (totalPosts % 500_000 === 0) {
        process.stdout.write(
          `\r  ${totalPosts.toLocaleString()} commits, ${posts.length.toLocaleString()} kept (${((Date.now() - start) / 1000).toFixed(0)}s)`,
        );
      }
    }
  }
  console.log(`\n  done in ${((Date.now() - start) / 1000).toFixed(0)}s. kept ${posts.length.toLocaleString()} posts (>=${MIN_LINKS_TO_INCLUDE} links).`);
  return { posts, totalPosts, withFacets, withLinks, linkCountDist, replies };
}

async function main() {
  const { posts, totalPosts, withFacets, withLinks, linkCountDist, replies } = await streamReadAll();

  const uniqDids = [...new Set(posts.map((p) => p.d))];
  console.log(`looking up ${uniqDids.length.toLocaleString()} authors...`);
  const profiles = await fetchHandles(uniqDids);

  for (const p of posts) {
    const prof = profiles.get(p.d);
    if (prof) {
      p.h = prof.handle;
      if (prof.bot) p.b = 1;
    }
  }

  const out = {
    capturedAt: new Date().toISOString(),
    summary: {
      totalPosts,
      withFacets,
      withLinks,
      replies,
      linkCountDist,
      kept: posts.length,
      uniqueAuthors: uniqDids.length,
      authorsResolved: profiles.size,
    },
    posts,
  };

  await Bun.write(OUTPUT, JSON.stringify(out));
  console.log(`wrote ${OUTPUT} (${((Bun.file(OUTPUT).size) / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
