// Finding accidental poems in prose.
//
// Normalize -> split on punctuation and line breaks -> count syllables per word
// -> look for runs of consecutive words whose syllables partition exactly into
// the target form (5-7-5 and friends) at word boundaries.

export const FORMS = {
  haiku: { label: 'haiku', pattern: [5, 7, 5], note: 'the classic 5-7-5' },
  tanka: { label: 'tanka', pattern: [5, 7, 5, 7, 7], note: 'haiku plus a two-line envoy' },
  tanaga: { label: 'tanaga', pattern: [7, 7, 7, 7], note: 'Filipino quatrain, four sevens' },
  lanterne: { label: 'lanterne', pattern: [1, 2, 3, 4, 1], note: 'a lantern, widening then closed' },
  cinquain: { label: 'cinquain', pattern: [2, 4, 6, 8, 2], note: 'Adelaide Crapsey’s five lines' },
  fib: { label: 'fib', pattern: [1, 1, 2, 3, 5, 8], note: 'Fibonacci: 1 1 2 3 5 8' },
  monoku: { label: 'monoku', pattern: [17], note: 'seventeen in a single breath' },
};

/** Parse "5-7-5" / "5 7 5" / "5,7,5" into a pattern array. */
export function parsePattern(text) {
  const nums = String(text).match(/\d+/g);
  if (!nums) return null;
  const pattern = nums.map(Number).filter((n) => n > 0 && n < 100);
  return pattern.length ? pattern : null;
}

// A word: letters/digits, optionally stitched with internal apostrophes,
// hyphens or dots ("don't", "well-worn", "U.S"), plus a trailing possessive
// apostrophe ("the boys' coats").
const WORD = /[\p{L}\p{N}]+(?:['\u2019\u2018\u2011\u2010-][\p{L}\p{N}]+)*(?:['\u2019](?![\p{L}\p{N}]))?/gu;

// Anything in a gap that ends a run of words: sentence punctuation, dashes used
// as pauses, brackets, quote marks, slashes, line breaks.
const BREAKER = /[.!?;:,…—–‒―()[\]{}"«»“”‘’''`/\\|*_=+<>@#~•·¶§\n\r\t]/;

// Dots that follow one of these do not end a sentence.
const ABBREV = /^(?:mr|mrs|ms|dr|prof|st|sr|jr|vs|etc|e\.g|i\.e|no|fig|ca|approx|est|dept|univ|inc|ltd|co|op|cf|al|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|mon|tue|wed|thu|fri|sat|sun)$/i;

/**
 * Split text into segments — runs of words between punctuation or line breaks.
 * Each token keeps its source offsets so a result can quote the input exactly.
 */
export function segment(text, base = 0) {
  const segments = [];
  let current = [];
  const push = () => {
    if (current.length) segments.push(current);
    current = [];
  };

  const re = new RegExp(`(${WORD.source})|([^\\p{L}\\p{N}]+)`, 'gu');
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1] !== undefined) {
      current.push({ raw: m[1], start: base + m.index, end: base + m.index + m[1].length });
      continue;
    }
    const gap = m[2];
    if (!BREAKER.test(gap)) continue;
    // A lone period after an initial or a known abbreviation is not a break.
    const last = current.length ? current[current.length - 1].raw : '';
    const onlyDot = /^\.\s*$/.test(gap);
    if (onlyDot && (last.length === 1 || ABBREV.test(last))) continue;
    push();
  }
  push();
  return segments;
}

/**
 * Annotate one segment's tokens with syllable counts.
 * Returns tokens as { raw, start, end, counts: number[], source }.
 */
export function annotate(tokens, counter) {
  return tokens.map((t) => {
    const a = counter.analyze(t.raw);
    return { ...t, counts: a.counts, source: a.source };
  });
}

/**
 * Given annotated tokens and a start index, return the set of end indices
 * reachable by consuming exactly `target` syllables at word boundaries.
 */
function reach(tokens, starts, target, allowAlternates, end = tokens.length) {
  const ends = new Set();
  for (const start of starts) {
    // depth-first over words, tracking the running syllable total
    const stack = [[start, 0]];
    while (stack.length) {
      const [i, sum] = stack.pop();
      if (sum === target) { ends.add(i); continue; }
      if (sum > target || i >= end) continue;
      const counts = allowAlternates ? tokens[i].counts : [tokens[i].counts[0]];
      for (const c of counts) {
        if (sum + c <= target) stack.push([i + 1, sum + c]);
      }
    }
  }
  return ends;
}

/**
 * Does the run of tokens [start, end) partition exactly into `pattern`?
 * Returns the line break indices, or null.
 */
