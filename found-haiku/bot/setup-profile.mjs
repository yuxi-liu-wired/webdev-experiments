#!/usr/bin/env bun
// One-time setup, run with BOT_IDENTIFIER/BOT_APP_PASSWORD set:
// logs in, sets the profile (name, bio), posts the usage post with a link
// facet, pins it, and prints the BOT_PINNED_URL for the daemon.

import { ensureSession } from './bsky.js';
import { graphemes } from './compose.js';

const PDS = process.env.BOT_PDS || 'https://bsky.social';
const SITE = 'https://found-haiku.netlify.app';

const s = await ensureSession(process.env);
console.log(`logged in as @${s.handle} (${s.did})`);

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

// --- the usage post ---------------------------------------------------------
const text = `I find accidental poems. Mention me:
@${s.handle} → a haiku from your posts
add tanka, tanaga, or digits 3-9 per line (577 = 5-7-7)
add @someone to search their posts instead
Syllables counted against the CMU pronouncing dictionary.
Engine: found-haiku.netlify.app`;

if (graphemes(text) > 300) throw new Error(`usage post is ${graphemes(text)} graphemes`);

const enc = (str) => new TextEncoder().encode(str).length;
const linkText = 'found-haiku.netlify.app';
const linkStart = enc(text) - enc(linkText);
const mentionText = `@${s.handle}`;
const mentionStart = enc(text.slice(0, text.indexOf(mentionText)));

const post = await xrpc('com.atproto.repo.createRecord', {
  repo: s.did,
  collection: 'app.bsky.feed.post',
  record: {
    $type: 'app.bsky.feed.post',
    text,
    langs: ['en'],
    createdAt: new Date().toISOString(),
    facets: [
      {
        index: { byteStart: linkStart, byteEnd: linkStart + enc(linkText) },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: SITE }],
      },
      {
        index: { byteStart: mentionStart, byteEnd: mentionStart + enc(mentionText) },
        features: [{ $type: 'app.bsky.richtext.facet#mention', did: s.did }],
      },
    ],
  },
});
console.log(`usage post: ${post.uri}`);

// --- profile with the post pinned -------------------------------------------
let existing = null;
try {
  const r = await fetch(`${PDS}/xrpc/com.atproto.repo.getRecord?repo=${s.did}&collection=app.bsky.actor.profile&rkey=self`,
    { headers: { Authorization: `Bearer ${s.accessJwt}` } });
  if (r.ok) existing = await r.json();
} catch { /* no profile yet */ }

await xrpc('com.atproto.repo.putRecord', {
  repo: s.did,
  collection: 'app.bsky.actor.profile',
  rkey: 'self',
  ...(existing?.cid ? { swapRecord: existing.cid } : {}),
  record: {
    ...(existing?.value || {}),
    $type: 'app.bsky.actor.profile',
    displayName: 'found haiku',
    description: 'poems already hiding in ordinary prose — mention me for yours. '
      + 'strict rules, measured rarity, occasional shinies.\n'
      + 'engine: found-haiku.netlify.app',
    pinnedPost: { uri: post.uri, cid: post.cid },
  },
});
console.log('profile set, post pinned');

const rkey = post.uri.split('/').pop();
console.log(`\nBOT_PINNED_URL=https://bsky.app/profile/${s.handle}/post/${rkey}`);
