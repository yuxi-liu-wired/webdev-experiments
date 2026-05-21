import { describe, expect, test } from "bun:test";
import { classify } from "./classify";

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
};

describe("classify", () => {
  test("golden post is a URL list", () => {
    const r = classify(GOLDEN_POST);
    expect(r.isUrlList).toBe(true);
    expect(r.linkCount).toBe(7);
    expect(r.coverage).toBeGreaterThan(0.9);
  });

  test("pure URL list with no header passes", () => {
    const text = "foo.com/a\nbar.com/b\nbaz.com/c";
    const bytes = new TextEncoder().encode(text);
    expect(bytes.length).toBe(29);
    const facets = [
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://foo.com/a" }], index: { byteStart: 0, byteEnd: 9 } },
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://bar.com/b" }], index: { byteStart: 10, byteEnd: 19 } },
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://baz.com/c" }], index: { byteStart: 20, byteEnd: 29 } },
    ];
    expect(classify({ text, facets }).isUrlList).toBe(true);
  });

  test("single link is rejected (needs ≥2)", () => {
    const text = "foo.com/a";
    const facets = [
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://foo.com/a" }], index: { byteStart: 0, byteEnd: 9 } },
    ];
    expect(classify({ text, facets }).isUrlList).toBe(false);
  });

  test("prose with embedded links is rejected", () => {
    const text = "I really love these articles, check them out: foo.com/a and bar.com/b too";
    const facets = [
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://foo.com/a" }], index: { byteStart: 46, byteEnd: 55 } },
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://bar.com/b" }], index: { byteStart: 60, byteEnd: 69 } },
    ];
    const r = classify({ text, facets });
    expect(r.isUrlList).toBe(false);
    expect(r.coverage).toBeLessThan(0.5);
  });

  test("post with only mention facets (no links) is rejected", () => {
    const text = "@alice.bsky.social @bob.bsky.social";
    const facets = [
      { features: [{ $type: "app.bsky.richtext.facet#mention", did: "did:plc:a" }], index: { byteStart: 0, byteEnd: 18 } },
      { features: [{ $type: "app.bsky.richtext.facet#mention", did: "did:plc:b" }], index: { byteStart: 19, byteEnd: 35 } },
    ];
    expect(classify({ text, facets }).isUrlList).toBe(false);
  });

  test("no facets is rejected", () => {
    expect(classify({ text: "just some text" }).isUrlList).toBe(false);
  });

  test("URL-list with emoji header passes", () => {
    const headerEmoji = "🔗\n";
    const headerBytes = new TextEncoder().encode(headerEmoji).length;
    const link1 = "foo.com/a";
    const link2Start = headerBytes + link1.length + 1;
    const text = `${headerEmoji}${link1}\nbar.com/b`;
    const facets = [
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://foo.com/a" }], index: { byteStart: headerBytes, byteEnd: headerBytes + 9 } },
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://bar.com/b" }], index: { byteStart: link2Start, byteEnd: link2Start + 9 } },
    ];
    expect(classify({ text, facets }).isUrlList).toBe(true);
  });

  test("overlapping facets count once (Uint8Array sweep)", () => {
    const text = "foo.com\nbar.com";
    const facets = [
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://foo.com" }], index: { byteStart: 0, byteEnd: 7 } },
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://foo.com" }], index: { byteStart: 0, byteEnd: 7 } },
      { features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://bar.com" }], index: { byteStart: 8, byteEnd: 15 } },
    ];
    const r = classify({ text, facets });
    expect(r.coverage).toBeCloseTo(1, 5);
    expect(r.isUrlList).toBe(true);
  });
});
