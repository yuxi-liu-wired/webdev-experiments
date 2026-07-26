import { expect, test, describe } from 'bun:test';
import { parseCommand, facetMentions } from '../bot/parse.js';
import { poemReply, notFoundReply, errorReply, graphemes } from '../bot/compose.js';
import { corpusFromPosts, findBest } from '../bot/engine.js';

const BOT = ['found-haiku.bsky.social', 'found-haiku'];

describe('command parsing', () => {
  test('bare mention: haiku from the author', () => {
    const c = parseCommand('@found-haiku.bsky.social', BOT, null);
    expect(c.pattern).toEqual([5, 7, 5]);
    expect(c.formatName).toBe('haiku');
    expect(c.target).toBe(null);
  });

  test('named formats', () => {
    expect(parseCommand('@found-haiku tanka', BOT, null).pattern).toEqual([5, 7, 5, 7, 7]);
    expect(parseCommand('@found-haiku tanaga', BOT, null).pattern).toEqual([7, 7, 7, 7]);
    expect(parseCommand('@found-haiku Tanka', BOT, null).pattern).toEqual([5, 7, 5, 7, 7]);
  });

  test('digit formats: each digit a line', () => {
    expect(parseCommand('@found-haiku 577', BOT, null).pattern).toEqual([5, 7, 7]);
    expect(parseCommand('@found-haiku 335577', BOT, null).pattern).toEqual([3, 3, 5, 5, 7, 7]);
  });

  test('digits out of bounds', () => {
    expect(parseCommand('@found-haiku 12', BOT, null).error).toBe('"12" exceeds allowed bounds');
    expect(parseCommand('@found-haiku 5751', BOT, null).error).toBe('"5751" exceeds allowed bounds');
    expect(parseCommand('@found-haiku 57', BOT, null).error).toBe('"57" exceeds allowed bounds');
    expect(parseCommand('@found-haiku 5755755755', BOT, null).error).toBe('"5755755755" exceeds allowed bounds');
  });

  test('not an allowed format', () => {
    expect(parseCommand('@found-haiku sonnet', BOT, null).error).toBe('"sonnet" is not an allowed format');
    expect(parseCommand('@found-haiku tanka?', BOT, null).error).toBe('"tanka?" is not an allowed format');
  });

  test('a target account, with and without a format', () => {
    const c1 = parseCommand('@found-haiku @vgel.me', BOT, null);
    expect(c1.pattern).toEqual([5, 7, 5]);
    expect(c1.target).toEqual({ handle: 'vgel.me', did: null });
    const c2 = parseCommand('@found-haiku 577 @vgel.me', BOT, null);
    expect(c2.pattern).toEqual([5, 7, 7]);
    expect(c2.target.handle).toBe('vgel.me');
  });

  test('the slots come in any order', () => {
    const c = parseCommand('@found-haiku @vgel.me tanka', BOT, null);
    expect(c.pattern).toEqual([5, 7, 5, 7, 7]);
    expect(c.target.handle).toBe('vgel.me');
    const d = parseCommand('@vgel.me 577 @found-haiku', BOT, null);
    expect(d.pattern).toEqual([5, 7, 7]);
    expect(d.target.handle).toBe('vgel.me');
  });

  test('malformed requests', () => {
    expect(parseCommand('@found-haiku @a @b', BOT, null).error).toBe('malformed request');
    expect(parseCommand('@found-haiku tanka @x extra', BOT, null).error).toBe('malformed request');
    expect(parseCommand('@found-haiku tanka 577', BOT, null).error).toBe('malformed request');
    expect(parseCommand('@found-haiku @bad!handle', BOT, null).error).toBe('malformed request');
  });

  test('the DID rides in from the mention facets', () => {
    const text = '@found-haiku @vgel.me';
    // '@vgel.me' occupies bytes [13, 21) of the ASCII text — computed, not assumed
    const facets = [{
      index: { byteStart: 13, byteEnd: 21 },
      features: [{ $type: 'app.bsky.richtext.facet#mention', did: 'did:plc:vgel' }],
    }];
    expect(facetMentions(text, facets).get('vgel.me')).toBe('did:plc:vgel');
    expect(parseCommand(text, BOT, facets).target).toEqual({ handle: 'vgel.me', did: 'did:plc:vgel' });
  });
});

