// The strict found-haiku gates and the rarity badges, shared by the survey
// (tools/rarity-survey.mjs) and whatever ends up doing the hourly posting.

import { findPoems } from '../public/src/finder.js';
import { lineScansIambic, wordsRhyme, WEAK_ENDINGS } from './meter-lib.mjs';

const wordKey = (w) => w.raw.toLowerCase().replace(/[^a-z'.-]/g, '');

// links and bare domains become clause boundaries
export const stripLinks = (t) => String(t)
  .replace(/https?:\S+/g, '\n')
  .replace(/\b[\w-]+(\.[\w-]+)+(\/\S*)?/g, '\n');

/**
 * All poems in one post's text passing the base strict stack:
 * single source line, dictionary words, unambiguous counts, clean endings,
 * unintended (author delimiters at every break disqualify), not letter-soup.
 */
export function strictFinds(text, counter, pattern = [5, 7, 5]) {
  const out = [];
  const { poems } = findPoems(text, counter, { pattern, scope: 'cross', alternates: false, limit: 20 });
  for (const poem of poems) {
    const span = text.slice(poem.start, poem.end);
    if (span.includes('\n')) continue;
    const words = poem.lines.flatMap((l) => l.words);
    if (!words.every((w) => w.source === 'dict' || w.source === 'number')) continue;
    if (!words.every((w) => new Set(w.counts).size === 1)) continue;
    if (poem.lines.some((l) => WEAK_ENDINGS.has(wordKey(l.words.at(-1))))) continue;
    const gaps = poem.lines.slice(0, -1).map((line, i) =>
      text.slice(line.words.at(-1).end, poem.lines[i + 1].words[0].start));
    if (gaps.length && gaps.every((g) => /[,/]/.test(g))) continue;
    if (words.filter((w) => wordKey(w).length === 1).length * 3 > words.length) continue;
    out.push({ poem, span, words });
  }
  return out;
}

// --- badges -----------------------------------------------------------------

const KIGO = new Set(('moon snow rain frost spring summer autumn winter blossom blossoms cherry ' +
  'leaf leaves wind storm river sea ocean mountain dawn dusk twilight sunset sunrise morning evening ' +
  'night star stars cloud clouds mist fog ice thunder harvest firefly cicada crow sparrow crane frog ' +
  'petal petals bloom garden grass dew tide sky rains snows').split(' '));

// season words that are only branding when the neighbor word joins in
const KIGO_BLOCK = [/star (wars|trek)/, /cloud (platform|computing|service|services|storage|gaming)/,
  /(summer|winter|spring) (sale|deal|deals|event)/, /night (club|shift|city)/];

function kigoWords(find) {
  const text = find.span.toLowerCase();
  if (KIGO_BLOCK.some((re) => re.test(text))) return [];
  return find.words.map((w) => wordKey(w)).filter((w) => KIGO.has(w));
}

/** All stress-string assignments for the poem's words, capped. */
function stressAssignments(find, cmudict, cap = 200) {
  let combos = [''];
  for (const w of find.words) {
    const variants = cmudict.get(wordKey(w));
    if (!variants) return null;
    const stresses = [...new Set(variants.map((v) => v.stress))];
    const next = [];
    for (const c of combos) {
      for (const s of stresses) next.push(c + s);
    }
    if (next.length > cap) return null;
    combos = next;
  }
  return combos;
}

/**
 * Evaluate every badge for one strict find.
 * Letters-only view of the span decides the orthographic badges.
 */
export function badges(find, cmudict) {
  const letters = find.span.toLowerCase().replace(/[^a-z]/g, '');
  const wordList = find.words.map((w) => wordKey(w).replace(/[^a-z]/g, '')).filter(Boolean);
  const lineVariants = (line) => line.words.map((w) => cmudict.get(wordKey(w)));

  const iambic = find.poem.lines.every((line) => {
    const vs = lineVariants(line);
    return vs.every(Boolean) && lineScansIambic(vs.map((v) => v.map((x) => x.stress)));
  });

  const ends = find.poem.lines.map((l) => wordKey(l.words.at(-1)));
  const rhyme13 = wordsRhyme(ends[0], ends.at(-1), cmudict);
  const rhymeAll = rhyme13 && ends.slice(1, -1).every((e) => wordsRhyme(ends[0], e, cmudict));

  const kigo = kigoWords(find);

  const vowelsUsed = new Set(letters.replace(/[^aeiou]/g, ''));

  let stressPalindrome = false;
  const combos = stressAssignments(find, cmudict);
  if (combos) {
    stressPalindrome = combos.some((c) => {
      const binary = [...c].map((d) => (d === '0' ? 'w' : 'S')).join('');
      return binary === [...binary].reverse().join('');
    });
  }

  return {
    iambic,
    rhyme13,
    rhymeAll,
    kigo: kigo.length > 0,
    lipogramE: letters.length > 0 && !letters.includes('e'),
    alphabetical: wordList.length > 2 && wordList.every((w, i) => i === 0 || wordList[i - 1] <= w),
    monovocalic: vowelsUsed.size === 1,
    stressPalindrome,
  };
}

/**
 * Distinct content words over total content words. Function-word repeats are
 * ordinary grammar and do not count either way; repeating content words is
 * how "Blood clot!" nine times farms badges. With no content words at all,
 * every token counts.
 */
export function uniqueness(find) {
  const all = find.words.map((w) => wordKey(w).replace(/[^a-z]/g, '')).filter(Boolean);
  const content = all.filter((w) => !WEAK_ENDINGS.has(w));
  const pool = content.length >= 2 ? content : all;
  if (!pool.length) return 1;
  return new Set(pool).size / pool.length;
}

export const BADGE_NAMES = ['iambic', 'rhyme13', 'rhymeAll', 'kigo', 'lipogramE', 'alphabetical', 'monovocalic', 'stressPalindrome'];

export function badgeMask(b) {
  return BADGE_NAMES.filter((n) => b[n]).join('+') || 'plain';
}
