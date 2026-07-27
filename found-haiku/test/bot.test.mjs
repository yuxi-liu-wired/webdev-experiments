import { expect, test, describe } from 'bun:test';
import { readFileSync } from 'node:fs';
import { parseCommand, facetMentions } from '../bot/parse.js';
import { poemReply, notFoundReply, errorReply, graphemes } from '../bot/compose.js';
import { corpusFromPosts, findBest, loadCounter, rengaChain } from '../bot/engine.js';
import { rengaStanzaReply, rengaMissReply } from '../bot/compose.js';
import { shininess, flair, pickRarest } from '../public/src/shiny.js';
import { decodeMeter, badges, uniqueness } from '../public/src/badges.js';
import { findPoems } from '../public/src/finder.js';

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

describe('the operator badges', () => {
  const counter = loadCounter();
  const meter = decodeMeter(readFileSync(new URL('../public/data/meter.txt', import.meta.url).pathname, 'utf8'));
  const poemOf = (text) => {
    const { poems } = findPoems(text, counter, { pattern: [5, 7, 5], scope: 'span', alternates: false });
    expect(poems.length).toBeGreaterThan(0);
    return poems[0];
  };
  const badgesOf = (text) => {
    const p = poemOf(text);
    return badges(p, text.slice(p.start, p.end), meter);
  };

  test('isosyllabic: an all-monosyllable haiku (the only n a 5-7-5 permits)', () => {
    const b = badgesOf('big frogs jump in ponds when soft rain falls down on them at dusk each spring day');
    expect(b.isosyllabic).toBe(true);
    expect(badgesOf('the old silent pond where a green frog jumps into the still cold water').isosyllabic).toBe(false);
  });

  test('sanmyaku: word syllables rise and fall 2-3 / 2-3-2 / 3-2', () => {
    const b = badgesOf('quiet elephant hidden elephant walking elephant sleeping');
    expect(b.sanmyaku).toBe(true);
    expect(badgesOf('the old silent pond where a green frog jumps into the still cold water').sanmyaku).toBe(false);
  });

  test('stopless: no function words anywhere', () => {
    const b = badgesOf('elephants wander seventeen syllables land perfectly today');
    expect(b.stopless).toBe(true);
    expect(b.isosyllabic).toBe(false);
    expect(badgesOf('big frogs jump in ponds when soft rain falls down on them at dusk each spring day').stopless).toBe(false);
  });

  test('七歩之才: every word seven syllables unlocks the secret name', () => {
    // telecommunications=7, unavailability=7, verified against the table
    const text = 'telecommunications unavailability';
    const { poems } = findPoems(text, counter, { pattern: [7, 7], scope: 'span', alternates: false });
    expect(poems.length).toBe(1);
    const b = badges(poems[0], text, meter);
    expect(b.isosyllabic).toBe(true);
    expect(b.isoN).toBe(7);
    const table = { scanned: 1_000_000, masks: { plain: 1000 } };
    const line = flair(shininess(table, b, 1));
    expect(line).toContain('七歩之才');
    expect(line).not.toContain('isoN');
  });

  test('uniqueness discounts the elephant refrain', () => {
    const p = poemOf('quiet elephant hidden elephant walking elephant sleeping');
    expect(uniqueness(p)).toBeCloseTo(5 / 7); // 7 content tokens, elephant thrice -> 5 distinct
  });
});

describe('shininess', () => {
  // a toy table: 1M posts, mostly plain finds, a few badged
  const table = {
    scanned: 1_000_000,
    masks: { plain: 50_000, iambic: 900, 'iambic+kigo': 90, 'iambic+rhyme13+kigo': 2 },
  };

  test('rarity counts supersets, so more badges is always rarer', () => {
    const plain = shininess(table, {});
    const iambic = shininess(table, { iambic: true });
    const both = shininess(table, { iambic: true, kigo: true });
    const all = shininess(table, { iambic: true, kigo: true, rhyme13: true });
    expect(plain.rarity).toBeLessThan(iambic.rarity);
    expect(iambic.rarity).toBeLessThan(both.rarity);
    expect(both.rarity).toBeLessThan(all.rarity);
    expect(iambic.rarity).toBe(Math.round(1_000_000 / 992)); // 900+90+2 sightings
  });

  test('an unprecedented combination beats everything in the table', () => {
    const unseen = shininess(table, { monovocalic: true });
    expect(unseen.rarity).toBe(2_000_000);
    expect(unseen.tier).toBe('🌟🌟🌟');
  });

  test('flair reads like a shiny announcement', () => {
    const shine = shininess(table, { iambic: true, rhyme13: true, kigo: true });
    expect(flair(shine)).toBe('🌟🌟 1 in 500,000 · iambic, rhymed, kigo');
    expect(flair(shininess(table, {}))).toBe('');
  });

  test('uniqueness discounts rarity in log space', () => {
    const badged = { iambic: true, kigo: true, rhyme13: true };
    const clean = shininess(table, badged, 1);
    const spam = shininess(table, badged, 2 / 17); // "Blood clot!" nine times
    const mild = shininess(table, badged, 11 / 12); // one repeated content word
    expect(clean.rarity).toBe(500000);
    expect(spam.rarity).toBeLessThan(10);
    expect(spam.tier).toBe('');
    expect(mild.rarity).toBeGreaterThan(100000);
    expect(mild.rarity).toBeLessThan(clean.rarity);
  });

  test('pickRarest is uniqueness-adjusted', () => {
    const best = pickRarest(table, [
      { id: 'spam', badges: { iambic: true, kigo: true }, uniqueness: 0.15 },
      { id: 'honest', badges: { iambic: true }, uniqueness: 1 },
    ]);
    expect(best.id).toBe('honest'); // fewer badges, but it earned them
  });

  test('pickRarest takes the rarest of the batch', () => {
    const best = pickRarest(table, [
      { id: 'a', badges: { iambic: true } },
      { id: 'b', badges: { iambic: true, kigo: true } },
      { id: 'c', badges: {} },
    ]);
    expect(best.id).toBe('b');
  });
});

