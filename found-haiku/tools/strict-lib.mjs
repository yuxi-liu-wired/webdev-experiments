// The strict found-haiku gates, shared by the survey and the future bot.
// Badge logic lives once, in public/src/badges.js, and is re-exported here.

import { findPoems } from '../public/src/finder.js';
import { WEAK_ENDINGS, wordKey } from '../public/src/badges.js';

export { badges, uniqueness, badgeMask, BADGE_NAMES, decodeMeter } from '../public/src/badges.js';

// links and bare domains become clause boundaries
export const stripLinks = (t) => String(t)
  .replace(/https?:\S+/g, '\n')
  .replace(/\b[\w-]+(\.[\w-]+)+(\/\S*)?/g, '\n');

const DELIM = /[,/]/;

// Quoted text is someone else's voice: a found poem may not contain any of
// the double-quote family, or it risks attributing a citation to the author.
// Apostrophes are untouchable — 'quote' and don't are indistinguishable.
const QUOTES = /["\u201c\u201d\u201e\u00ab\u00bb`]/;

/**
 * All poems in one post's text passing the base strict stack:
 * single source line, dictionary words, unambiguous counts, clean endings,
 * unintended (author delimiters at every break disqualify), not letter-soup.
 */
export function strictFinds(text, counter, pattern = [5, 7, 5], scope = 'cross') {
  const out = [];
  const { poems } = findPoems(text, counter, { pattern, scope, alternates: false, limit: 20 });
  for (const poem of poems) {
    const span = text.slice(poem.start, poem.end);
    if (span.includes('\n')) continue;
    // a quote mark inside the span is a straddle; one immediately beside it
    // means the poem lives inside quotation — either way, cited voice
    const before = text.slice(Math.max(0, poem.start - 2), poem.start);
    const after = text.slice(poem.end, poem.end + 2);
    if (QUOTES.test(span) || QUOTES.test(before) || QUOTES.test(after)) continue;
    const words = poem.lines.flatMap((l) => l.words);
    if (!words.every((w) => w.source === 'dict' || w.source === 'number')) continue;
    if (!words.every((w) => new Set(w.counts).size === 1)) continue;
    if (poem.lines.some((l) => WEAK_ENDINGS.has(wordKey(l.words.at(-1))))) continue;
    const gaps = poem.lines.slice(0, -1).map((line, i) =>
      text.slice(line.words.at(-1).end, poem.lines[i + 1].words[0].start));
    if (gaps.length && gaps.every((g) => DELIM.test(g))) continue;
    if (words.filter((w) => wordKey(w).length === 1).length * 3 > words.length) continue;
    out.push({ poem, span, words });
  }
  return out;
}
