#!/usr/bin/env bun
// Build public/data/meter.txt: per-word stress patterns and rhyme tails,
// front-coded like the syllable table. This is what the browser needs to
// award iambic, rhyme, and stress-palindrome badges.
//
// Line format: <sharedPrefixLen base36><suffix>\t<variant(;variant)*>
// where variant = <stressDigits>:<rhymeTailPhones space-joined, stress stripped>

import { writeFileSync } from 'node:fs';
import { loadCmudict, rhymeTail } from './meter-lib.mjs';

const dict = loadCmudict();
const words = [...dict.keys()].sort();

let prev = '';
const lines = [];
for (const word of words) {
  const seen = new Set();
  const variants = [];
  for (const v of dict.get(word)) {
    const tail = rhymeTail(v.phones) || '';
    const enc = `${v.stress}:${tail}`;
    if (!seen.has(enc)) {
      seen.add(enc);
      variants.push(enc);
    }
  }
  let shared = 0;
  const max = Math.min(prev.length, word.length, 35);
  while (shared < max && prev[shared] === word[shared]) shared++;
  lines.push(shared.toString(36) + word.slice(shared) + '\t' + variants.join(';'));
  prev = word;
}

const out = lines.join('\n') + '\n';
const dest = new URL('../public/data/meter.txt', import.meta.url).pathname;
writeFileSync(dest, out);
console.log(`${words.length.toLocaleString()} words, ${out.length.toLocaleString()} bytes -> ${dest}`);
