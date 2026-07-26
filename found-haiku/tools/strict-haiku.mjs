#!/usr/bin/env bun
// The strict stack for firehose-found haiku, tested against a local capture.
//
//   bun tools/strict-haiku.mjs path/to/firehose-compact.json.gz [pattern]
//
// A found haiku here must be:
//   1. inside a single line of the source — no newline within the found span;
//      deliberate haiku are posted with their line breaks written out
//   2. dictionary words only — every syllable count exact
//   3. unambiguous — every word has one count, so the poem scans identically
//      under every pronunciation; fire/hour/flower words disqualify
//   4. clean-ended — no line ends on a function word
//   5. unintended — if the author's own "," or "/" sit at BOTH of our line
//      breaks, their punctuation already wrote this haiku; that is a poem,
//      not a found poem, and it is rejected
// Survivors are ranked by kigo — season and nature words — which is the
// experimental part of the stack.
//
// The capture is the url-feed's, so every post carries a link; links are cut
// to clause boundaries before scanning, and the deployed version of gate
// "plain text only" is left out here or nothing would survive at all.

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeExceptions, SyllableCounter } from '../public/src/syllables.js';
import { findPoems, parsePattern } from '../public/src/finder.js';
import { loadCmudict, lineScansIambic, wordsRhyme, WEAK_ENDINGS } from './meter-lib.mjs';

const KIGO = new Set(('moon snow rain frost spring summer autumn fall winter blossom blossoms cherry ' +
  'leaf leaves wind storm river sea ocean mountain dawn dusk twilight sunset sunrise morning evening ' +
  'night star stars cloud clouds mist fog ice thunder harvest firefly cicada crow sparrow crane frog ' +
  'petal petals bloom garden grass dew tide sky rains snows winter’s').split(' '));

const table = decodeExceptions(readFileSync(new URL('../public/data/syllables.txt', import.meta.url).pathname, 'utf8'));
const counter = new SyllableCounter(table);

const argv = process.argv.slice(2);
const IAMBIC = argv.includes('--iambic');
const RHYME = argv.includes('--rhyme');
const positional = argv.filter((a) => !a.startsWith('--'));
const [path, patternArg] = positional;
if (!path) {
  console.error('usage: bun tools/strict-haiku.mjs capture.json.gz [pattern] [--iambic] [--rhyme]');
  process.exit(2);
}
const pattern = patternArg ? parsePattern(patternArg) : [5, 7, 5];
const cmudict = (IAMBIC || RHYME) ? loadCmudict() : null;
const wordKey = (w) => w.raw.toLowerCase().replace(/[^a-z'.-]/g, '');

const raw = path.endsWith('.gz') ? gunzipSync(readFileSync(path)).toString() : readFileSync(path, 'utf8');
const capture = JSON.parse(raw);
const posts = capture.posts || capture;
console.log(`${posts.length.toLocaleString()} posts in the capture (${capture.capturedAt || 'unknown date'})`);

// links and bare domains become clause boundaries
const strip = (t) => String(t)
  .replace(/https?:\S+/g, '\n')
  .replace(/\b[\w-]+(\.[\w-]+)+(\/\S*)?/g, '\n');

const funnel = {
  scanned: 0, found: 0, singleLine: 0, dictOnly: 0,
  unambiguous: 0, cleanEnded: 0, unintended: 0,
  ...(IAMBIC ? { iambic: 0 } : {}),
  ...(RHYME ? { rhymed: 0 } : {}),
};
const survivors = [];
const seen = new Set();

for (const post of posts) {
  const original = post.t || post.text || '';
  if (!original) continue;
  funnel.scanned++;
  const text = strip(original);

  const { poems } = findPoems(text, counter, { pattern, scope: 'cross', alternates: false, limit: 20 });
  for (const poem of poems) {
    funnel.found++;
    const span = text.slice(poem.start, poem.end);

    if (span.includes('\n')) continue;
    funnel.singleLine++;

    const words = poem.lines.flatMap((l) => l.words);
    if (!words.every((w) => w.source === 'dict' || w.source === 'number')) continue;
    funnel.dictOnly++;

    if (!words.every((w) => new Set(w.counts).size === 1)) continue;
    funnel.unambiguous++;

    const lastWords = poem.lines.map((l) => l.words.at(-1).raw.toLowerCase().replace(/[^a-z']/g, ''));
    if (lastWords.some((w) => WEAK_ENDINGS.has(w))) continue;
    funnel.cleanEnded++;

    // the author's own delimiters at every internal break = intended
    const breaks = poem.lines.slice(0, -1).map((line, i) => {
      const endOfLine = line.words.at(-1).end;
      const startOfNext = poem.lines[i + 1].words[0].start;
      return text.slice(endOfLine, startOfNext);
    });
    if (breaks.length && breaks.every((gap) => /[,/]/.test(gap))) continue;
    funnel.unintended++;

    // spelled-out letters ("c o m / j p") scan freely and letter names rhyme;
    // a poem that is mostly single letters is a URL in a trenchcoat
    if (words.filter((w) => wordKey(w).length === 1).length * 3 > words.length) continue;

    if (IAMBIC) {
      // every line must independently scan as iambs, per the calibrated rule
      const scans = poem.lines.every((line) => {
        const variants = line.words.map((w) => cmudict.get(wordKey(w)));
        if (variants.some((v) => !v)) return false; // numbers etc: unscannable
        return lineScansIambic(variants.map((vs) => vs.map((v) => v.stress)));
      });
      if (!scans) continue;
      funnel.iambic++;
    }

    if (RHYME) {
      const first = wordKey(poem.lines[0].words.at(-1));
      const last = wordKey(poem.lines.at(-1).words.at(-1));
      if (!wordsRhyme(first, last, cmudict)) continue;
      funnel.rhymed++;
    }

    const key = span.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);

    const kigo = words.map((w) => w.raw.toLowerCase()).filter((w) => KIGO.has(w));
    survivors.push({
      lines: poem.lines.map((l) => l.text),
      kigo,
      url: post.d && post.k ? `https://bsky.app/profile/${post.d}/post/${post.k}` : null,
    });
  }
}

console.log('\nthe funnel:');
for (const [k, v] of Object.entries(funnel)) console.log(`  ${k.padEnd(12)} ${v.toLocaleString()}`);
console.log(`  distinct     ${survivors.length.toLocaleString()}`);

survivors.sort((a, b) => b.kigo.length - a.kigo.length);
console.log('\ntop of the anthology (kigo-ranked):\n');
for (const s of survivors.slice(0, 12)) {
  console.log(s.lines.map((l) => `  ${l}`).join('\n'));
  console.log(`      ${s.kigo.length ? `kigo: ${s.kigo.join(', ')} · ` : ''}${s.url || ''}\n`);
}
