// Shared meter machinery: CMUdict phones with stress, scansion, rhyme.
// Used by iambic.mjs (pentameter) and strict-haiku.mjs (iambic/rhymed haiku).

import { readFileSync } from 'node:fs';

/** word -> array of variants, each { stress: '010...', phones: ['K','AH0',...] } */
export function loadCmudict() {
  const raw = readFileSync(new URL('./cmudict.dict', import.meta.url).pathname, 'utf8');
  const map = new Map();
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith(';;;')) continue;
    const body = (line.split('#')[0] || '').trim();
    const sp = body.indexOf(' ');
    if (sp < 0) continue;
    const word = body.slice(0, sp).replace(/\(\d+\)$/, '').toLowerCase();
    if (!/^[a-z][a-z'.-]*$/.test(word)) continue;
    const phones = body.slice(sp + 1).trim().split(/\s+/);
    const stress = phones.map((p) => (/\d$/.test(p) ? p.at(-1) : '')).join('');
    if (!stress) continue;
    if (!map.has(word)) map.set(word, []);
    map.get(word).push({ stress, phones });
  }
  return map;
}

/**
 * Does stress variant `s` fit at syllable position `p` of an alternating
 * weak-strong template? Calibrated on canon: only primary stress constrains —
 * a polysyllable's '1' must land on a strong beat (0-based odd positions);
 * unstressed syllables may be promoted, secondary stress and monosyllables
 * swing either way.
 */
export function fitsIambic(s, p) {
  if (s.length === 1) return true;
  for (let k = 0; k < s.length; k++) {
    if (s[k] === '1' && (p + k) % 2 !== 1) return false;
  }
  return true;
}

/**
 * Can these words, in order, scan as one iambic line? Words are arrays of
 * stress-variant strings. DP over syllable positions.
 */
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
  return true; // length was already fixed by the syllable pattern
}

/** The rhyme tail: phones from the last stressed vowel on, stress stripped. */
export function rhymeTail(phones) {
  let at = -1;
  for (let i = 0; i < phones.length; i++) {
    if (/[12]$/.test(phones[i])) at = i;
  }
  if (at < 0) for (let i = 0; i < phones.length; i++) if (/0$/.test(phones[i])) at = i;
  if (at < 0) return null;
  return phones.slice(at).map((p) => p.replace(/\d$/, '')).join(' ');
}

/** Do two words rhyme in some pronunciation? Identical words do not. */
export function wordsRhyme(a, b, dict) {
  if (a === b) return false;
  const va = dict.get(a);
  const vb = dict.get(b);
  if (!va || !vb) return false;
  for (const x of va) {
    for (const y of vb) {
      const ta = rhymeTail(x.phones);
      if (ta && ta === rhymeTail(y.phones)) return true;
    }
  }
  return false;
}

// A line may not end on one of these: metrically legal, poetically nothing.
export const WEAK_ENDINGS = new Set(('a an the of in on at to and but or nor with for from by as than that if so ' +
  'is are was were be been am do does did has have had will would can could shall should may might must ' +
  'it its his her hers my your our their this these those i you he she we they them him us me').split(' '));
