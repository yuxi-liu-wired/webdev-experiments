#!/usr/bin/env bun
// Analyze the JSONL produced by dry-test-24h.ts.

import { isBotAuthor, type Facet, type ReplyRef } from "./classify";

const INPUT_FILE = "/workspace/firehose-data/firehose-24h.jsonl";
const APPVIEW = "https://api.bsky.app";

interface PostEvent {
  did: string;
  text: string;
  facets?: Facet[];
  reply?: ReplyRef;
  createdAt?: string;
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
    if (i % 500 === 0) {
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
  const start = Date.now();

  let totalCommits = 0;
  let isReplyCount = 0;
  const counts: Record<FilterName, number> = {
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

  // Streaming JSONL read
  const file = Bun.file(INPUT_FILE);
  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  console.log(`reading ${(file.size / 1024 / 1024).toFixed(0)} MB from ${INPUT_FILE}...`);

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let post: PostEvent;
      try {
        post = JSON.parse(line);
      } catch {
        continue;
      }
      totalCommits++;
      const lc = linkFacetCount(post.facets);
      const ir = isReply(post.reply);
      if (ir) isReplyCount++;
      if (lc >= 3) {
        counts[">=3 links"]++;
        const m = authorCounts[">=3 links"];
        m.set(post.did, (m.get(post.did) ?? 0) + 1);
      }
      if (lc >= 4) {
        counts[">=4 links"]++;
        const m = authorCounts[">=4 links"];
        m.set(post.did, (m.get(post.did) ?? 0) + 1);
      }
      if (lc >= 3 && ir) {
        counts[">=3 links + reply"]++;
        const m = authorCounts[">=3 links + reply"];
        m.set(post.did, (m.get(post.did) ?? 0) + 1);
      }
      if (lc >= 4 && ir) {
        counts[">=4 links + reply"]++;
        const m = authorCounts[">=4 links + reply"];
        m.set(post.did, (m.get(post.did) ?? 0) + 1);
      }
      if (totalCommits % 200000 === 0) {
        process.stdout.write(
          `\r  read ${totalCommits.toLocaleString().padStart(9)} commits in ${((Date.now() - start) / 1000).toFixed(0)}s`,
        );
      }
    }
  }
  console.log(`\nread ${totalCommits.toLocaleString()} commits in ${((Date.now() - start) / 1000).toFixed(0)}s`);

  const dids = new Set<string>();
  for (const m of Object.values(authorCounts)) for (const did of m.keys()) dids.add(did);
  console.log(`looking up ${dids.size.toLocaleString()} unique authors...`);
  const profiles = await fetchProfiles([...dids]);

  function nonBotPostsAndAuthors(name: FilterName): {
    posts: number;
    authors: number;
    botPosts: number;
    botAuthors: number;
  } {
    let posts = 0;
    let authors = 0;
    let botPosts = 0;
    let botAuthors = 0;
    for (const [did, postCount] of authorCounts[name]) {
      const p = profiles.get(did);
      const bot = p ? isBotAuthor(p.handle, p.labels) : false;
      if (bot) {
        botPosts += postCount;
        botAuthors++;
      } else {
        posts += postCount;
        authors++;
      }
    }
    return { posts, authors, botPosts, botAuthors };
  }

  console.log("");
  console.log(`24h: ${totalCommits.toLocaleString()} post commits (avg ${(totalCommits / 86400).toFixed(1)}/sec)`);
  console.log(`     ${isReplyCount.toLocaleString()} are replies to anyone (${((isReplyCount / totalCommits) * 100).toFixed(1)}%)`);
  console.log("");
  console.log("Filter                       | Raw      | NoBot   | NoBot/hr | Unique non-bot authors | Bot posts dropped");
  console.log("-----------------------------|----------|---------|----------|------------------------|-------------------");
  for (const f of [">=3 links", ">=4 links", ">=3 links + reply", ">=4 links + reply"] as FilterName[]) {
    const r = nonBotPostsAndAuthors(f);
    const perHr = (r.posts / 24).toFixed(1);
    console.log(
      `${f.padEnd(28)} | ${counts[f].toString().padStart(8)} | ${r.posts.toString().padStart(7)} | ${perHr.padStart(8)} | ${r.authors.toString().padStart(22)} | ${r.botPosts.toString().padStart(17)}`,
    );
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