export function fit(tokens, start, end, pattern, allowAlternates) {
  let frontier = new Set([start]);
  const layers = [];
  for (const target of pattern) {
    const next = reach(tokens, frontier, target, allowAlternates, end);
    // Only positions that can still finish are worth keeping.
    if (!next.size) return null;
    layers.push(next);
    frontier = next;
  }
  if (!frontier.has(end)) return null;

  // Walk the layers backwards to recover one concrete set of break points.
  const breaks = [end];
  for (let k = layers.length - 2; k >= 0; k--) {
    const want = breaks[0];
    let chosen = null;
    for (const p of layers[k]) {
      if (p < want && reach(tokens, [p], pattern[k + 1], allowAlternates, want).has(want)) {
        chosen = p;
        break;
      }
    }
    if (chosen === null) return null;
    breaks.unshift(chosen);
  }
  breaks.unshift(start);
  return breaks;
}

/**
 * Find every poem of the given shape in `text`.
 *
 * options:
 *   pattern     number[]  syllables per line
 *   scope       'segment' | 'span' | 'cross'
 *               segment = a whole punctuation-delimited run must be the poem
 *               span    = any run of consecutive words inside one segment
 *               cross   = any run of consecutive words, punctuation ignored
 *   alternates  boolean   allow secondary pronunciations (fire = 1 or 2)
 *   limit       number    stop after this many finds
 */
export function findPoems(text, counter, options = {}) {
  const {
    pattern = [5, 7, 5],
    scope = 'segment',
    alternates = true,
    dictOnly = false,
    limit = 500,
    onProgress = null,
  } = options;

  const total = pattern.reduce((a, b) => a + b, 0);

  // Straddling punctuation still stops at a blank line: a poem that runs from
  // the end of one paragraph into the start of the next is not a found poem,
  // it is two halves of different thoughts.
  const blocks = [];
  const para = /\n[ \t]*\n\s*/g;
  let at = 0;
  let mm;
  while ((mm = para.exec(text)) !== null) {
    blocks.push([text.slice(at, mm.index), at]);
    at = mm.index + mm[0].length;
  }
  blocks.push([text.slice(at), at]);

  const segments = [];
  const units = [];
  for (const [block, offset] of blocks) {
    const segs = segment(block, offset);
    segments.push(...segs);
    if (scope === 'cross') units.push(segs.flat());
    else units.push(...segs);
  }

  const found = [];
  const keep = (poem) => {
    if (dictOnly && poem.guessed) return false;
    found.push(poem);
    return true;
  };
  let scanned = 0;

  for (const seg of units) {
    if (found.length >= limit) break;
    scanned++;
    if (onProgress && scanned % 200 === 0) onProgress(scanned, units.length, found.length);
    if (!seg.length) continue;

    const tokens = annotate(seg, counter);
    // Cheap rejection: the whole unit must be able to hold `total` syllables.
    const cheap = tokens.reduce((a, t) => a + t.counts[0], 0);
    if (scope === 'segment') {
      if (cheap !== total && !(alternates && couldTotal(tokens, total))) continue;
      const breaks = fit(tokens, 0, tokens.length, pattern, alternates);
      if (breaks) keep(makePoem(text, tokens, breaks, pattern));
      continue;
    }

    if (cheap < total && !(alternates && couldTotal(tokens, total, true))) continue;
    // Slide a window: for each start, walk forward while the running sum can
    // still land on `total`.
    let end = 0;
    for (let start = 0; start < tokens.length; start++) {
      if (found.length >= limit) break;
      let sum = 0;
      for (end = start; end < tokens.length; end++) {
        sum += tokens[end].counts[0];
        if (sum > total + 4) break; // alternates can only shift things a little
      }
      for (let e = start + pattern.length; e <= Math.min(end + 1, tokens.length); e++) {
        const breaks = fit(tokens, start, e, pattern, alternates);
        if (breaks) {
          keep(makePoem(text, tokens, breaks, pattern));
          start = e - 1; // non-overlapping results read better
          break;
        }
      }
    }
  }
  return {
    poems: found,
    segments: segments.length,
    words: segments.reduce((a, s) => a + s.length, 0),
    capped: found.length >= limit,
  };
}

/** Could any combination of alternate pronunciations reach `total`? */
function couldTotal(tokens, total, atLeast = false) {
  let lo = 0;
  let hi = 0;
  for (const t of tokens) {
    lo += Math.min(...t.counts);
    hi += Math.max(...t.counts);
  }
  return atLeast ? hi >= total : lo <= total && hi >= total;
}

function makePoem(text, tokens, breaks, pattern) {
  const lines = [];
  for (let i = 0; i + 1 < breaks.length; i++) {
    const slice = tokens.slice(breaks[i], breaks[i + 1]);
    lines.push({
      text: text.slice(slice[0].start, slice[slice.length - 1].end),
      words: slice,
      syllables: pattern[i],
    });
  }
  const words = tokens.slice(breaks[0], breaks[breaks.length - 1]);
  return {
    lines,
    start: words[0].start,
    end: words[words.length - 1].end,
    guessed: words.filter((w) => w.source !== 'dict' && w.source !== 'number').length,
    words: words.length,
  };
}