describe('renga', () => {
  const hokkuCorpus = corpusFromPosts([
    { text: 'the old silent pond where a green frog jumps into the still cold water', uri: 'at://a/app.bsky.feed.post/h' },
  ]);
  const wakiCorpus = corpusFromPosts([
    { text: 'silent morning fog covers the harbor slowly turning', uri: 'at://b/app.bsky.feed.post/w' },
  ]);

  test('renga command parses several guests in order', () => {
    const c = parseCommand('@found-haiku renga @first.bsky.social @second.bsky.social', BOT, null);
    expect(c.formatName).toBe('renga');
    expect(c.renga.map((t) => t.handle)).toEqual(['first.bsky.social', 'second.bsky.social']);
    expect(parseCommand('@found-haiku renga', BOT, null).error).toBe('malformed request');
    expect(parseCommand('@found-haiku renga @a @b @c @d @e', BOT, null).error).toBe('malformed request');
  });

  test('the chain alternates 5-7-5 and 7-7, one voice each', () => {
    const chain = rengaChain([
      { handle: 'a', did: 'did:a', corpus: hokkuCorpus },
      { handle: 'b', did: 'did:b', corpus: wakiCorpus },
    ]);
    expect(chain.missing).toBeUndefined();
    expect(chain.stanzas.length).toBe(2);
    expect(chain.stanzas[0].pattern).toEqual([5, 7, 5]);
    expect(chain.stanzas[1].pattern).toEqual([7, 7]);
    expect(chain.stanzas[1].poem.lines.map((l) => l.text)).toEqual([
      'silent morning fog covers', 'the harbor slowly turning',
    ]);
  });

  test('a voice with no stanza names the miss', () => {
    const chain = rengaChain([
      { handle: 'a', did: 'did:a', corpus: hokkuCorpus },
      { handle: 'empty', did: 'did:e', corpus: corpusFromPosts([{ text: 'too short', uri: 'at://e/app.bsky.feed.post/x' }]) },
    ]);
    expect(chain.missing).toBe('empty');
    expect(rengaMissReply(chain.missing, chain.pattern).text)
      .toBe("Cannot find a 7-7 stanza in @empty's corpus. A renga needs every voice.");
  });

  test('stanza posts carry attribution and exact facet offsets', () => {
    const chain = rengaChain([
      { handle: 'a.bsky.social', did: 'did:a', corpus: hokkuCorpus },
      { handle: 'b.bsky.social', did: 'did:b', corpus: wakiCorpus },
    ]);
    const r = rengaStanzaReply(chain.stanzas[0], 0, 2);
    expect(r.text.startsWith('1/2 — @a.bsky.social')).toBe(true);
    const bytes = new TextEncoder().encode(r.text);
    for (const f of r.facets) {
      const slice = new TextDecoder().decode(bytes.slice(f.index.byteStart, f.index.byteEnd));
      const feat = f.features[0];
      if (feat.$type.endsWith('#mention')) expect(slice).toBe('@a.bsky.social');
      else expect(slice).toBe(chain.stanzas[0].url);
    }
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

  test('apostrophes are decided by the dictionary, not banned', () => {
    const posts = [{
      text: "don't fret the old pond 'cause a green frog jumps into the boys' cold water",
      uri: 'at://d/app.bsky.feed.post/apos',
    }];
    // don't(1) fret(1) the(1) old(1) pond(1) | 'cause->cause(1) a(1) green(1) frog(1) jumps(1) into(2) | the(1) boys'(1) cold(1) water(2)
    const found = findBest(corpusFromPosts(posts), [5, 7, 5]);
    expect(found).not.toBe(null);
    expect(found.poem.lines[0].text).toContain("don't");
  });

  test("single-quoted text is still a citation", () => {
    const posts = [{
      text: "she wrote 'the old silent pond where a green frog jumps into the still cold water' once",
      uri: 'at://d/app.bsky.feed.post/sq',
    }];
    expect(findBest(corpusFromPosts(posts), [5, 7, 5])).toBe(null);
  });

  test('quoted text is not the author speaking', () => {
    const posts = [{
      text: 'she said "the old silent pond where a green frog jumps into the still cold water" today',
      uri: 'at://d/app.bsky.feed.post/q',
    }];
    expect(findBest(corpusFromPosts(posts), [5, 7, 5])).toBe(null);
  });

  test('nothing to find returns null', () => {
    expect(findBest(corpusFromPosts([{ text: 'too short', uri: 'at://d/app.bsky.feed.post/x' }]), [5, 7, 5])).toBe(null);
  });
});
