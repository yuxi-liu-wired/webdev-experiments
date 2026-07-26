#!/usr/bin/env bun
// Build data/exceptions.txt from CMUdict.
//
// The heuristic in src/syllables.js is right most of the time; this writes down
// only the words it gets wrong, front-coded, so the browser payload stays small
// while dictionary words are exact.
//
//   bun tools/build-dict.mjs [tools/cmudict.dict] [data/exceptions.txt]

import { readFileSync, writeFileSync } from 'node:fs';
import { guessSyllables } from '../public/src/syllables.js';

const dictPath = process.argv[2] || new URL('./cmudict.dict', import.meta.url).pathname;
const outPath = process.argv[3] || new URL('../public/data/syllables.txt', import.meta.url).pathname;

const raw = readFileSync(dictPath, 'utf8');

/** word -> Set of syllable counts across pronunciation variants */
const words = new Map();
let entries = 0;

for (const line of raw.split('\n')) {
  if (!line || line.startsWith(';;;')) continue;
  const hash = line.indexOf('#');
  const body = (hash >= 0 ? line.slice(0, hash) : line).trim();
  if (!body) continue;
  const sp = body.indexOf(' ');
  if (sp < 0) continue;

  let word = body.slice(0, sp);
  const phones = body.slice(sp + 1).trim().split(/\s+/);
  word = word.replace(/\(\d+\)$/, '').toLowerCase();

  // CMUdict holds bare punctuation entries ("!exclamation-point"); skip them.
  if (!/^[a-z][a-z'.-]*$/.test(word)) continue;

  const syl = phones.filter((p) => /\d$/.test(p)).length;
  if (syl < 1) continue;

  entries++;
  if (!words.has(word)) words.set(word, new Set());
  words.get(word).add(syl);
}

// Variants that differ only in stress collapse; genuine length variants stay.
let ambiguous = 0;
let wrong = 0;
const exceptions = [];

for (const [word, set] of words) {
  // Insertion order, not numeric: CMUdict lists the primary pronunciation first
  // and the matcher treats counts[0] as the default reading.
  const counts = [...set];
  if (counts.length > 1) ambiguous++;
  const guess = guessSyllables(word);
  // Keep the word if the heuristic misses the primary count, or if the word has
  // more than one valid length (the matcher wants to know about both).
  if (guess !== counts[0]) wrong++;
  // The table holds every dictionary word, not just the misses: the app marks
  // guessed words in the output, so it has to know what is genuinely known.
  exceptions.push([word, counts]);
}

exceptions.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

let prev = '';
const lines = [];
for (const [word, counts] of exceptions) {
  let shared = 0;
  const max = Math.min(prev.length, word.length, 35);
  while (shared < max && prev[shared] === word[shared]) shared++;
  lines.push(shared.toString(36) + word.slice(shared) + '\t' + counts.join(','));
  prev = word;
}

const out = lines.join('\n') + '\n';
writeFileSync(outPath, out);

const pct = (n) => ((100 * n) / words.size).toFixed(2) + '%';
console.log(`cmudict entries parsed : ${entries.toLocaleString()}`);
console.log(`distinct words         : ${words.size.toLocaleString()}`);
console.log(`heuristic wrong on     : ${wrong.toLocaleString()} (${pct(wrong)})  -> accuracy ${(100 - (100 * wrong) / words.size).toFixed(2)}%`);
console.log(`multi-length words     : ${ambiguous.toLocaleString()} (${pct(ambiguous)})`);
console.log(`table rows             : ${exceptions.length.toLocaleString()}`);
console.log(`table bytes            : ${out.length.toLocaleString()} (front-coded)`);
console.log(`written to             : ${outPath}`);