describe('reply composition', () => {
  const poem = { lines: [{ text: 'the old silent pond' }, { text: 'where a green frog jumps into' }, { text: 'the still cold water' }] };
  const url = 'https://bsky.app/profile/did:plc:x/post/3kabc';

  test('poem reply: poem, blank line, link with exact byte offsets', () => {
    const r = poemReply(poem, url);
    expect(r.text.endsWith(url)).toBe(true);
    const f = r.facets[0];
    const bytes = new TextEncoder().encode(r.text);
    expect(new TextDecoder().decode(bytes.slice(f.index.byteStart, f.index.byteEnd))).toBe(url);
  });

  test('facet offsets survive multibyte text', () => {
    const p = { lines: [{ text: 'crème brûlée 🍮 forever' }] };
    const r = poemReply(p, url);
    const f = r.facets[0];
    const bytes = new TextEncoder().encode(r.text);
    expect(new TextDecoder().decode(bytes.slice(f.index.byteStart, f.index.byteEnd))).toBe(url);
  });

  test('over-limit replies are refused, not truncated', () => {
    const p = { lines: [{ text: 'x'.repeat(400) }] };
    expect(poemReply(p, url)).toBe(null);
  });

  test('the two not-found wordings', () => {
    expect(notFoundReply(true).text).toBe('Cannot find one in your corpus. Maybe consider writing one?');
    expect(notFoundReply(false).text).toBe('Cannot find one in their corpus. Maybe consider telling them to write one?');
  });

  test('error replies link the pinned post', () => {
    const r = errorReply('"12" exceeds allowed bounds', 'https://bsky.app/profile/x/post/pin');
    expect(r.text).toBe('Error: "12" exceeds allowed bounds. Please refer to https://bsky.app/profile/x/post/pin');
    const f = r.facets[0];
    const bytes = new TextEncoder().encode(r.text);
    expect(new TextDecoder().decode(bytes.slice(f.index.byteStart, f.index.byteEnd)))
      .toBe('https://bsky.app/profile/x/post/pin');
  });
});

describe('server-side finding', () => {
  test('finds the poem and its source post, urls stripped', () => {
    const posts = [
      { text: 'just some ordinary filler with a link https://example.com/x', uri: 'at://d/app.bsky.feed.post/aa' },
      { text: 'the old silent pond where a green frog jumps into the still cold water', uri: 'at://d/app.bsky.feed.post/bb' },
    ];
    const found = findBest(corpusFromPosts(posts), [5, 7, 5]);
    expect(found.url).toBe('https://bsky.app/profile/d/post/bb');
    expect(found.poem.lines.map((l) => l.text)).toEqual([
      'the old silent pond', 'where a green frog jumps into', 'the still cold water',
    ]);
  });

  test('prefers a whole-clause poem over a mid-sentence one', () => {
    const posts = [
      { text: 'well the old silent pond where a green frog jumps into the still cold water indeed', uri: 'at://d/app.bsky.feed.post/span' },
      { text: 'Hello. the old silent pond where a green frog jumps into the still cold water. Bye.', uri: 'at://d/app.bsky.feed.post/clause' },
    ];
    const found = findBest(corpusFromPosts(posts), [5, 7, 5]);
    expect(found.url).toContain('/post/clause');
  });

  test('nothing to find returns null', () => {
    expect(findBest(corpusFromPosts([{ text: 'too short', uri: 'at://d/app.bsky.feed.post/x' }]), [5, 7, 5])).toBe(null);
  });
});
