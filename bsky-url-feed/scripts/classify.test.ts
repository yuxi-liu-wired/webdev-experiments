import { describe, expect, test } from "bun:test";
import { classify } from "./classify";

const YUXI_DID = "did:plc:rpe5afe3qleyyzkdcs2nnvwx";

const GOLDEN_POST = {
  text: "sources\n\nplato.stanford.edu/entries/soph...\nen.wikipedia.org/wiki/Collyri...\nen.wikipedia.org/wiki/Adamites\n\nia800501.us.archive.org/18/items/Epi...\nen.wikipedia.org/wiki/Angelic...\nen.wikipedia.org/wiki/Bakiribu\nmegasun.bch.umontreal.ca/protists/rec...",
  facets: [
    { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://plato.stanford.edu/entries/sophists" }], index: { byteEnd: 43, byteStart: 9 } },
    { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://en.wikipedia.org/wiki/Collyridianism" }], index: { byteEnd: 76, byteStart: 44 } },
    { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://en.wikipedia.org/wiki/Adamites" }], index: { byteEnd: 107, byteStart: 77 } },
    { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://ia800501.us.archive.org/18/items/Epi" }], index: { byteEnd: 148, byteStart: 109 } },
    { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://en.wikipedia.org/wiki/Angelici_(sect)" }], index: { byteEnd: 181, byteStart: 149 } },
    { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://en.wikipedia.org/wiki/Bakiribu" }], index: { byteEnd: 212, byteStart: 182 } },
    { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://megasun.bch.umontreal.ca/protists/reclino/taxonomy.html" }], index: { byteEnd: 253, byteStart: 213 } },
  ],
  reply: {
    parent: { uri: `at://${YUXI_DID}/app.bsky.feed.post/3mmcc4335nc2y` },
    root: { uri: `at://${YUXI_DID}/app.bsky.feed.post/3mmcc3viksc2y` },
  },
  authorDid: YUXI_DID,
  authorHandle: "yuxi.ml",
};

function selfReply(authorDid: string) {
  return {
    reply: {
      parent: { uri: `at://${authorDid}/app.bsky.feed.post/3aaaaaaaaaaaa` },
      root: { uri: `at://${authorDid}/app.bsky.feed.post/3aaaaaaaaaaab` },
    },
    authorDid,
  };
}

describe("classify", () => {
  test("golden post passes (>=4 links, self-reply, >90% char coverage, non-bot)", () => {
    const r = classify(GOLDEN_POST);
    expect(r.isUrlList).toBe(true);
    expect(r.linkCount).toBe(7);
    expect(r.coverage).toBeGreaterThan(0.9);
  });

  test("(1) 3 links is rejected (needs >=4)", () => {
    const text = "a.com\nb.com\nc.com";
    const facets = [
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://a.com" }], index: { byteStart: 0, byteEnd: 5 } },
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://b.com" }], index: { byteStart: 6, byteEnd: 11 } },
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://c.com" }], index: { byteStart: 12, byteEnd: 17 } },
    ];
    const r = classify({ text, facets, ...selfReply("did:plc:author1"), authorHandle: "author1.bsky.social" });
    expect(r.isUrlList).toBe(false);
    expect(r.reason).toContain("only 3");
  });

  test("(2a) top-level post (no reply) is rejected even with many links", () => {
    const text = "a.com\nb.com\nc.com\nd.com\ne.com";
    const facets = Array.from({ length: 5 }, (_, i) => ({
      features: [{ $type: "app.bsky.richtext.facet#link", uri: `https://x${i}.com` }],
      index: { byteStart: i * 6, byteEnd: i * 6 + 5 },
    }));
    const r = classify({ text, facets, authorDid: "did:plc:author1", authorHandle: "author1.bsky.social" });
    expect(r.isUrlList).toBe(false);
    expect(r.reason).toBe("not a reply");
  });

  test("(2b) reply to another author's post is rejected", () => {
    const text = "a.com\nb.com\nc.com\nd.com\ne.com";
    const facets = Array.from({ length: 5 }, (_, i) => ({
      features: [{ $type: "app.bsky.richtext.facet#link", uri: `https://x${i}.com` }],
      index: { byteStart: i * 6, byteEnd: i * 6 + 5 },
    }));
    const r = classify({
      text,
      facets,
      reply: { parent: { uri: "at://did:plc:someoneelse/app.bsky.feed.post/3xxx" } },
      authorDid: "did:plc:author1",
      authorHandle: "author1.bsky.social",
    });
    expect(r.isUrlList).toBe(false);
    expect(r.reason).toBe("reply to another author");
  });

  test("(3) 4-link self-reply with 70% char coverage is rejected (needs >=90%)", () => {
    // ~30% of chars are non-link prose
    const text = "hey i think you should look at these very interesting articles okay a.com b.com c.com d.com";
    const facets = [
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://a.com" }], index: { byteStart: 69, byteEnd: 74 } },
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://b.com" }], index: { byteStart: 75, byteEnd: 80 } },
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://c.com" }], index: { byteStart: 81, byteEnd: 86 } },
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://d.com" }], index: { byteStart: 87, byteEnd: 92 } },
    ];
    const r = classify({ text, facets, ...selfReply("did:plc:author1"), authorHandle: "author1.bsky.social" });
    expect(r.isUrlList).toBe(false);
    expect(r.coverage).toBeLessThan(0.5);
  });

  test("(3) char count, not byte count, applies for non-ASCII text", () => {
    // 4 short URLs + emoji header. Emoji is 1 codepoint / 4 bytes — char count differs
    // significantly from byte count and ensures we're measuring chars.
    const emojiHeader = "📚\n";
    const links = "a.com\nb.com\nc.com\nd.com";
    const text = emojiHeader + links;
    const emojiBytes = new TextEncoder().encode(emojiHeader).length;
    const facets = [0, 1, 2, 3].map((i) => ({
      features: [{ $type: "app.bsky.richtext.facet#link", uri: `https://x${i}.com` }],
      index: { byteStart: emojiBytes + i * 6, byteEnd: emojiBytes + i * 6 + 5 },
    }));
    const r = classify({ text, facets, ...selfReply("did:plc:author1"), authorHandle: "author1.bsky.social" });
    // Non-whitespace chars: 1 emoji + 20 link chars = 21. Covered: 20 link chars. 20/21 = 95%.
    expect(r.isUrlList).toBe(true);
    expect(r.coverage).toBeCloseTo(20 / 21, 2);
  });

  test("(4) account with 'bot' in handle is rejected (e621-post-bot.bsky.social)", () => {
    const r = classify({
      ...GOLDEN_POST,
      authorHandle: "e621-post-bot.bsky.social",
    });
    expect(r.isUrlList).toBe(false);
    expect(r.reason).toBe("bot author");
  });

  test("(4) bots\\d+ pattern matches (bot42.bsky.social)", () => {
    const r = classify({ ...GOLDEN_POST, authorHandle: "bot42.bsky.social" });
    expect(r.isUrlList).toBe(false);
    expect(r.reason).toBe("bot author");
  });

  test("(4) account with bot label is rejected", () => {
    const r = classify({
      ...GOLDEN_POST,
      authorLabels: [{ val: "bot" }],
    });
    expect(r.isUrlList).toBe(false);
    expect(r.reason).toBe("bot author");
  });

  test("(4) 'notabot' handle is NOT misclassified as bot (substring false positive)", () => {
    const r = classify({ ...GOLDEN_POST, authorHandle: "notabot.bsky.social" });
    expect(r.isUrlList).toBe(true);
  });

  test("mention-only post is rejected (no link facets)", () => {
    const text = "@a.bsky.social @b.bsky.social @c.bsky.social @d.bsky.social";
    const facets = Array.from({ length: 4 }, (_, i) => ({
      features: [{ $type: "app.bsky.richtext.facet#mention", did: `did:plc:m${i}` }],
      index: { byteStart: i * 15, byteEnd: i * 15 + 14 },
    }));
    const r = classify({ text, facets, ...selfReply("did:plc:author1"), authorHandle: "alice.bsky.social" });
    expect(r.isUrlList).toBe(false);
  });
});
