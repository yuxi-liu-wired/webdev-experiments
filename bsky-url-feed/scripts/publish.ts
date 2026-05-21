#!/usr/bin/env bun
// One-shot script: writes the app.bsky.feed.generator record to the
// publishing account's repo. After this, the feed exists and is pinnable
// at https://bsky.app/profile/<handle>/feed/<RKEY>.
//
// Re-running with the same RKEY updates the record (idempotent).
//
//   BSKY_HANDLE=you.bsky.social \
//   BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
//   bun run scripts/publish.ts
//
// Add --dry-run to print the record without writing.

import { AtpAgent } from "@atproto/api";
import { readFile } from "fs/promises";

const RKEY = process.env.FEED_RKEY ?? "url-lists";
const DISPLAY_NAME = process.env.FEED_NAME ?? "URL lists";
const DESCRIPTION =
  process.env.FEED_DESC ??
  "Posts whose text is mostly a list of links — bibliographies, link dumps, sources.";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // Pull the feed-generator DID from the same did.json the service will serve.
  const didDoc = JSON.parse(await readFile("./public/.well-known/did.json", "utf-8"));
  const feedGenDid: string = didDoc.id;
  if (!feedGenDid?.startsWith("did:")) {
    throw new Error(`Bad did.json: id=${feedGenDid}`);
  }

  const record = {
    $type: "app.bsky.feed.generator" as const,
    did: feedGenDid,
    displayName: DISPLAY_NAME,
    description: DESCRIPTION,
    createdAt: new Date().toISOString(),
  };

  console.log("Record to publish:");
  console.log(JSON.stringify(record, null, 2));

  if (dryRun) {
    console.log("\n--dry-run: not writing.");
    return;
  }

  const handle = process.env.BSKY_HANDLE;
  const password = process.env.BSKY_APP_PASSWORD;
  if (!handle || !password) {
    console.error(
      "Set BSKY_HANDLE and BSKY_APP_PASSWORD env vars.\nGet an app password: https://bsky.app/settings/app-passwords",
    );
    process.exit(1);
  }

  const agent = new AtpAgent({ service: "https://bsky.social" });
  await agent.login({ identifier: handle, password });
  const did = agent.session!.did;
  console.log(`\nLogged in as ${handle} (${did})`);

  const res = await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: "app.bsky.feed.generator",
    rkey: RKEY,
    record,
  });

  console.log(`\nFeed published: ${res.data.uri}`);
  console.log(`Subscribe URL:  https://bsky.app/profile/${handle}/feed/${RKEY}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
