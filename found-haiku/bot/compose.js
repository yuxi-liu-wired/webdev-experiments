// Composing the reply post: text, length discipline, and link facets.
//
// Posts are capped at 300 graphemes; facets address bytes of UTF-8. Both are
// easy to get wrong with emoji in the poem, so both are computed here and
// nowhere else.

const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
export const graphemes = (s) => [...seg.segment(s)].length;
const utf8len = (s) => new TextEncoder().encode(s).length;

export const POST_LIMIT = 300;

/** Reply for a found poem: the poem, a blank line, the source permalink. */
export function poemReply(poem, url) {
  const body = poem.lines.map((l) => l.text).join('\n');
  const text = `${body}\n\n${url}`;
  if (graphemes(text) > POST_LIMIT) return null;
  const start = utf8len(`${body}\n\n`);
  return {
    text,
    facets: [{
      index: { byteStart: start, byteEnd: start + utf8len(url) },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }],
    }],
  };
}

/** Reply when the corpus holds no poem of the asked shape. */
export function notFoundReply(aboutSelf) {
  return {
    text: aboutSelf
      ? 'Cannot find one in your corpus. Maybe consider writing one?'
      : 'Cannot find one in their corpus. Maybe consider telling them to write one?',
  };
}

/** Reply for a bad command. `pinned` is the bot's usage post. */
export function errorReply(error, pinned) {
  const text = `Error: ${error}. Please refer to ${pinned}`;
  const start = utf8len(text) - utf8len(pinned);
  return {
    text,
    facets: [{
      index: { byteStart: start, byteEnd: start + utf8len(pinned) },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: pinned }],
    }],
  };
}
