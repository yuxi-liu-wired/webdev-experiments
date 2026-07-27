#!/usr/bin/env bun
// Replace the pinned stub with a proper usage thread: the invocation post
// (pinned) plus two replies covering the rules and the engine. Deletes the
// old pinned post, prints the new BOT_PINNED_URL.
//
//   OLD_PINNED_RKEY=... bun bot/post-usage.mjs

import { ensureSession } from './bsky.js';
import { graphemes } from './compose.js';

const PDS = process.env.BOT_PDS || 'https://bsky.social';
const SITE = 'https://found-haiku.netlify.app';

const s = await ensureSession(process.env);
console.log(`logged in as @${s.handle}`);

async function xrpc(path, body) {
  const res = await fetch(`${PDS}/xrpc/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.accessJwt}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${data.message || res.status}`);
  return data;
}

const enc = (str) => new TextEncoder().encode(str).length;

/** facets for every literal @handle mention and for the site link */
function facetsFor(text) {
  const out = [];
  const handle = `@${s.handle}`;
  let at = 0;
  while ((at = text.indexOf(handle, at)) !== -1) {
    const start = enc(text.slice(0, at));
    out.push({
      index: { byteStart: start, byteEnd: start + enc(handle) },
      features: [{ $type: 'app.bsky.richtext.facet#mention', did: s.did }],
    });
    at += handle.length;
  }
  const link = 'found-haiku.netlify.app';
  const li = text.lastIndexOf(link);
  if (li !== -1) {
    const start = enc(text.slice(0, li));
    out.push({
      index: { byteStart: start, byteEnd: start + enc(link) },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: SITE }],
    });
  }
  return out;
}

async function post(text, reply) {
  if (graphemes(text) > 300) throw new Error(`${graphemes(text)} graphemes: ${text.slice(0, 40)}...`);
  return xrpc('com.atproto.repo.createRecord', {
    repo: s.did,
    collection: 'app.bsky.feed.post',
    record: {
      $type: 'app.bsky.feed.post',
      text,
      langs: ['en'],
      createdAt: new Date().toISOString(),
      facets: facetsFor(text),
      ...(reply ? { reply } : {}),
    },
  });
}

const p1 = await post(
`how to summon me:

@${s.handle} → I search your posts for an accidental haiku and reply with it

add @someone → search their posts instead
add a form → tanka, tanaga, or digits 3-9 per line (577 = 5-7-7)

slots go in any order. I only find poems nobody meant to write.`);

const ref1 = { uri: p1.uri, cid: p1.cid };
const p2 = await post(
`my rules are strict: every word in the dictionary, syllables unambiguous, no line ending on a stopword — and never a poem the author already punctuated into lines. found means found.

rare finds carry badges (iambic, rhymed, kigo, 山脈…) and a shininess measured against millions of real posts.`,
  { root: ref1, parent: ref1 });

await post(
`try the engine on any text — paste prose, or mine a bluesky account, ranked shiniest first:
found-haiku.netlify.app

errors get exact replies. if I say your format is not allowed, this thread is the manual.`,
  { root: ref1, parent: { uri: p2.uri, cid: p2.cid } });

// pin the thread root
const prof = await fetch(`${PDS}/xrpc/com.atproto.repo.getRecord?repo=${s.did}&collection=app.bsky.actor.profile&rkey=self`,
  { headers: { Authorization: `Bearer ${s.accessJwt}` } }).then((r) => r.json());
await xrpc('com.atproto.repo.putRecord', {
  repo: s.did,
  collection: 'app.bsky.actor.profile',
  rkey: 'self',
  swapRecord: prof.cid,
  record: { ...prof.value, pinnedPost: ref1 },
});
console.log('thread posted, root pinned');

// remove the stub it replaces
const old = process.env.OLD_PINNED_RKEY;
if (old) {
  await xrpc('com.atproto.repo.deleteRecord', {
    repo: s.did, collection: 'app.bsky.feed.post', rkey: old,
  });
  console.log(`old stub ${old} deleted`);
}

console.log(`\nBOT_PINNED_URL=https://bsky.app/profile/${s.handle}/post/${p1.uri.split('/').pop()}`);
