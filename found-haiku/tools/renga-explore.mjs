#!/usr/bin/env bun
// Deep exploration of accidental linked verse in the capture.
//
//   bun tools/renga-explore.mjs /workspace/firehose-data/jetstream-all.jsonl [limit]
//
// One pass computes bot-grade stanzas (strict gates + one breath) of three
// shapes per post — 5-7-5, 7-7, and 5-7-7 (the katauta, for sedoka mining) —
// then the reply graph is walked for:
//   - the pair matrix, plus sedoka (577 answered by 577, the classical
//     question-and-answer form that reply pairs secretly are)
//   - chain length distribution, the longest poetic chain, and the longest
//     RENGA-TRUE chain (shapes strictly alternating 575/77), with the
//     all-distinct-authors crown
//   - reply latency for cross-author tan-renga (how fast wakiku arrive)
//   - hub accounts appearing in many cross-author pairs

import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { decodeExceptions, SyllableCounter } from '../public/src/syllables.js';
import { strictFinds, stripLinks, uniqueness } from './strict-lib.mjs';

const path = process.argv[2] || '/workspace/firehose-data/jetstream-all.jsonl';
const LIMIT = Number(process.argv[3] || 0);

const counter = new SyllableCounter(decodeExceptions(
  readFileSync(new URL('../public/data/syllables.txt', import.meta.url).pathname, 'utf8')));

const BREATH = /[.!?…‽]/;
const PATTERNS = { s575: [5, 7, 5], s77: [7, 7], s577: [5, 7, 7] };

function stanzaOf(text, key) {
  for (const find of strictFinds(text, counter, PATTERNS[key], 'cross')) {
    if (BREATH.test(find.span)) continue;
    if (uniqueness(find.poem) < 0.5) continue;
    const meat = text.replace(/\s+/g, ' ').trim().length;
    return {
      lines: find.poem.lines.map((l) => l.text),
      coverage: meat ? Math.min(1, find.span.length / meat) : 0,
    };
  }
  return null;
}

const poetic = new Map();
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
    console.log(`  ${stats.scanned.toLocaleString()} · ${stats.poetic.toLocaleString()} poetic · ${Math.round(stats.scanned / ((performance.now() - t0) / 1000))}/s`);
  }

  const text = stripLinks(post.text);
  const s575 = stanzaOf(text, 's575');
  const s77 = stanzaOf(text, 's77');
  const s577 = stanzaOf(text, 's577');
  if (s575 || s77 || s577) {
    stats.poetic++;
    poetic.set(id, {
      did: post.did,
      parent: post.parent ? post.parent.replace('at://', '').replace('/app.bsky.feed.post/', '/') : null,
      t: post.time_us || 0,
      s575, s77, s577,
    });
  }
}
console.log(`\n${stats.scanned.toLocaleString()} posts (${stats.withParent.toLocaleString()} with parent) · ${stats.poetic.toLocaleString()} poetic`);

// Persist the expensive part. Annotating 13M posts costs a quarter hour;
// every graph question on top of it costs seconds — so the annotation is
// cached and tools/renga-query.mjs answers follow-ups without re-scanning.
{
  const cachePath = '/workspace/firehose-data/stanza-cache.jsonl';
  const out = [];
  for (const [id, n] of poetic) {
    out.push(JSON.stringify({ id, did: n.did, parent: n.parent, t: n.t, s575: n.s575, s77: n.s77, s577: n.s577 }));
  }
  writeFileSync(cachePath, out.join('\n') + '\n');
  console.log(`stanza cache written: ${cachePath} (${out.length.toLocaleString()} nodes)`);
}

// --- pairs ------------------------------------------------------------------
const matrix = {};
const tanRenga = [];
const sedoka = [];
const duels = [];
const latencies = [];
const hubs = new Map();
const url = (id) => `https://bsky.app/profile/${id.split('/')[0]}/post/${id.split('/')[1]}`;

