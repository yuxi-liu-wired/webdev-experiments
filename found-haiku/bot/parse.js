// Parsing a mention of the bot into a command.
//
// Grammar, both slots optional, in this order:
//   @found-haiku <format> <@someone>
//
// format:   haiku | tanka | tanaga | [3-9]{3,9}   (digits = syllables per line)
// @someone: starts with @, bsky handle characters only. Whether the account
//           actually exists is decided later — mentions typed with the client's
//           autocomplete arrive with the DID already resolved in the post's
//           facets (the protocol's own parser); hand-typed ones go through
//           com.atproto.identity.resolveHandle.
//
// Anything else is an error, with the exact wording of the spec.

import { FORMS } from '../public/src/finder.js';

const NAMED = {
  haiku: FORMS.haiku.pattern,
  tanka: FORMS.tanka.pattern,
  tanaga: FORMS.tanaga.pattern,
};

const HANDLE = /^@[a-zA-Z0-9.-]+$/;

/** Map handle text -> did from the post's mention facets. */
export function facetMentions(text, facets) {
  const map = new Map();
  if (!facets) return map;
  const bytes = new TextEncoder().encode(text);
  const dec = new TextDecoder();
  for (const f of facets) {
    for (const feat of f.features || []) {
      if (feat.$type === 'app.bsky.richtext.facet#mention' && feat.did) {
        const slice = dec.decode(bytes.slice(f.index.byteStart, f.index.byteEnd));
        map.set(slice.replace(/^@/, '').toLowerCase(), feat.did);
      }
    }
  }
  return map;
}

/**
 * Parse the text of a mention. `botHandles` are the bot's own names, matched
 * case-insensitively and removed wherever they appear.
 *
 * Returns { pattern, formatName, target: { handle, did? } | null }
 * or       { error: <exact reply text, minus the pinned-post pointer> }.
 */
export function parseCommand(text, botHandles, facets) {
  const mentions = facetMentions(text, facets);
  const ours = new Set(botHandles.map((h) => h.replace(/^@/, '').toLowerCase()));
  const tokens = String(text).trim().split(/\s+/).filter(Boolean)
    .filter((t) => !(t.startsWith('@') && ours.has(t.slice(1).toLowerCase())));

  // The slots may come in any order: a token names the slot by its shape —
  // @-prefixed fills the target, anything else fills the format. Filling
  // either slot twice is malformed.
  let format = null;
  let target = null;

  for (const t of tokens) {
    if (t.startsWith('@')) {
      if (target) return { error: 'malformed request' };
      if (!HANDLE.test(t)) return { error: 'malformed request' };
      const handle = t.slice(1).toLowerCase();
      target = { handle, did: mentions.get(handle) || null };
      continue;
    }
    if (format) return { error: 'malformed request' };
    const lower = t.toLowerCase();
    if (NAMED[lower]) {
      format = { pattern: NAMED[lower], name: lower };
    } else if (/^[0-9]+$/.test(t)) {
      if (!/^[3-9]{3,9}$/.test(t)) return { error: `"${t}" exceeds allowed bounds` };
      format = { pattern: t.split('').map(Number), name: t };
    } else {
      return { error: `"${t}" is not an allowed format` };
    }
  }

  return {
    pattern: format ? format.pattern : NAMED.haiku,
    formatName: format ? format.name : 'haiku',
    target,
  };
}
