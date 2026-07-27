// Badge evaluation for found poems — browser-safe, shared with the node tools.
//
// A "meter map" is word -> [{ stress, tail }]: stress digits per syllable and
// the rhyme tail (phones from the last stressed vowel, stress stripped). The
// browser decodes it from data/meter.txt; the tools build it from CMUdict.

export const WEAK_ENDINGS = new Set(('a an the of in on at to and but or nor with for from by as than that if so ' +
  'is are was were be been am do does did has have had will would can could shall should may might must ' +
  'it its his her hers my your our their this these those i you he she we they them him us me').split(' '));

const KIGO = new Set(('moon snow rain frost spring summer autumn winter blossom blossoms cherry ' +
  'leaf leaves wind storm river sea ocean mountain dawn dusk twilight sunset sunrise morning evening ' +
  'night star stars cloud clouds mist fog ice thunder harvest firefly cicada crow sparrow crane frog ' +
  'petal petals bloom garden grass dew tide sky rains snows').split(' '));

// season words that are only branding when the neighbor word joins in
const KIGO_BLOCK = [/star (wars|trek)/, /cloud (platform|computing|service|services|storage|gaming)/,
  /(summer|winter|spring) (sale|deal|deals|event)/, /night (club|shift|city)/];

export const wordKey = (w) => w.raw.toLowerCase().replace(/[^a-z'.-]/g, '');

/** Decode the front-coded meter table into word -> [{ stress, tail }]. */
export function decodeMeter(text) {
  const map = new Map();
  let prev = '';
  for (const line of text.split('\n')) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const shared = parseInt(line[0], 36);
    const word = prev.slice(0, shared) + line.slice(1, tab);
    prev = word;
    map.set(word, line.slice(tab + 1).split(';').map((v) => {
      const colon = v.indexOf(':');
      return { stress: v.slice(0, colon), tail: v.slice(colon + 1) };
    }));
  }
  return map;
}

/**
 * Scansion, calibrated on canon: only a polysyllable's primary stress
 * constrains, and it must land on a strong beat (0-based odd positions).
 */
export function fitsIambic(s, p) {
  if (s.length === 1) return true;
  for (let k = 0; k < s.length; k++) {
    if (s[k] === '1' && (p + k) % 2 !== 1) return false;
  }
  return true;
}

/** Can these words scan as one iambic line? wordVariants: array of stress-string arrays. */
export function lineScansIambic(wordVariants) {
  let positions = new Set([0]);
  for (const variants of wordVariants) {
    const next = new Set();
    for (const p of positions) {
      for (const s of variants) {
        if (fitsIambic(s, p)) next.add(p + s.length);
      }
    }
    if (!next.size) return false;
    positions = next;
  }
  return true;
}

/** Do two words rhyme in some pronunciation? Identical words do not. */
export function wordsRhyme(a, b, meter) {
  if (a === b) return false;
  const va = meter.get(a);
  const vb = meter.get(b);
  if (!va || !vb) return false;
  return va.some((x) => x.tail && vb.some((y) => x.tail === y.tail));
}

/** All stress-string assignments for the poem's words, capped. */
function stressAssignments(words, meter, cap = 200) {
  let combos = [''];
  for (const w of words) {
    const variants = meter.get(wordKey(w));
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
 * Is this poem eligible for badges at all? The strict corpus rules: every
 * word known with one unambiguous count, clean line endings, no letter soup.
 * (The site is permissive about what it *shows*; badges are not.)
 */
export function badgeEligible(poem) {
  const words = poem.lines.flatMap((l) => l.words);
  if (!words.every((w) => w.source === 'dict' || w.source === 'number')) return false;
  if (!words.every((w) => new Set(w.counts).size === 1)) return false;
  if (poem.lines.some((l) => WEAK_ENDINGS.has(wordKey(l.words.at(-1))))) return false;
  if (words.filter((w) => wordKey(w).length === 1).length * 3 > words.length) return false;
  return true;
}

/** Evaluate every badge for one poem. `span` is its source text. */
export function badges(poem, span, meter) {
  const words = poem.lines.flatMap((l) => l.words);
  const letters = span.toLowerCase().replace(/[^a-z]/g, '');
  const wordList = words.map((w) => wordKey(w).replace(/[^a-z]/g, '')).filter(Boolean);

  const iambic = poem.lines.every((line) => {
    const vs = line.words.map((w) => meter.get(wordKey(w)));
    return vs.every(Boolean) && lineScansIambic(vs.map((v) => v.map((x) => x.stress)));
  });

  const ends = poem.lines.map((l) => wordKey(l.words.at(-1)));
  const rhyme13 = wordsRhyme(ends[0], ends.at(-1), meter);
  const rhymeAll = rhyme13 && ends.slice(1, -1).every((e) => wordsRhyme(ends[0], e, meter));

  const lower = span.toLowerCase();
  const kigo = !KIGO_BLOCK.some((re) => re.test(lower))
    && words.some((w) => KIGO.has(wordKey(w)));

  let stressPalindrome = false;
  const combos = stressAssignments(words, meter);
  if (combos) {
    stressPalindrome = combos.some((c) => {
      const binary = [...c].map((d) => (d === '0' ? 'w' : 'S')).join('');
      return binary === [...binary].reverse().join('');
    });
  }

  const hasNumbers = words.some((w) => w.source === 'number');

  // Written-form badges are only claimable by text actually written in
  // letters; digit-heavy spans are spoken as words the page never shows.
  const written = !hasNumbers && letters.length >= 15 && wordList.length >= 5;
  const vowelsUsed = new Set(letters.replace(/[^aeiou]/g, ''));

  // every word the same syllable count. For a 5-7-5 only n=1 is arithmetically
  // possible (n must divide each line and gcd(5,7,5)=1); other patterns allow
  // greater n — a tanaga of four seven-syllable words would qualify at n=7.
  // Digit posts ("30] [21") farm the shape through their spoken form, so the
  // structural badges also demand actual written language.
  const counts = words.map((w) => w.counts[0]);
  const isosyllabic = !hasNumbers && counts.length > 1 && counts.every((c) => c === counts[0]);

  // 山脈: the words' syllable counts rise and fall as 2-3 / 2-3-2 / 3-2
  const SANMYAKU = [[2, 3], [2, 3, 2], [3, 2]];
  const sanmyaku = !hasNumbers && poem.lines.length === 3 && poem.lines.every((line, i) => {
    const shape = line.words.map((w) => w.counts[0]);
    return shape.length === SANMYAKU[i].length && shape.every((c, k) => c === SANMYAKU[i][k]);
  });

  // no function words at all: telegraphic, content the whole way down
  const stopless = wordList.length > 0 && !wordList.some((w) => WEAK_ENDINGS.has(w));

  return {
    iambic,
    rhyme13,
    rhymeAll,
    kigo,
    lipogramE: written && !letters.includes('e'),
    alphabetical: written && wordList.every((w, i) => i === 0 || wordList[i - 1] <= w),
    monovocalic: written && vowelsUsed.size === 1,
    stressPalindrome,
    isosyllabic,
    sanmyaku,
    stopless,
  };
}

/**
 * Distinct content words over total content words: the uniqueness ratio that
 * discounts rarity in log space, so repetition cannot farm badges.
 */
export function uniqueness(poem) {
  const all = poem.lines.flatMap((l) => l.words)
    .map((w) => wordKey(w).replace(/[^a-z]/g, '')).filter(Boolean);
  const content = all.filter((w) => !WEAK_ENDINGS.has(w));
  const pool = content.length >= 2 ? content : all;
  if (!pool.length) return 1;
  return new Set(pool).size / pool.length;
}

export const BADGE_NAMES = ['iambic', 'rhyme13', 'rhymeAll', 'kigo', 'lipogramE', 'alphabetical',
  'monovocalic', 'stressPalindrome', 'isosyllabic', 'sanmyaku', 'stopless'];

export function badgeMask(b) {
  return BADGE_NAMES.filter((n) => b[n]).join('+') || 'plain';
}
