// The finder engine, loaded server-side.
//
// The browser fetches the syllable table over HTTP; here it comes off disk.
// Netlify's bundler relocates the function, so the table is looked for in the
// places it can land (LAMBDA_TASK_ROOT carries included_files in production).

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { decodeExceptions, SyllableCounter } from '../public/src/syllables.js';
import { joinPosts, spanAt, atUriToUrl } from '../public/src/posts.js';
import { strictFinds } from '../tools/strict-lib.mjs';
import { rengaPattern } from './parse.js';

let counter = null;

export function loadCounter() {
  if (counter) return counter;
  const candidates = [
    process.env.LAMBDA_TASK_ROOT && join(process.env.LAMBDA_TASK_ROOT, 'public/data/syllables.txt'),
    new URL('../public/data/syllables.txt', import.meta.url).pathname,
    'public/data/syllables.txt',
  ].filter(Boolean);
  for (const p of candidates) {
    if (existsSync(p)) {
      counter = new SyllableCounter(decodeExceptions(readFileSync(p, 'utf8')));
      return counter;
    }
  }
  throw new Error(`syllable table not found; tried ${candidates.join(', ')}`);
}

/** Posts -> one searchable text with spans; links become clause boundaries. */
export function corpusFromPosts(posts) {
  const cleaned = posts.map(({ text, uri }) => ({
    text: text.replace(/https?:\S+/g, '\n'),
    uri,
  }));
  return joinPosts(cleaned);
}

/**
 * The best poem of the given shape in the corpus, with its source permalink.
 * Every candidate passes the full strict gates (the pinned manual's promise:
 * dictionary words, unambiguous counts, clean endings, unintended), plus a
 * bot-only rule: a reply poem is one breath — it may cross commas but never a
 * sentence ender. Whole clauses are tried first, then runs inside a clause,
 * then comma-straddling runs. `fits` lets the caller reject poems whose reply
 * would overflow a post.
 */
/**
 * A renga: one found stanza per voice, alternating 5-7-5 / 7-7 from the
 * hokku down. Returns { stanzas } or { missing } naming the first voice
 * whose corpus holds no stanza of the required shape.
 */
export function rengaChain(voices) {
  const stanzas = [];
  for (let i = 0; i < voices.length; i++) {
    const pattern = rengaPattern(i);
    const found = findBest(voices[i].corpus, pattern);
    if (!found) return { missing: voices[i].handle, pattern };
    stanzas.push({ handle: voices[i].handle, did: voices[i].did, ...found, pattern });
  }
  return { stanzas };
}

export function findBest(corpus, pattern, fits = () => true) {
  const c = loadCounter();
  const BREATH = /[.!?…‽]/;
  for (const scope of ['segment', 'span', 'cross']) {
    for (const find of strictFinds(corpus.text, c, pattern, scope)) {
      if (BREATH.test(find.span)) continue;
      const span = spanAt(corpus.spans, find.poem.start);
      const url = span && atUriToUrl(span.uri);
      if (url && fits(find.poem, url)) return { poem: find.poem, url };
    }
  }
  return null;
}
