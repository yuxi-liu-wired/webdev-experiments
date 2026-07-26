import { expect, test, describe } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  guessSyllables, numericTokens, decodeExceptions, SyllableCounter, acronymSyllables,
} from '../public/src/syllables.js';
import { segment, findPoems, parsePattern, FORMS } from '../public/src/finder.js';
import { atUriToUrl, joinPosts, spanAt } from '../public/src/posts.js';

const table = decodeExceptions(readFileSync(new URL('../public/data/syllables.txt', import.meta.url).pathname, 'utf8'));
const counter = new SyllableCounter(table);

describe('dictionary', () => {
  test('loads the whole of cmudict', () => {
    expect(counter.size).toBeGreaterThan(120000);
  });

  test('gives exact counts for dictionary words', () => {
    // Every count is CMUdict's first-listed pronunciation, not my intuition:
    //   chocolate    CH AO1 K L AH0 T            -> 2
    //   camera       K AE1 M ER0 AH0             -> 3
    //   interesting  IH1 N T R AH0 S T IH0 NG    -> 3
    //   temperature  T EH1 M P R AH0 CH ER0      -> 3
    //   comfortable  K AH1 M F ER0 T AH0 B AH0 L -> 4
    //   business     B IH1 Z N AH0 S             -> 2
    const cases = [['haiku', 2], ['syllable', 3], ['beautiful', 3], ['every', 3],
      ['business', 2], ['chocolate', 2], ['camera', 3], ['different', 3],
      ['interesting', 3], ['temperature', 3], ['comfortable', 4]];
    for (const [word, n] of cases) expect([word, counter.count(word)]).toEqual([word, n]);
  });

  test('knows words with two lengths', () => {
    expect(counter.analyze('fire').counts).toEqual([2, 1]); // CMU lists 'FAY-er' first
    expect(counter.analyze('hour').counts).toEqual([2, 1]);
    expect(counter.analyze('flower').counts).toEqual([2]);
    expect(counter.analyze('poem').counts).toEqual([2]);
  });

  test('reports where a count came from', () => {
    expect(counter.analyze('mountain').source).toBe('dict');
    expect(counter.analyze('zorbnaxling').source).toBe('guess');
    expect(counter.analyze('1984').source).toBe('number');
  });

  test('normalizes curly apostrophes, dashes and zero-width marks', () => {
    expect(counter.analyze('don\u2019t').source).toBe('dict');
    expect(counter.count('don\u2019t')).toBe(1);
    expect(counter.count('well\u2011worn')).toBe(2);
    expect(counter.count('moun\u200btain')).toBe(2);
  });

  test('handles case, possessives and contractions', () => {
    expect(counter.count('Mountain')).toBe(2);
    expect(counter.count("don't")).toBe(1);
    expect(counter.count("horse's")).toBe(2);
    expect(counter.count("bridge's")).toBe(2);
  });

  test('sums hyphenated compounds', () => {
    expect(counter.count('well-worn')).toBe(2);
    expect(counter.count('self-evident')).toBe(4);
    expect(counter.count('and/or')).toBe(2);
    expect(counter.count('toni.bsky.team')).toBe(4); // to-ni bsky team, spoken apart
  });
});

describe('heuristic (out-of-dictionary words)', () => {
  test('never returns zero for a real token', () => {
    for (const w of ['x', 'blorp', 'zzz', 'schmeckle', 'a']) {
      expect(guessSyllables(w)).toBeGreaterThan(0);
    }
  });

  test('gets invented words plausibly right', () => {
    const cases = [['blorping', 2], ['zorbnax', 2], ['flimberry', 3], ['scrunt', 1],
      ['unfriendable', 4], ['glimmerous', 3]];
    for (const [w, n] of cases) expect([w, guessSyllables(w)]).toEqual([w, n]);
  });

  test('is at least 90% accurate over all of cmudict', () => {
    let right = 0;
    for (const [word, counts] of table) {
      if (guessSyllables(word) === counts[0]) right++;
    }
    const accuracy = right / table.size;
    expect(accuracy).toBeGreaterThan(0.9);
  });
});

