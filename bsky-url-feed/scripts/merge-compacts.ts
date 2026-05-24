#!/usr/bin/env bun
// Merge two compact-viz JSONs into one, deduplicating by did:rkey.
// Newer first, so newer record wins on conflict.
//
// Env:
//   OLD_FILE  /workspace/firehose-data/compact-old.json
//   NEW_FILE  /workspace/firehose-data/compact-new.json
//   OUT_FILE  /workspace/firehose-data/compact-merged.json

const OLD_FILE = process.env.OLD_FILE ?? "/workspace/firehose-data/compact-old.json";
const NEW_FILE = process.env.NEW_FILE ?? "/workspace/firehose-data/compact-new.json";
const OUT_FILE = process.env.OUT_FILE ?? "/workspace/firehose-data/compact-merged.json";

interface Post {
  d: string;
  k: string;
  [key: string]: unknown;
}

interface Compact {
  capturedAt?: string;
  summary?: Record<string, unknown>;
  posts: Post[];
}

const oldD = (await Bun.file(OLD_FILE).json()) as Compact;
const newD = (await Bun.file(NEW_FILE).json()) as Compact;

const seen = new Set<string>();
const out: Post[] = [];
for (const p of newD.posts) {
  const k = `${p.d}:${p.k}`;
  if (!seen.has(k)) {
    seen.add(k);
    out.push(p);
  }
}
for (const p of oldD.posts) {
  const k = `${p.d}:${p.k}`;
  if (!seen.has(k)) {
    seen.add(k);
    out.push(p);
  }
}

const merged: Compact = {
  capturedAt: new Date().toISOString(),
  summary: {
    note: "union of committed compact + freshly-captured compact (deduped by did:rkey)",
    posts: out.length,
    oldPosts: oldD.posts.length,
    newPosts: newD.posts.length,
    newUnique: out.length - oldD.posts.length,
  },
  posts: out,
};

await Bun.write(OUT_FILE, JSON.stringify(merged));
console.log(`merged: ${out.length.toLocaleString()} posts (old ${oldD.posts.length.toLocaleString()} + new unique ${(out.length - oldD.posts.length).toLocaleString()})`);
