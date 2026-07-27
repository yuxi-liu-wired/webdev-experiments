#!/usr/bin/env bun
// Rehearse the bot on a made-up mention, printing the reply instead of
// posting it. Exercises the real read path: command parsing, handle
// resolution, feed fetching, and the finder.
//
//   bun bot/dry-run.mjs "@found-haiku tanka @bsky.app"
//   BYPARR_URL=http://byparr:8191 bun bot/dry-run.mjs "577 @bsky.app"
//
// The author of the pretend mention defaults to @bsky.app, so a command with
// no @someone searches that account; override with AUTHOR=handle.

import { replyFor } from './run.js';
import { resolveHandle } from './bsky.js';

const text = process.argv[2] || '@found-haiku';
const author = process.env.AUTHOR || 'bsky.app';

const did = await resolveHandle(author);
if (!did) {
  console.error(`pretend author @${author} does not resolve`);
  process.exit(1);
}

const mention = {
  uri: `at://${did}/app.bsky.feed.post/dryrun`,
  cid: 'dryrun',
  author: { did, handle: author },
  record: { text, facets: null },
};

console.log(`mention by @${author}: ${JSON.stringify(text)}\n`);
const reply = await replyFor(mention, ['found-haiku', 'found-haiku.bsky.social'], process.env);
if (reply.thread) {
  for (const [i, r] of reply.thread.entries()) {
    console.log(`--- stanza post ${i + 1} ---`);
    console.log(r.text);
  }
} else {
  console.log('--- reply text ---');
  console.log(reply.text);
  if (reply.facets) {
    console.log('--- facets ---');
    console.log(JSON.stringify(reply.facets));
  }
}