describe('numbers and acronyms', () => {
  test('reads years in pairs', () => {
    expect(numericTokens('1984')).toEqual(['nineteen', 'eighty', 'four']);
    expect(numericTokens('2026')).toEqual(['twenty', 'twenty', 'six']);
    expect(numericTokens('1900')).toEqual(['nineteen', 'hundred']);
    expect(numericTokens('1805')).toEqual(['eighteen', 'oh', 'five']);
  });

  test('reads plain numbers, ordinals and decimals', () => {
    expect(numericTokens('42')).toEqual(['forty', 'two']);
    expect(numericTokens('1,250')).toEqual(['one', 'thousand', 'two', 'hundred', 'fifty']);
    expect(numericTokens('3rd')).toEqual(['third']);
    expect(numericTokens('20th')).toEqual(['twentieth']);
    expect(numericTokens('2.5')).toEqual(['two', 'point', 'five']);
  });

  test('counts syllables through the spelling', () => {
    expect(counter.count('42')).toBe(3);   // for-ty two
    expect(counter.count('7')).toBe(2);    // sev-en
    expect(counter.count('1984')).toBe(5); // nine-teen eigh-ty four
  });

  test('spells out consonant acronyms', () => {
    expect(acronymSyllables('HTML')).toBe(5); // aitch-tee-em-el
    expect(counter.analyze('GDPR').source).toBe('acronym');
    expect(counter.analyze('GDPR').counts).toEqual([4]);
  });
});

describe('segmentation', () => {
  test('splits on sentence punctuation and newlines', () => {
    const segs = segment('One two, three four. Five six\nseven eight');
    expect(segs.map((s) => s.map((t) => t.raw).join(' '))).toEqual([
      'One two', 'three four', 'Five six', 'seven eight',
    ]);
  });

  test('keeps contractions and hyphenates whole', () => {
    const segs = segment("don't worry, it's well-worn");
    expect(segs[0].map((t) => t.raw)).toEqual(["don't", 'worry']);
    expect(segs[1].map((t) => t.raw)).toEqual(["it's", 'well-worn']);
  });

  test('does not break at abbreviations or initials', () => {
    const segs = segment('Dr. Smith met J. R. Jones today');
    expect(segs.length).toBe(1);
    expect(segs[0].length).toBe(7);
  });

  test('keeps offsets that quote the source exactly', () => {
    const text = 'the old pond';
    const t = segment(text)[0];
    expect(text.slice(t[0].start, t[2].end)).toBe('the old pond');
  });
});

