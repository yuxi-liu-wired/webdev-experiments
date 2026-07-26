// The finder engine, loaded server-side.
//
// The browser fetches the syllable table over HTTP; here it comes off disk.
// Netlify's bundler relocates the function, so the table is looked for in the
// places it can land (LAMBDA_TASK_ROOT carries included_files in production).

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { decodeExceptions, SyllableCounter } from '../public/src/syllables.js';
import { findPoems } from '../public/src/finder.js';
import { joinPosts, spanAt, atUriToUrl } from '../public/src/posts.js';

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
 * Whole clauses read best, so scopes cascade: a poem that IS a clause wins
 * over one cut from the middle of a sentence, which wins over one straddling
 * punctuation. `fits` lets the caller reject poems whose reply would overflow
 * a post.
 */
export function findBest(corpus, pattern, fits = () => true) {
  const c = loadCounter();
  for (const scope of ['segment', 'span', 'cross']) {
    const { poems } = findPoems(corpus.text, c, { pattern, scope, limit: 50 });
    for (const poem of poems) {
      const span = spanAt(corpus.spans, poem.start);
      const url = span && atUriToUrl(span.uri);
      if (url && fits(poem, url)) return { poem, url };
    }
  }
  return null;
}
