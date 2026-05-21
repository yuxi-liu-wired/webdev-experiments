#!/usr/bin/env bun
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { classify, type Facet } from "./classify";

const PUBLIC_API = "https://api.bsky.app";
const STATE_FILE = "./state/seen.json";
const SKELETON_FILE = "./public/xrpc/app.bsky.feed.getFeedSkeleton";
const MAX_FEED_ITEMS = 200;
const MAX_PAGES_PER_QUERY = 8;
const PER_PAGE = 100;
const OVERLAP_HOURS = 1;

const QUERY_TERMS = [
  "wikipedia.org",
  "arxiv.org",
  "github.com",
  "youtube.com",
  "youtu.be",
  "substack.com",
  "medium.com",
  "stanford.edu",
  "archive.org",
  "sources",
  "references",
  "reading",
];

interface SeenItem {
  uri: string;
  cid: string;
  createdAt: string;
  indexedAt: string;
}

interface State {
  lastRun: string | null;
  items: SeenItem[];
}

interface SearchPost {
  uri: string;
  cid: string;
  record: { text?: string; facets?: Facet[]; createdAt?: string };
  indexedAt: string;
}

interface SearchResponse {
  posts: SearchPost[];
  cursor?: string;
}

async function loadState(): Promise<State> {
  try {
    const data = await readFile(STATE_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { lastRun: null, items: [] };
  }
}

async function saveState(state: State): Promise<void> {
  if (!existsSync("./state")) await mkdir("./state", { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string, retries = 3): Promise<Response | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "bsky-url-feed/0.1" } });
    if (res.ok) return res;
    if (res.status === 403 || res.status === 429) {
      const wait = 2000 * 2 ** attempt;
      await sleep(wait);
      continue;
    }
    return res;
  }
  return null;
}

async function searchSince(query: string, since: string): Promise<SearchPost[]> {
  const collected: SearchPost[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES_PER_QUERY; page++) {
    const params = new URLSearchParams({
      q: query,
      sort: "latest",
      limit: String(PER_PAGE),
      since,
    });
    if (cursor) params.set("cursor", cursor);
    const res = await fetchWithRetry(
      `${PUBLIC_API}/xrpc/app.bsky.feed.searchPosts?${params}`,
    );
    if (!res || !res.ok) {
      console.warn(`  search "${query}" page ${page}: ${res?.status ?? "no-response"}`);
      break;
    }
    const data = (await res.json()) as SearchResponse;
    collected.push(...data.posts);
    cursor = data.cursor;
    if (!cursor || data.posts.length < PER_PAGE) break;
    await sleep(300);
  }
  return collected;
}

async function ingest(): Promise<void> {
  const state = await loadState();
  const now = new Date();
  const sinceDate = state.lastRun
    ? new Date(new Date(state.lastRun).getTime() - OVERLAP_HOURS * 3_600_000)
    : new Date(now.getTime() - 24 * 3_600_000);
  const since = sinceDate.toISOString();

  console.log(`[ingest] window: ${since} → ${now.toISOString()}`);
  console.log(`[ingest] existing items: ${state.items.length}`);

  const seenUris = new Set(state.items.map((i) => i.uri));
  const candidates = new Map<string, SearchPost>();

  for (const q of QUERY_TERMS) {
    const posts = await searchSince(q, since);
    for (const p of posts) {
      if (!seenUris.has(p.uri)) candidates.set(p.uri, p);
    }
    console.log(`  "${q}": +${posts.length} (${candidates.size} unique new)`);
  }

  let added = 0;
  let classified = 0;
  for (const p of candidates.values()) {
    classified++;
    const result = classify({
      text: p.record.text ?? "",
      facets: p.record.facets,
    });
    if (result.isUrlList) {
      state.items.push({
        uri: p.uri,
        cid: p.cid,
        createdAt: p.record.createdAt ?? p.indexedAt,
        indexedAt: p.indexedAt,
      });
      added++;
      console.log(
        `  + ${p.uri.split("/").pop()} (${result.linkCount} links, ${(result.coverage * 100).toFixed(0)}% coverage)`,
      );
    }
  }

  console.log(`[ingest] classified ${classified}, matched ${added}`);

  state.items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  state.items = state.items.slice(0, MAX_FEED_ITEMS);
  state.lastRun = now.toISOString();

  await saveState(state);

  if (!existsSync("./public/xrpc")) {
    await mkdir("./public/xrpc", { recursive: true });
  }
  const skeleton = {
    feed: state.items.map((i) => ({ post: i.uri })),
  };
  await writeFile(SKELETON_FILE, JSON.stringify(skeleton, null, 2));
  console.log(`[ingest] wrote ${state.items.length} items to ${SKELETON_FILE}`);
}

ingest().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
