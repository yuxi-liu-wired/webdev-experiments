#!/usr/bin/env bun
// Set the bot's avatar: upload a PNG blob, write it into the profile record.
//   bun tools/set-avatar.mjs /tmp/avatar-E.png

import { readFileSync } from 'node:fs';
import { ensureSession } from '../bot/bsky.js';

const path = process.argv[2];
if (!path) {
  console.error('usage: bun tools/set-avatar.mjs image.png');
  process.exit(2);
}
const PDS = process.env.BOT_PDS || 'https://bsky.social';
const s = await ensureSession(process.env);

const bytes = readFileSync(path);
console.log(`uploading ${bytes.length.toLocaleString()} bytes as @${s.handle}'s face`);
const up = await fetch(`${PDS}/xrpc/com.atproto.repo.uploadBlob`, {
  method: 'POST',
  headers: { 'Content-Type': 'image/png', Authorization: `Bearer ${s.accessJwt}` },
  body: bytes,
});
const blob = await up.json();
if (!up.ok) throw new Error(blob.message || `uploadBlob ${up.status}`);

const prof = await fetch(`${PDS}/xrpc/com.atproto.repo.getRecord?repo=${s.did}&collection=app.bsky.actor.profile&rkey=self`,
  { headers: { Authorization: `Bearer ${s.accessJwt}` } }).then((r) => r.json());

const put = await fetch(`${PDS}/xrpc/com.atproto.repo.putRecord`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.accessJwt}` },
  body: JSON.stringify({
    repo: s.did,
    collection: 'app.bsky.actor.profile',
    rkey: 'self',
    swapRecord: prof.cid,
    record: { ...prof.value, avatar: blob.blob },
  }),
});
if (!put.ok) throw new Error((await put.json()).message || `putRecord ${put.status}`);
console.log('avatar set');