for (const [id, node] of poetic) {
  if (!node.parent) continue;
  const parent = poetic.get(node.parent);
  if (!parent) continue;
  const cross = parent.did !== node.did;
  for (const ps of ['s575', 's77', 's577']) {
    for (const rs of ['s575', 's77', 's577']) {
      if (!parent[ps] || !node[rs]) continue;
      const key = `${ps.slice(1)}>${rs.slice(1)}`;
      (matrix[key] ||= { cross: 0, self: 0 })[cross ? 'cross' : 'self']++;
    }
  }
  if (cross) {
    hubs.set(parent.did, (hubs.get(parent.did) || 0) + 1);
    hubs.set(node.did, (hubs.get(node.did) || 0) + 1);
  }
  if (cross && parent.s575 && node.s77) {
    tanRenga.push({ coverage: Math.min(parent.s575.coverage, node.s77.coverage),
      hokku: parent.s575.lines, waki: node.s77.lines, urls: [url(node.parent), url(id)] });
    if (parent.t && node.t) latencies.push((node.t - parent.t) / 1e6);
  }
  if (cross && parent.s577 && node.s577) {
    sedoka.push({ coverage: Math.min(parent.s577.coverage, node.s577.coverage),
      kami: parent.s577.lines, shimo: node.s577.lines, urls: [url(node.parent), url(id)] });
  }
  if (cross && parent.s575 && node.s575) {
    duels.push({ coverage: Math.min(parent.s575.coverage, node.s575.coverage),
      a: parent.s575.lines, b: node.s575.lines, urls: [url(node.parent), url(id)] });
  }
}

// --- chains -----------------------------------------------------------------
const children = new Map();
for (const [id, node] of poetic) {
  if (node.parent && poetic.has(node.parent)) {
    (children.get(node.parent) || children.set(node.parent, []).get(node.parent)).push(id);
  }
}
const roots = [...poetic.keys()].filter((id) => {
  const p = poetic.get(id).parent;
  return children.has(id) && (!p || !poetic.has(p));
});

// longest any-poetic chain from each root (DFS, graph is a forest of trees)
let longestAny = [];
function dfsAny(id, path) {
  const next = children.get(id) || [];
  if (!next.length) {
    if (path.length > longestAny.length) longestAny = [...path];
    return;
  }
  for (const c of next) dfsAny(c, [...path, c]);
}
for (const r of roots) dfsAny(r, [r]);

// longest renga-true chain: shapes strictly alternate 575 / 77, either phase.
// Two crowns: any authorship (a solo run is a dokugin — one poet, all
// stanzas, a real classical practice), and the strangers' version where
// adjacent stanzas must change voice, renga's own seating rule.
let longestTrue = [];
let longestCross = [];
function dfsTrue(id, want, path, lastDid, crossOnly) {
  const node = poetic.get(id);
  const best = crossOnly ? longestCross : longestTrue;
  if (!node[`s${want}`] || (crossOnly && node.did === lastDid)) {
    if (path.length > best.length) {
      if (crossOnly) longestCross = [...path]; else longestTrue = [...path];
    }
    return;
  }
  const newPath = [...path, { id, shape: want }];
  const next = children.get(id) || [];
  const other = want === '575' ? '77' : '575';
  let extended = false;
  for (const c of next) {
    const child = poetic.get(c);
    if (child[`s${other}`] && (!crossOnly || child.did !== node.did)) {
      dfsTrue(c, other, newPath, node.did, crossOnly);
      extended = true;
    }
  }
  if (!extended) {
    const b = crossOnly ? longestCross : longestTrue;
    if (newPath.length > b.length) {
      if (crossOnly) longestCross = newPath; else longestTrue = newPath;
    }
  }
}
for (const r of roots) {
  for (const phase of ['575', '77']) {
    dfsTrue(r, phase, [], null, false);
    dfsTrue(r, phase, [], null, true);
  }
}

const lengthHist = {};
function chainDepth(id) {
  const next = children.get(id) || [];
  if (!next.length) return 1;
  return 1 + Math.max(...next.map(chainDepth));
}
for (const r of roots) {
  const d = chainDepth(r);
  lengthHist[d] = (lengthHist[d] || 0) + 1;
}

