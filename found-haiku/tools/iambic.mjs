#!/usr/bin/env bun
// Accidental iambic pentameter in a Bluesky account's posts.
//
//   BYPARR_URL=http://byparr:8191 bun tools/iambic.mjs handle [handle...]
//
// CMUdict's stress digits — which the syllable build throws away — are the
// whole trick: each word becomes a string of 0/1/2 per syllable, and a run of
// words scans as pentameter when some choice of pronunciation variants puts
// every primary stress (1) of a polysyllabic word on a strong beat (positions
// 2,4,6,8,10) and every unstressed syllable (0) on a weak one. Secondary
// stress (2) and monosyllables go either way, which is how human scansion
// treats them. Runs may cross commas — verse always has — but not sentence
// ends or line breaks, and never two posts.

import { readFileSync } from 'node:fs';
import { segment } from '../public/src/finder.js';
import { atUriToUrl } from '../public/src/posts.js';
import { resolveHandle, authorPosts } from '../bot/bsky.js';

const TARGET = 10;         // syllables in the line
const MIN_POLY = 2;        // polysyllabic words required, else all-monosyllable mush scans
const PER_ACCOUNT = 8;

// --- stress dictionary ------------------------------------------------------

function loadStress() {
  const raw = readFileSync(new URL('./cmudict.dict', import.meta.url).pathname, 'utf8');
  const map = new Map();
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith(';;;')) continue;
    const body = (line.split('#')[0] || '').trim();
    const sp = body.indexOf(' ');
    if (sp < 0) continue;
    const word = body.slice(0, sp).replace(/\(\d+\)$/, '').toLowerCase();
    if (!/^[a-z][a-z'.-]*$/.test(word)) continue;
    const stress = body.slice(sp + 1).trim().split(/\s+/)
      .map((p) => (/\d$/.test(p) ? p.at(-1) : ''))
      .join('');
    if (!stress) continue;
    if (!map.has(word)) map.set(word, new Set());
    map.get(word).add(stress);
  }
  return map;
}

const stressDict = loadStress();

function stressOptions(raw) {
  const key = raw.toLowerCase().replace(/[^a-z'.-]/g, '');
  const hit = stressDict.get(key) || stressDict.get(key.replace(/[.'-]+$/, ''));
  return hit ? [...hit] : null;
}

// --- scansion ---------------------------------------------------------------

/**
 * Does variant `s` fit starting at syllable position `p` (0-based)?
 * Scansion constrains only stress: a polysyllable's primary stress must land
 * on a strong beat. Unstressed syllables may be promoted onto strong beats —
 * "the QUAL-i-TY of MER-cy" carries beat four on "-ty" — so '0' goes
 * anywhere, as do secondary stress and monosyllables.
 */
function fits(s, p) {
  if (s.length === 1) return true;
  for (let k = 0; k < s.length; k++) {
    const strong = (p + k) % 2 === 1; // 0-based odd = beats 2,4,6,8,10
    if (s[k] === '1' && !strong) return false;
  }
  return true;
}

// A line may not end on one of these: metrically legal, poetically nothing.
const WEAK_ENDINGS = new Set(('a an the of in on at to and but or nor with for from by as than that if so ' +
  'is are was were be been am do does did has have had will would can could shall should may might must ' +
  'it its his her hers my your our their this these those i you he she we they them him us me').split(' '));

/**
 * All pentameter runs in one token list (already annotated with options).
 * Greedy non-overlap: after a find, scanning resumes past it.
 */
function scanChunk(tokens) {
  const found = [];
  let start = 0;
  while (start < tokens.length) {
    let advanced = false;
    // frontier: set of syllable positions reachable at the current word
    outer:
    for (let i = start; i < tokens.length && !advanced; i++) {
      if (!tokens[i].options) continue;
      let frontier = new Map([[0, i]]); // position -> word index reached
      let poly = 0;
      for (let j = i; j < tokens.length; j++) {
        const opts = tokens[j].options;
        if (!opts) break;
        const next = new Map();
        for (const [pos] of frontier) {
          for (const s of opts) {
            if (pos + s.length > TARGET) continue;
            if (!fits(s, pos)) continue;
            next.set(pos + s.length, j + 1);
          }
        }
        if (!next.size) break;
        if (opts.every((s) => s.length > 1)) poly++;
        const endsWell = opts.some((s) => s.length > 1)
          || !WEAK_ENDINGS.has(tokens[j].raw.toLowerCase().replace(/[^a-z']/g, ''));
        if (next.has(TARGET) && poly >= MIN_POLY && endsWell) {
          found.push({ from: i, to: j + 1, poly });
          start = j + 1;
          advanced = true;
          break outer;
        }
        next.delete(TARGET);
        frontier = next;
      }
    }
    if (!advanced) break;
  }
  return found;
}

// --- corpus -----------------------------------------------------------------

function* chunksOf(post) {
  // sentence enders and line breaks bound a line; commas do not
  for (const piece of post.text.split(/[.!?\n]+/)) {
    const tokens = segment(piece).flat();
    if (tokens.length) yield tokens.map((t) => ({ ...t, options: stressOptions(t.raw), piece }));
  }
}

async function mine(handle) {
  const did = await resolveHandle(handle);
  if (!did) {
    console.log(`\n=== @${handle}: does not resolve\n`);
    return;
  }
  const posts = await authorPosts(did);
  console.log(`\n=== @${handle} — ${posts.length} posts`);

  const lines = [];
  const seen = new Set();
  for (const post of posts) {
    const clean = { ...post, text: post.text.replace(/https?:\S+/g, '\n') };
    for (const tokens of chunksOf(clean)) {
      for (const { from, to, poly } of scanChunk(tokens)) {
        const words = tokens.slice(from, to);
        const text = words[0].piece.slice(words[0].start, words[to - from - 1].end).replace(/\s+/g, ' ').trim();
        if (seen.has(text.toLowerCase())) continue;
        seen.add(text.toLowerCase());
        lines.push({ text, url: atUriToUrl(post.uri), poly });
      }
    }
  }

  console.log(`    ${lines.length} pentameter line${lines.length === 1 ? '' : 's'} found\n`);
  lines.sort((a, b) => b.poly - a.poly); // wordier scansion first: more pinned beats
  for (const l of lines.slice(0, PER_ACCOUNT)) {
    console.log(`  "${l.text}"`);
    console.log(`      ${l.url}\n`);
  }
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: bun tools/iambic.mjs handle [handle...]');
  console.error('       bun tools/iambic.mjs --text "some prose to scan"');
  process.exit(2);
}

if (args[0] === '--text') {
  const post = { text: args.slice(1).join(' '), uri: 'at://text/app.bsky.feed.post/arg' };
  for (const tokens of chunksOf(post)) {
    for (const { from, to } of scanChunk(tokens)) {
      const words = tokens.slice(from, to);
      const text = words[0].piece.slice(words[0].start, words[to - from - 1].end).replace(/\s+/g, ' ').trim();
      console.log(`pentameter: "${text}"`);
    }
  }
} else {
  for (const h of args) await mine(h.replace(/^@/, ''));
}
