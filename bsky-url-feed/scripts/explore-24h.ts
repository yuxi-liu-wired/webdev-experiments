#!/usr/bin/env bun
// Exploratory analysis of /workspace/firehose-data/firehose-24h.jsonl. Single streaming pass that
// computes a bunch of distributions to surface filter ideas.

import { type Facet, type ReplyRef } from "./classify";

const INPUT_FILE = "/workspace/firehose-data/firehose-24h.jsonl";
const APPVIEW = "https://api.bsky.app";

interface PostEvent {
  did: string;
  rkey?: string;
  text: string;
  facets?: Facet[];
  reply?: ReplyRef;
  createdAt?: string;
  langs?: string[];
  embed?: { $type?: string; external?: { uri?: string } };
  tags?: string[];
}

function linkFacets(facets?: Facet[]) {
  if (!facets) return [];
  const out: { byteStart: number; byteEnd: number; uri: string }[] = [];
  for (const f of facets) {
    for (const x of f.features) {
      if (x.$type === "app.bsky.richtext.facet#link") {
        out.push({ ...f.index, uri: (x as any).uri ?? "" });
      }
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
  let bp = 0;
  let total = 0;
  let covd = 0;
  for (const ch of text) {
    const len = encoder.encode(ch).length;
    if (!/\s/.test(ch)) {
      total++;
      let any = false;
      for (let i = bp; i < bp + len; i++) if (covered[i]) { any = true; break; }
      if (any) covd++;
    }
    bp += len;
  }
  if (total === 0) return 1;
  return covd / total;
}

function topN<K>(m: Map<K, number>, n: number): [K, number][] {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function bump<K>(m: Map<K, number>, k: K, n = 1) {
  m.set(k, (m.get(k) ?? 0) + n);
}

const HEADER_RE = /^\s*([A-Za-zÀ-ÿ]+)\s*[:\-—]/u;

async function main() {
  const start = Date.now();

  let total = 0;
  let replies = 0;
  let withFacets = 0;
  let withLinks = 0;
  let withEmbed = 0;
  let withEmbedExternal = 0;
  let withLangs = 0;

  const linkCountDist = new Map<number, number>();
  const langDist = new Map<string, number>();
  const embedTypeDist = new Map<string, number>();
  const ge4Domains = new Map<string, number>();
  const ge4Headers = new Map<string, number>();
  const ge4SelfReplyDomains = new Map<string, number>();
  const ge4AuthorPosts = new Map<string, number>();
  const ge4SelfReplyAuthors = new Map<string, number>();
  const ge4CoverageBuckets = new Map<string, number>();
  const ge4TextLenBuckets = new Map<string, number>();

  // Categories tracked: derived later
  let ge3 = 0, ge4 = 0;
  let ge3Reply = 0, ge4Reply = 0;
  let ge3SelfReply = 0, ge4SelfReply = 0;
  let ge4Quote = 0;

  // Sample "weird" posts
  const longestUrlListSamples: { uri: string; text: string; links: number }[] = [];

  const file = Bun.file(INPUT_FILE);
  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  console.log(`reading ${(file.size / 1024 / 1024).toFixed(0)} MB ...`);

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
      try {
        p = JSON.parse(line);
      } catch {
        continue;
      }
      total++;

      const lf = linkFacets(p.facets);
      const lc = lf.length;
      const ir = isReply(p.reply);
      const isSelfReply =
        ir &&
        p.reply?.parent?.uri != null &&
        parseDidFromAtUri(p.reply.parent.uri) === p.did;
      const isQuote =
        p.embed?.$type === "app.bsky.embed.record" ||
        p.embed?.$type === "app.bsky.embed.recordWithMedia";

      if (ir) replies++;
      if (p.facets) withFacets++;
      if (lc > 0) withLinks++;
      if (p.embed) {
        withEmbed++;
        bump(embedTypeDist, p.embed.$type ?? "(unknown)");
      }
      if (p.embed?.external) withEmbedExternal++;
      if (p.langs && p.langs.length > 0) {
        withLangs++;
        for (const l of p.langs) bump(langDist, l);
      }
      bump(linkCountDist, lc);

      if (lc >= 3) ge3++;
      if (lc >= 4) {
        ge4++;
        bump(ge4AuthorPosts, p.did);
        for (const f of lf) bump(ge4Domains, tld(f.uri));
        const m = HEADER_RE.exec(p.text);
        if (m) bump(ge4Headers, m[1].toLowerCase());
        // coverage histogram
        const cov = charCoverage(p.text, lf);
        const bucket =
          cov >= 0.95 ? "95-100%" :
          cov >= 0.9 ? "90-95%" :
          cov >= 0.8 ? "80-90%" :
          cov >= 0.7 ? "70-80%" :
          cov >= 0.5 ? "50-70%" :
          cov >= 0.3 ? "30-50%" :
          "<30%";
        bump(ge4CoverageBuckets, bucket);
        // text length histogram
        const tl = p.text.length;
        const tlb =
          tl < 50 ? "<50" :
          tl < 100 ? "50-100" :
          tl < 200 ? "100-200" :
          tl < 300 ? "200-300" :
          ">=300";
        bump(ge4TextLenBuckets, tlb);
        // sample top
        if (longestUrlListSamples.length < 10 || lc > longestUrlListSamples[longestUrlListSamples.length - 1].links) {
          longestUrlListSamples.push({
            uri: `at://${p.did}/app.bsky.feed.post/${p.rkey ?? ""}`,
            text: p.text.slice(0, 200),
            links: lc,
          });
          longestUrlListSamples.sort((a, b) => b.links - a.links);
          if (longestUrlListSamples.length > 10) longestUrlListSamples.length = 10;
        }
      }
      if (lc >= 3 && ir) ge3Reply++;
      if (lc >= 4 && ir) ge4Reply++;
      if (lc >= 3 && isSelfReply) ge3SelfReply++;
      if (lc >= 4 && isSelfReply) {
        ge4SelfReply++;
        bump(ge4SelfReplyAuthors, p.did);
        for (const f of lf) bump(ge4SelfReplyDomains, tld(f.uri));
      }
      if (lc >= 4 && isQuote) ge4Quote++;

      if (total % 500_000 === 0) {
        process.stdout.write(
          `\r  ${total.toLocaleString()} commits in ${((Date.now() - start) / 1000).toFixed(0)}s`,
        );
      }
    }
  }
  console.log(`\nread ${total.toLocaleString()} commits in ${((Date.now() - start) / 1000).toFixed(0)}s`);

  // ---- report ----

  console.log("\n=== overall ===");
  console.log(`total post commits         ${total.toLocaleString()}`);
  console.log(`replies (any)              ${replies.toLocaleString()} (${((replies / total) * 100).toFixed(1)}%)`);
  console.log(`with facets                ${withFacets.toLocaleString()} (${((withFacets / total) * 100).toFixed(1)}%)`);
  console.log(`with >=1 link facet        ${withLinks.toLocaleString()} (${((withLinks / total) * 100).toFixed(1)}%)`);
  console.log(`with embed                 ${withEmbed.toLocaleString()} (${((withEmbed / total) * 100).toFixed(1)}%)`);
  console.log(`with embed.external        ${withEmbedExternal.toLocaleString()} (${((withEmbedExternal / total) * 100).toFixed(1)}%)`);
  console.log(`with langs                 ${withLangs.toLocaleString()} (${((withLangs / total) * 100).toFixed(1)}%)`);

  console.log("\n=== link facet count distribution ===");
  for (const [c, n] of [...linkCountDist.entries()].sort((a, b) => a[0] - b[0])) {
    if (n >= 10 || c >= 4) {
      console.log(`  ${c.toString().padStart(3)} link${c === 1 ? " " : "s"}: ${n.toString().padStart(8)}`);
    }
  }

  console.log("\n=== embed types (top 12) ===");
  for (const [k, n] of topN(embedTypeDist, 12)) {
    console.log(`  ${k.toString().padEnd(45)} ${n.toLocaleString().padStart(9)}`);
  }

  console.log("\n=== top langs (top 12) ===");
  for (const [k, n] of topN(langDist, 12)) {
    console.log(`  ${k.toString().padEnd(8)} ${n.toLocaleString().padStart(9)}`);
  }

  console.log("\n=== matching counts (raw, no bot filter) ===");
  const printRow = (label: string, n: number) =>
    console.log(`  ${label.padEnd(35)} ${n.toString().padStart(8)} (${((n / total) * 100).toFixed(3)}%)`);
  printRow(">=3 links", ge3);
  printRow(">=4 links", ge4);
  printRow(">=3 links + is reply (anyone)", ge3Reply);
  printRow(">=4 links + is reply (anyone)", ge4Reply);
  printRow(">=3 links + is self-reply", ge3SelfReply);
  printRow(">=4 links + is self-reply", ge4SelfReply);
  printRow(">=4 links + is quote post", ge4Quote);

  console.log("\n=== self-reply vs other-reply rate for >=4-link replies ===");
  const otherReply = ge4Reply - ge4SelfReply;
  console.log(`  self-reply  ${ge4SelfReply.toLocaleString().padStart(6)} (${((ge4SelfReply / ge4Reply) * 100).toFixed(1)}%)`);
  console.log(`  other-reply ${otherReply.toLocaleString().padStart(6)} (${((otherReply / ge4Reply) * 100).toFixed(1)}%)`);

  console.log("\n=== char-coverage histogram for >=4-link posts ===");
  for (const bucket of ["95-100%", "90-95%", "80-90%", "70-80%", "50-70%", "30-50%", "<30%"]) {
    const n = ge4CoverageBuckets.get(bucket) ?? 0;
    console.log(`  ${bucket.padEnd(8)} ${n.toLocaleString().padStart(8)} (${((n / ge4) * 100).toFixed(1)}%)`);
  }

  console.log("\n=== text-length histogram for >=4-link posts ===");
  for (const bucket of ["<50", "50-100", "100-200", "200-300", ">=300"]) {
    const n = ge4TextLenBuckets.get(bucket) ?? 0;
    console.log(`  ${bucket.padEnd(8)} ${n.toLocaleString().padStart(8)} (${((n / ge4) * 100).toFixed(1)}%)`);
  }

  console.log("\n=== top domains in >=4-link posts (top 25) ===");
  for (const [k, n] of topN(ge4Domains, 25)) {
    console.log(`  ${k.padEnd(40)} ${n.toLocaleString().padStart(7)}`);
  }

  console.log("\n=== top domains in >=4-link SELF-REPLY posts (top 20) ===");
  for (const [k, n] of topN(ge4SelfReplyDomains, 20)) {
    console.log(`  ${k.padEnd(40)} ${n.toLocaleString().padStart(7)}`);
  }

  console.log("\n=== top header words in >=4-link posts (top 25) ===");
  for (const [k, n] of topN(ge4Headers, 25)) {
    console.log(`  ${k.padEnd(20)} ${n.toLocaleString().padStart(7)}`);
  }

  // Look up handles for top authors
  console.log("\n=== top >=4-link self-reply authors (handles) ===");
  const topSelfReplyAuthors = topN(ge4SelfReplyAuthors, 20);
  const dids = topSelfReplyAuthors.map(([d]) => d);
  const handles = await fetchHandles(dids);
  for (const [did, n] of topSelfReplyAuthors) {
    const h = handles.get(did) ?? "(unknown)";
    console.log(`  ${h.padEnd(40)} ${n.toString().padStart(4)}  ${did}`);
  }

  console.log("\n=== top >=4-link authors overall (top 20) ===");
  const topOverall = topN(ge4AuthorPosts, 20);
  const overallHandles = await fetchHandles(topOverall.map(([d]) => d));
  for (const [did, n] of topOverall) {
    const h = overallHandles.get(did) ?? "(unknown)";
    console.log(`  ${h.padEnd(40)} ${n.toString().padStart(4)}  ${did}`);
  }
}

async function fetchHandles(dids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < dids.length; i += 25) {
    const batch = dids.slice(i, i + 25);
    const params = new URLSearchParams();
    for (const did of batch) params.append("actors", did);
    try {
      const res = await fetch(`${APPVIEW}/xrpc/app.bsky.actor.getProfiles?${params}`);
      if (!res.ok) continue;
      const data = (await res.json()) as { profiles: { did: string; handle: string }[] };
      for (const p of data.profiles) out.set(p.did, p.handle);
    } catch {}
  }
  return out;
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