// --- report -----------------------------------------------------------------
console.log('\npair matrix (parent > reply):');
for (const [k, c] of Object.entries(matrix).sort()) {
  console.log(`  ${k.padEnd(9)} cross ${String(c.cross).padStart(6)} · self ${String(c.self).padStart(6)}`);
}

console.log('\npoetic chain depth histogram (roots by max depth):');
for (const [d, n] of Object.entries(lengthHist).sort((a, b) => a[0] - b[0])) {
  if (Number(d) >= 2) console.log(`  depth ${d}: ${n.toLocaleString()}`);
}

const show = (label, list, keys) => {
  list.sort((a, b) => b.coverage - a.coverage);
  console.log(`\n${label}: ${list.length.toLocaleString()} cross-author, best by coverage:\n`);
  for (const item of list.slice(0, 5)) {
    console.log(`  [${item.coverage.toFixed(2)}]`);
    for (const k of keys) console.log(item[k].map((l) => `    ${l}`).join('\n') + '\n      —');
    for (const u of item.urls) console.log(`      ${u}`);
    console.log('');
  }
};
show('sedoka (577 answering 577)', sedoka, ['kami', 'shimo']);
show('haiku duels (575 answering 575)', duels, ['a', 'b']);

if (latencies.length) {
  latencies.sort((a, b) => a - b);
  const q = (p) => latencies[Math.floor(p * (latencies.length - 1))];
  console.log(`wakiku latency (s): median ${Math.round(q(0.5))} · p10 ${Math.round(q(0.1))} · p90 ${Math.round(q(0.9))}`);
}

console.log('\nlongest renga-true chain (alternating 575/77):', longestTrue.length, 'stanzas');
for (const { id, shape } of longestTrue) {
  const n = poetic.get(id);
  console.log(`  [${shape}] @${id.split('/')[0].slice(0, 20)}…  ${n[`s${shape}`].lines.join(' / ')}`);
  console.log(`      ${url(id)}`);
}
console.log('\nlongest renga-true chain with alternating VOICES (the strangers\u2019 kasen):', longestCross.length, 'stanzas');
for (const { id, shape } of longestCross) {
  const n = poetic.get(id);
  console.log(`  [${shape}] ${n[`s${shape}`].lines.join(' / ')}`);
  console.log(`      ${url(id)}`);
}
console.log('\nlongest any-poetic chain:', longestAny.length, 'posts:');
for (const id of longestAny) {
  const n = poetic.get(id);
  const shape = n.s575 ? '575' : n.s77 ? '77' : '577';
  console.log(`  [${shape}] ${n[`s${shape}`].lines.join(' / ')}`);
  console.log(`      ${url(id)}`);
}

const topHubs = [...hubs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log('\npoetic hubs (dids in most cross-author pairs):');
for (const [did, n] of topHubs) console.log(`  ${n} pairs · https://bsky.app/profile/${did}`);

writeFileSync(new URL('../data/renga-explore.json', import.meta.url).pathname, JSON.stringify({
  stats, matrix, lengthHist,
  sedoka: sedoka.slice(0, 100), duels: duels.slice(0, 100), tanRenga: tanRenga.slice(0, 100),
  longestTrue: longestTrue.map(({ id, shape }) => ({ id, shape, lines: poetic.get(id)[`s${shape}`].lines })),
  longestCross: longestCross.map(({ id, shape }) => ({ id, shape, lines: poetic.get(id)[`s${shape}`].lines })),
  longestAny: longestAny.map((id) => {
    const n = poetic.get(id);
    const shape = n.s575 ? 's575' : n.s77 ? 's77' : 's577';
    return { id, shape: shape.slice(1), did: n.did, lines: n[shape].lines };
  }),
  latencyQuantiles: latencies.length ? { n: latencies.length } : null,
}, null, 1));
console.log('\nwritten: data/renga-explore.json');