describe('finding poems', () => {
  const known = 'An old silent pond, a frog jumps into the pond, splash! Silence again.';
  // 17 syllables in one unbroken clause, verified word by word:
  // the-1 old-1 si-lent-2 pond-1 | where-1 a-1 green-1 frog-1 jumps-1 in-to-2 | the-1 still-1 cold-1 wa-ter-2
  const HAIKU = 'the old silent pond where a green frog jumps into the still cold water';

  test('finds a 5-7-5 spanning punctuation when allowed to cross', () => {
    const { poems } = findPoems(known, counter, { pattern: [5, 7, 5], scope: 'cross' });
    expect(poems.length).toBeGreaterThan(0);
    const lines = poems[0].lines.map((l) => l.text);
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe('An old silent pond');
  });

  test('finds a haiku that is exactly one segment', () => {
    const text = `Hello. ${HAIKU}. Goodbye.`;
    const { poems } = findPoems(text, counter, { pattern: [5, 7, 5], scope: 'segment' });
    expect(poems.length).toBe(1);
    expect(poems[0].lines.map((l) => l.text)).toEqual([
      'the old silent pond', 'where a green frog jumps into', 'the still cold water',
    ]);
  });

  test('segment scope rejects a run that is only part of a segment', () => {
    const text = `well ${HAIKU} indeed`;
    expect(findPoems(text, counter, { scope: 'segment' }).poems.length).toBe(0);
    expect(findPoems(text, counter, { scope: 'span' }).poems.length).toBe(1);
  });

  test('every line has exactly the syllables it claims', () => {
    const text = readFileSync(new URL('./sample.txt', import.meta.url).pathname, 'utf8');
    for (const form of ['haiku', 'tanka', 'tanaga']) {
      const pattern = FORMS[form].pattern;
      const { poems } = findPoems(text, counter, { pattern, scope: 'span', alternates: false });
      for (const p of poems) {
        p.lines.forEach((line, i) => {
          const n = line.words.reduce((a, w) => a + w.counts[0], 0);
          expect([form, line.text, n]).toEqual([form, line.text, pattern[i]]);
        });
      }
    }
  });

  test('finds nothing in text that has none', () => {
    const { poems } = findPoems('a b c d', counter, { pattern: [5, 7, 5] });
    expect(poems).toEqual([]);
  });

  test('handles an empty document', () => {
    const r = findPoems('', counter, {});
    expect(r.poems).toEqual([]);
    expect(r.words).toBe(0);
  });

  test('reports how many words were guessed rather than known', () => {
    const text = HAIKU.replace('silent', 'blorping'); // blorping is nobody's word
    const { poems } = findPoems(text, counter, { scope: 'span' });
    expect(poems.length).toBe(1);
    expect(poems[0].guessed).toBe(1);
  });

  test('respects the limit', () => {
    const text = new Array(50).fill(`${HAIKU}.`).join(' ');
    const { poems } = findPoems(text, counter, { scope: 'segment', limit: 7 });
    expect(poems.length).toBe(7);
  });
});

describe('bluesky post mapping', () => {
  test('at:// URIs become bsky.app permalinks', () => {
    expect(atUriToUrl('at://did:plc:abc123/app.bsky.feed.post/3kxyzq'))
      .toBe('https://bsky.app/profile/did:plc:abc123/post/3kxyzq');
    expect(atUriToUrl('at://did:plc:abc/app.bsky.feed.like/3k')).toBe(null);
    expect(atUriToUrl('nonsense')).toBe(null);
    expect(atUriToUrl(undefined)).toBe(null);
  });

  test('joined posts remember which span each offset belongs to', () => {
    const { text, spans } = joinPosts([
      { text: 'one two', uri: 'at://d/app.bsky.feed.post/a' },
      { text: 'three', uri: 'at://d/app.bsky.feed.post/b' },
    ]);
    expect(text).toBe('one two\n\nthree');
    expect(spanAt(spans, 0).uri).toBe('at://d/app.bsky.feed.post/a');
    expect(spanAt(spans, text.indexOf('three')).uri).toBe('at://d/app.bsky.feed.post/b');
    expect(spanAt(spans, 8)).toBe(null); // inside the separator gap
  });

  test('a poem found in joined posts maps back to its own post', () => {
    const { text, spans } = joinPosts([
      { text: 'unrelated filler words here', uri: 'at://d/app.bsky.feed.post/first' },
      { text: 'the old silent pond where a green frog jumps into the still cold water', uri: 'at://d/app.bsky.feed.post/second' },
    ]);
    const { poems } = findPoems(text, counter, { pattern: [5, 7, 5], scope: 'span' });
    expect(poems.length).toBe(1);
    expect(spanAt(spans, poems[0].start).uri).toBe('at://d/app.bsky.feed.post/second');
  });
});

describe('forms', () => {
  test('every named form has a positive pattern', () => {
    for (const [key, f] of Object.entries(FORMS)) {
      expect([key, f.pattern.every((n) => n > 0)]).toEqual([key, true]);
    }
  });

  test('parses custom patterns', () => {
    expect(parsePattern('5-7-5')).toEqual([5, 7, 5]);
    expect(parsePattern('7 7 7 7')).toEqual([7, 7, 7, 7]);
    expect(parsePattern('2,4,6,8,2')).toEqual([2, 4, 6, 8, 2]);
    expect(parsePattern('nonsense')).toBe(null);
  });
});
