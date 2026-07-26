// Mapping poems found in a joined blob of Bluesky posts back to the live post.
//
// The finder sees one long text with character offsets; these helpers remember
// where each post landed in that text, so a poem's start offset resolves to the
// at:// URI of the post it was found in, and that URI to a bsky.app permalink.

/** at://did/app.bsky.feed.post/rkey -> https://bsky.app/profile/did/post/rkey */
export function atUriToUrl(uri) {
  const m = /^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/.exec(uri || '');
  return m ? `https://bsky.app/profile/${m[1]}/post/${m[2]}` : null;
}

/**
 * Join posts into one findable text, keeping each post's [start, end) span.
 * Posts are separated by a blank line, which the finder treats as a paragraph
 * boundary, so no poem ever straddles two posts.
 */
export function joinPosts(posts) {
  const spans = [];
  const parts = [];
  let off = 0;
  for (const { text, uri } of posts) {
    spans.push({ start: off, end: off + text.length, uri });
    parts.push(text);
    off += text.length + 2; // the '\n\n' separator
  }
  return { text: parts.join('\n\n'), spans };
}

/** The span containing text position `pos`, or null in a separator gap. */
export function spanAt(spans, pos) {
  for (const s of spans) {
    if (pos >= s.start && pos < s.end) return s;
  }
  return null;
}
