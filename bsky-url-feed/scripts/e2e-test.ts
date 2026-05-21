#!/usr/bin/env bun
// End-to-end test that simulates what the Bluesky AppView does:
//  1. GET /.well-known/did.json (DID resolution)
//  2. GET /xrpc/app.bsky.feed.describeFeedGenerator
//  3. GET /xrpc/app.bsky.feed.getFeedSkeleton
//  4. Hydrate every returned URI via public AppView (proves they render).
//
// Run `bun run scripts/serve-local.ts` in another shell first, or pass
// HOST=https://your-deploy.pages.dev to test against the real deploy.

const HOST = process.env.HOST ?? "http://localhost:8087";
const HYDRATE_HOST = "https://api.bsky.app";

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    console.log(`  ✗ ${name}  ${detail}`);
    failures++;
  }
}

async function fetchJson(url: string): Promise<{
  status: number;
  ct: string;
  body: unknown;
}> {
  const res = await fetch(url);
  const ct = res.headers.get("content-type") ?? "";
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, ct, body };
}

console.log(`E2E test against ${HOST}\n`);

console.log("[1] did:web resolution");
{
  const r = await fetchJson(`${HOST}/.well-known/did.json`);
  check("status 200", r.status === 200, `got ${r.status}`);
  check("application/json content-type", r.ct.includes("application/json"), `got "${r.ct}"`);
  const doc = r.body as { id?: string; service?: { type: string; serviceEndpoint: string }[] };
  check("doc has id", !!doc?.id);
  check("id matches did:web format", doc?.id?.startsWith("did:web:") ?? false);
  const svc = doc?.service?.find((s) => s.type === "BskyFeedGenerator");
  check("has BskyFeedGenerator service entry", !!svc);
  check("serviceEndpoint is HTTPS", svc?.serviceEndpoint?.startsWith("https://") ?? false);
}

console.log("\n[2] describeFeedGenerator");
let feedUri: string | undefined;
{
  const r = await fetchJson(`${HOST}/xrpc/app.bsky.feed.describeFeedGenerator`);
  check("status 200", r.status === 200, `got ${r.status}`);
  check("application/json content-type", r.ct.includes("application/json"), `got "${r.ct}"`);
  const d = r.body as { did?: string; feeds?: { uri: string }[] };
  check("has did", !!d?.did);
  check("has ≥1 feed", (d?.feeds?.length ?? 0) >= 1);
  feedUri = d?.feeds?.[0]?.uri;
  check(
    "feed uri is at:// app.bsky.feed.generator",
    feedUri?.startsWith("at://") === true &&
      feedUri.includes("app.bsky.feed.generator/") === true,
  );
}

console.log("\n[3] getFeedSkeleton");
let skeletonFeed: { post: string }[] = [];
{
  const url = `${HOST}/xrpc/app.bsky.feed.getFeedSkeleton?feed=${encodeURIComponent(feedUri ?? "")}&limit=30`;
  const r = await fetchJson(url);
  check("status 200", r.status === 200, `got ${r.status}`);
  check("application/json content-type", r.ct.includes("application/json"), `got "${r.ct}"`);
  const s = r.body as { feed?: { post: string }[] };
  check("has feed array", Array.isArray(s?.feed));
  skeletonFeed = s?.feed ?? [];
  check("feed not empty (after at least one ingest run)", skeletonFeed.length > 0);
  check(
    "all entries are {post: at://...}",
    skeletonFeed.every((e) => typeof e.post === "string" && e.post.startsWith("at://")),
  );
}

console.log("\n[4] hydrate every URI (proves AppView could render the feed)");
if (skeletonFeed.length > 0) {
  const sample = skeletonFeed.slice(0, 25); // AppView default page size
  const uris = sample.map((e) => e.post);
  const params = new URLSearchParams();
  for (const u of uris) params.append("uris", u);
  const url = `${HYDRATE_HOST}/xrpc/app.bsky.feed.getPosts?${params}`;
  const r = await fetchJson(url);
  check("getPosts status 200", r.status === 200, `got ${r.status}`);
  const h = r.body as { posts?: { uri: string }[] };
  const returned = new Set(h?.posts?.map((p) => p.uri) ?? []);
  check(
    `all ${uris.length} URIs hydrated`,
    uris.every((u) => returned.has(u)),
    `missing: ${uris.filter((u) => !returned.has(u)).length}`,
  );
}

console.log(`\n${failures === 0 ? "PASS" : "FAIL"} (${failures} failure${failures === 1 ? "" : "s"})`);
process.exit(failures === 0 ? 0 : 1);
