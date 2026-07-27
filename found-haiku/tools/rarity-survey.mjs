#!/usr/bin/env bun
// Stream a firehose capture and measure how rare each badge combination is.
//
//   bun tools/rarity-survey.mjs /workspace/firehose-data/relay-update-2026-06-03.jsonl
//
// Output: data/rarity.json — scanned counts, per-badge counts, per-mask
// counts, and the rarest specimens for eyeballing. This table is the bot's
// shininess measure: rarity of a find = posts scanned / finds carrying at
// least its badge set.
//
// The capture is link-posts-only (it was made for the url-feed), so these are
// relative rarities on a news-flavored corpus, not absolute firehose rates.

import { createReadStream, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { decodeExceptions, SyllableCounter } from '../public/src/syllables.js';
import { loadCmudict } from './meter-lib.mjs';
import { strictFinds, badges, badgeMask, uniqueness, stripLinks, BADGE_NAMES } from './strict-lib.mjs';
import { shininess, flair } from '../bot/shiny.js';

const path = process.argv[2];
if (!path) {
  console.error('usage: bun tools/rarity-survey.mjs capture.jsonl [limitPosts]');
  process.exit(2);
}
const LIMIT = Number(process.argv[3] || 0);

const counter = new SyllableCounter(decodeExceptions(
  readFileSync(new URL('../public/data/syllables.txt', import.meta.url).pathname, 'utf8')));
const cmudict = loadCmudict();

const stats = { scanned: 0, strictFinds: 0 };
const badgeCounts = Object.fromEntries(BADGE_NAMES.map((n) => [n, 0]));
const maskCounts = {};
const specimens = {}; // per mask, a few examples each — the rare ones all survive
const shinyCandidates = []; // every badged find, scored at the end against the full table
const t0 = performance.now();

const seenPosts = new Set(); // relay captures double-deliver; count each post once
const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line) continue;
  let post;
  try { post = JSON.parse(line); } catch { continue; }
  const original = post.text;
  if (!original) continue;
  if (post.did && post.rkey) {
    const id = `${post.did}/${post.rkey}`;
    if (seenPosts.has(id)) continue;
    seenPosts.add(id);
  }
  stats.scanned++;
  if (LIMIT && stats.scanned > LIMIT) break;
  if (stats.scanned % 250000 === 0) {
    const rate = stats.scanned / ((performance.now() - t0) / 1000);
    console.log(`  ${stats.scanned.toLocaleString()} posts · ${stats.strictFinds.toLocaleString()} finds · ${Math.round(rate)}/s`);
  }

  for (const find of strictFinds(stripLinks(original), counter)) {
    stats.strictFinds++;
    const b = badges(find, cmudict);
    const mask = badgeMask(b);
    maskCounts[mask] = (maskCounts[mask] || 0) + 1;
    for (const n of BADGE_NAMES) {
      if (b[n]) badgeCounts[n]++;
    }
    if (mask !== 'plain') {
      (specimens[mask] ||= []);
      if (specimens[mask].length < 5) {
        specimens[mask].push({
          lines: find.poem.lines.map((l) => l.text),
          url: post.did && post.rkey ? `https://bsky.app/profile/${post.did}/post/${post.rkey}` : null,
        });
      }
      shinyCandidates.push({
        lines: find.poem.lines.map((l) => l.text),
        badges: b,
        mask,
        u: uniqueness(find),
        url: post.did && post.rkey ? `https://bsky.app/profile/${post.did}/post/${post.rkey}` : null,
      });
    }
  }
}

const elapsed = (performance.now() - t0) / 1000;
console.log(`\n${stats.scanned.toLocaleString()} posts in ${Math.round(elapsed)}s · ${stats.strictFinds.toLocaleString()} strict finds`);
console.log('\nper badge:');
for (const n of BADGE_NAMES) {
  const c = badgeCounts[n];
  const rate = c ? `1 in ${Math.round(stats.scanned / c).toLocaleString()} posts` : 'never seen';
  console.log(`  ${n.padEnd(18)} ${String(c).padStart(6)}   ${rate}`);
}
console.log('\nper mask (multi-badge combinations):');
for (const [m, c] of Object.entries(maskCounts).sort((a, b) => a[1] - b[1])) {
  if (m !== 'plain' && m.includes('+')) console.log(`  ${String(c).padStart(6)}  ${m}`);
}

// score every badged find with the finished table, uniqueness-adjusted
const tableForScoring = { scanned: stats.scanned, masks: maskCounts };
const seenText = new Set();
const shinies = [];
for (const c of shinyCandidates) {
  const key = c.lines.join(' ').toLowerCase().replace(/\s+/g, ' ');
  if (seenText.has(key)) continue;
  seenText.add(key);
  const shine = shininess(tableForScoring, c.badges, c.u);
  shinies.push({ lines: c.lines, mask: c.mask, u: Number(c.u.toFixed(2)), shine, url: c.url });
}
shinies.sort((a, b) => b.shine.rarity - a.shine.rarity);
console.log('\nthe shiniest of the corpus (uniqueness-adjusted):\n');
for (const s of shinies.slice(0, 15)) {
  console.log(s.lines.map((l) => `  ${l}`).join('\n'));
  console.log(`      ${flair(s.shine)}  (u=${s.u})`);
  console.log(`      ${s.url || ''}\n`);
}

mkdirSync(new URL('../data', import.meta.url).pathname, { recursive: true });
const out = {
  source: path,
  capturedBias: 'link-posts only (url-feed capture)',
  scanned: stats.scanned,
  strictFinds: stats.strictFinds,
  badges: badgeCounts,
  masks: maskCounts,
  specimens,
  topShinies: shinies.slice(0, 100),
};
const dest = new URL('../data/rarity.json', import.meta.url).pathname;
writeFileSync(dest, JSON.stringify(out, null, 1));
console.log(`\nwritten: ${dest}`);
