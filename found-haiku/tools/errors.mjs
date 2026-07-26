#!/usr/bin/env bun
// Diagnostic: where does the heuristic go wrong, and by how much?
//   bun tools/errors.mjs [suffixLength]
import { readFileSync } from 'node:fs';
import { guessSyllables } from '../public/src/syllables.js';

const SUF = Number(process.argv[2] || 4);
const raw = readFileSync(new URL('./cmudict.dict', import.meta.url).pathname, 'utf8');
const words = new Map();
for (const line of raw.split('\n')) {
  if (!line || line.startsWith(';;;')) continue;
  const body = (line.split('#')[0] || '').trim();
  const sp = body.indexOf(' ');
  if (sp < 0) continue;
  const word = body.slice(0, sp).replace(/\(\d+\)$/, '').toLowerCase();
  if (!/^[a-z][a-z'.-]*$/.test(word)) continue;
  const syl = body.slice(sp + 1).trim().split(/\s+/).filter((p) => /\d$/.test(p)).length;
  if (syl < 1) continue;
  if (!words.has(word)) words.set(word, syl);
}

const byDelta = new Map();
const bySuffix = new Map();
const samples = new Map();
let wrong = 0;
for (const [w, truth] of words) {
  const g = guessSyllables(w);
  if (g === truth) continue;
  wrong++;
  const d = g - truth;
  byDelta.set(d, (byDelta.get(d) || 0) + 1);
  const suf = w.slice(-SUF);
  bySuffix.set(suf, (bySuffix.get(suf) || 0) + 1);
  if (!samples.has(suf)) samples.set(suf, []);
  if (samples.get(suf).length < 4) samples.get(suf).push(`${w}=${truth}(got ${g})`);
}

console.log(`wrong: ${wrong} / ${words.size}\n`);
console.log('by delta (guess - truth):');
for (const [d, n] of [...byDelta].sort((a, b) => b[1] - a[1])) console.log(`  ${d > 0 ? '+' : ''}${d}  ${n}`);
console.log(`\ntop -${SUF} suffixes:`);
for (const [s, n] of [...bySuffix].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
  console.log(`  ${String(n).padStart(5)}  -${s.padEnd(SUF)}  ${samples.get(s).join('  ')}`);
}
