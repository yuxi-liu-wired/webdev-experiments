#!/usr/bin/env bun
// Run the mention bot as a long-lived in-box process — the same pollOnce the
// Netlify function calls, on the same five-minute heartbeat, but visible and
// killable. The box's egress proxy carries all of it.
//
//   BOT_IDENTIFIER=found-haiku.bsky.social \
//   BOT_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
//   BOT_PINNED_URL=https://bsky.app/profile/.../post/... \
//   bun bot/daemon.mjs
//
// Errors back off and retry; the session cache in bsky.js persists across
// polls, so createSession stays rare.

import { pollOnce } from './run.js';

const INTERVAL = Number(process.env.BOT_POLL_SEC || 300) * 1000;
const stamp = () => new Date().toISOString().slice(11, 19);

console.log(`found-haiku bot daemon · polling every ${INTERVAL / 1000}s`);
let failures = 0;
for (;;) {
  try {
    const r = await pollOnce(process.env, (m) => console.log(`[${stamp()}] ${m}`));
    failures = 0;
    if (r.mentions) console.log(`[${stamp()}] ${r.answered}/${r.mentions} mentions answered`);
  } catch (e) {
    failures++;
    console.error(`[${stamp()}] poll failed (${failures}): ${e.message}`);
  }
  // linear backoff on repeated failure, capped at five intervals
  await new Promise((r) => setTimeout(r, INTERVAL * Math.min(1 + failures, 5)));
}
