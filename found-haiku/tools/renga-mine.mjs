#!/usr/bin/env bun
// Mine the capture for accidental renga: reply pairs (and chains) where the
// parent post carries a found stanza and the reply carries the answering one.
//
//   bun tools/renga-mine.mjs /workspace/firehose-data/jetstream-all.jsonl [limit]
//
// Every post is scanned for bot-grade stanzas of both shapes (strict gates +
// the one-breath rule) — 5-7-5 and 7-7. The reply graph then joins them:
// only posts captured with a `parent` field (the capture records it since
// 2026-07-27) can be replies, but any post in the corpus can be a parent.
//
// Reported: parent-shape x reply-shape counts, cross-author vs self-renga,
// the whole-post strictness dial (stanza coverage of the post's text), and
// chains longer than two if the network has been truly unwise.

import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { decodeExceptions, SyllableCounter } from '../public/src/syllables.js';
import { strictFinds, stripLinks, uniqueness } from './strict-lib.mjs';

const path = process.argv[2] || '/workspace/firehose-data/jetstream-all.jsonl';
const LIMIT = Number(process.argv[3] || 0);

const counter = new SyllableCounter(decodeExceptions(
  readFileSync(new URL('../public/data/syllables.txt', import.meta.url).pathname, 'utf8')));

const BREATH = /[.!?…‽]/;
const PATTERNS = { '575': [5, 7, 5], '77': [7, 7] };

/** Bot-grade stanza of the given shape, with coverage of the whole post. */
function stanzaOf(text, key) {
  for (const find of strictFinds(text, counter, PATTERNS[key], 'cross')) {
    if (BREATH.test(find.span)) continue;
    if (uniqueness(find.poem) < 0.5) continue;
    const meat = text.replace(/\s+/g, ' ').trim().length;
    return {
      lines: find.poem.lines.map((l) => l.text),
      span: find.span,
      coverage: meat ? Math.min(1, find.span.length / meat) : 0,
    };
  }
  return null;
}

const poetic = new Map(); // "did/rkey" -> { did, parent, f575, f77, text }
const stats = { scanned: 0, withParent: 0, poetic: 0 };
const seen = new Set();
const t0 = performance.now();

const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line) continue;
  let post;
  try { post = JSON.parse(line); } catch { continue; }
  if (!post.text || !post.did || !post.rkey) continue;
  const id = `${post.did}/${post.rkey}`;
  if (seen.has(id)) continue;
  seen.add(id);
  stats.scanned++;
  if (LIMIT && stats.scanned > LIMIT) break;
  if (post.parent) stats.withParent++;
  if (stats.scanned % 500000 === 0) {
    console.log(`  ${stats.scanned.toLocaleString()} posts · ${stats.poetic.toLocaleString()} poetic · ${Math.round(stats.scanned / ((performance.now() - t0) / 1000))}/s`);
  }

  const text = stripLinks(post.text);
  const f575 = stanzaOf(text, '575');
  const f77 = stanzaOf(text, '77');
  if (f575 || f77) {
    stats.poetic++;
    const parent = post.parent ? post.parent.replace('at://', '').replace('/app.bsky.feed.post/', '/') : null;
    poetic.set(id, { did: post.did, parent, f575, f77, text: post.text });
  }
}

console.log(`\n${stats.scanned.toLocaleString()} posts (${stats.withParent.toLocaleString()} with parent recorded) · ${stats.poetic.toLocaleString()} carry a stanza`);

// --- assemble pairs ---------------------------------------------------------
const shapes = ['575', '77'];
const matrix = {}; // "parentShape>replyShape" -> { cross: n, self: n }
const pairs = [];
for (const [id, node] of poetic) {
  if (!node.parent) continue;
  const parent = poetic.get(node.parent);
  if (!parent) continue;
  for (const ps of shapes) {
    for (const rs of shapes) {
      if (!parent[`f${ps}`] || !node[`f${rs}`]) continue;
      const key = `${ps}>${rs}`;
      const kind = parent.did === node.did ? 'self' : 'cross';
      (matrix[key] ||= { cross: 0, self: 0 })[kind]++;
      if (ps === '575' && rs === '77') {
        pairs.push({
          kind,
          coverage: Math.min(parent.f575.coverage, node.f77.coverage),
          hokku: parent.f575.lines,
          waki: node.f77.lines,
          hokkuUrl: `https://bsky.app/profile/${node.parent.split('/')[0]}/post/${node.parent.split('/')[1]}`,
          wakiUrl: `https://bsky.app/profile/${node.did}/post/${id.split('/')[1]}`,
        });
      }
    }
  }
}

// chains: reply whose own id is some other reply's parent, all poetic
let chains = 0;
for (const [id, node] of poetic) {
  if (!node.parent || !poetic.has(node.parent)) continue;
  const grandparent = poetic.get(node.parent)?.parent;
  if (grandparent && poetic.has(grandparent)) chains++;
}

console.log('\nthe renga matrix (parent shape > reply shape):');
for (const [key, c] of Object.entries(matrix).sort()) {
  console.log(`  ${key.padEnd(9)} cross-author ${String(c.cross).padStart(5)} · self ${String(c.self).padStart(5)}`);
}
console.log(`  poetic chains of three or more: ${chains}`);

pairs.sort((a, b) => b.coverage - a.coverage || (a.kind === 'cross' ? -1 : 1));
const crossPairs = pairs.filter((p) => p.kind === 'cross');
console.log(`\ntan-renga (575 then 77), cross-author: ${crossPairs.length}, by whole-post coverage:\n`);
for (const p of crossPairs.slice(0, 10)) {
  console.log(`  [coverage ${p.coverage.toFixed(2)}]`);
  console.log(p.hokku.map((l) => `    ${l}`).join('\n'));
  console.log('      —');
  console.log(p.waki.map((l) => `    ${l}`).join('\n'));
  console.log(`      ${p.hokkuUrl}`);
  console.log(`      ${p.wakiUrl}\n`);
}

writeFileSync(new URL('../data/renga-finds.json', import.meta.url).pathname,
  JSON.stringify({ stats, matrix, chains, tanRenga: crossPairs.slice(0, 200) }, null, 1));
console.log('written: data/renga-finds.json');
