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
const QUOTES = /["\u201c\u201d\u201e\u00ab\u00bb`]/;

// Single quotes ARE decidable, because the dictionary decides them: the
// leading-apostrophe words of English are a closed class of fifteen, and
// every trailing-apostrophe form is either in CMUdict or a productive s'
// possessive. Anything else edge-standing is a quotation mark.
const ELISIONS = new Set(["'bout", "'cause", "'course", "'cuse", "'em", "'frisco",
  "'gain", "'kay", "'m", "'n", "'round", "'s", "'til", "'tis", "'twas"]);
const LETTER = /[\p{L}\p{N}]/u;

function singleQuoteIsQuotation(text, i, counter) {
  const ch = text[i];
  if (ch === '\u2018') return true; // opening curly single: always quotation
  const prev = i > 0 ? text[i - 1] : '';
  const next = i + 1 < text.length ? text[i + 1] : '';
  const prevL = LETTER.test(prev);
  const nextL = LETTER.test(next);
  if (prevL && nextL) return false; // interior: don't, o'clock
  if (!prevL && nextL) {
    // leading: 'em vs 'hello
    const m = /^[\p{L}]+/u.exec(text.slice(i + 1));
    return !ELISIONS.has("'" + (m ? m[0].toLowerCase() : ''));
  }
  if (prevL && !nextL) {
    // trailing: boys' and goin' vs hello'
    const m = /[\p{L}]+$/u.exec(text.slice(0, i));
    const word = (m ? m[0].toLowerCase() : '') + "'";
    if (word.endsWith("s'")) return false;
    return !counter.exceptions.has(word);
  }
  return true; // isolated
}

/** Any quotation mark inside `text`, treating apostrophes fairly? */
function containsQuotation(text, counter) {
  if (QUOTES.test(text)) return true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'" || ch === '\u2019' || ch === '\u2018') {
      if (singleQuoteIsQuotation(text, i, counter)) return true;
    }
  }
  return false;
}

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
    const hood = text.slice(Math.max(0, poem.start - 2), Math.min(text.length, poem.end + 2));
    if (containsQuotation(hood, counter)) continue;
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
