found haiku

A clone of the layout and typography of `https://b.mino.mobi/unique/`, rebuilt as a
found-poetry machine. It takes English text, normalizes it, splits on punctuation
and line breaks, counts the syllables of every word, and returns the runs that fall
into 5-7-5 exactly. Tanka, tanaga, and arbitrary custom patterns are also supported.

Running it:

```bash
cd /workspace/webdev-experiments/found-haiku
bun serve.mjs                              # http://localhost:8093/
bun test                                   # 28 engine tests
bun test/e2e.mjs                           # 16 browser checks
NO_API=1 bun serve.mjs 8094                # exactly what gets deployed
bun test/e2e.mjs http://localhost:8094/ --no-bsky
```

Screenshots land in `/tmp/haiku-shots`. The ports are arbitrary; pass a different
one as the first argument if these are taken.

Deploying

The site is `found-haiku/public/`, which is static: HTML, ES modules, and one text
file. It needs no build step and no server.

This project lives in a repository of several, so Netlify needs to be told which
one. Set the site's base directory to `found-haiku`. Netlify then reads
`found-haiku/netlify.toml`, whose `publish = "public"` resolves relative to that
base, and deploys `found-haiku/public/`. Without a base directory Netlify looks
for `netlify.toml` at the repository root, finds nothing, and publishes the wrong
tree.

`serve.mjs` does not deploy and is not needed in production. It does two jobs
locally: it gzips text assets, which Netlify does by itself, and it exposes
`/api/feed`, which exists only because this development container's firewall
denies `bsky.app`. The deployed page calls `public.api.bsky.app` directly from
the browser, which works because that API answers with
`access-control-allow-origin: *`. The proxy is a fallback taken only when the
direct call is refused, so one code path covers both environments.

Run the `NO_API=1` server above to reproduce the deployed site exactly: static
files, no proxy route. Everything except the Bluesky source is verifiable that
way from inside the container. The Bluesky source cannot be: reaching
`bsky.app` from a browser is precisely what this container forbids. The evidence
that it works when deployed is the CORS header on the live API, checked directly,
plus the browser check that the direct call is attempted before the fallback.

How the syllable counting works

Counts come from CMUdict, the CMU Pronouncing Dictionary, which records the actual
phonemes of 126,030 words. A syllable is a phoneme carrying a stress digit, so the
count is derived from pronunciation rather than spelling. This matters: "chocolate"
is two syllables, "camera" is three, "business" is two.

The table is built by `tools/build-dict.mjs` from `tools/cmudict.dict` into
`public/data/syllables.txt`, front-coded so shared prefixes are stored once. It is
806 KB raw and 278 KB compressed. The browser parses it in under 150 ms.

Words absent from the dictionary fall back to the rules engine in
`public/src/syllables.js`, which agrees with CMUdict on 91.5% of its 126,030 words. Any
word that came from the fallback is underlined in the results, so a reader can see
which numbers are a guess. The "dictionary words only" toggle drops those poems
entirely.

Numbers are spelled out before counting, so `1984` is read as "nineteen eighty
four" and counts as five syllables, while `1,250` is read as a quantity rather than
a year. Acronyms with no dictionary entry are spelled letter by letter, so `GDPR`
is four syllables.

Words with two accepted pronunciations, such as "fire", "hour", and "flower", carry
both counts. The "allow alternate pronunciations" toggle lets the matcher pick
whichever reading makes a line fit.

Scope

- whole clauses only: the poem must be an entire run of words between two
  punctuation marks or line breaks. This is the default and gives the best results,
  because the poem then has its own beginning and end.
- any run within a clause: the poem may start and end in the middle of a clause.
- straddle punctuation: commas and full stops are ignored. Blank lines still stop a
  poem, since a run crossing a paragraph break joins two unrelated thoughts.

Forms

`haiku` 5-7-5, `tanka` 5-7-5-7-7, and `tanaga` 7-7-7-7 have pills of their own. The
custom field accepts any pattern written as `5-7-5`, `5 7 5`, or `5,7,5`. Named
patterns the engine also recognizes are `lanterne` 1-2-3-4-1, `cinquain` 2-4-6-8-2,
`fib` 1-1-2-3-5-8, and `monoku` 17.

Sources

Paste text into the box, or drop a `.txt` file onto it. The Bluesky option mines an
account's posts instead, reading the public author feed straight from the browser.
See Deploying above for why a local proxy exists alongside that direct call.

Every control is live: changing the form, scope, or counting toggles re-runs the
search at once on whatever text is loaded, and edits to the text or the custom
pattern re-run it after a short pause. There is no apply step. Bluesky posts are
fetched once per handle and reused for settings changes; only the find button
fetches again.

Deep links: `?form=tanka`, `?pattern=2-4-6-8-2`, `?scope=cross`, `?handle=x.bsky.social`.

Layout

- `public/` - the deployed site, and nothing else
- `public/index.html` - page and styles, cloned from the original
- `public/app.js` - browser wiring, rendering, sources
- `public/src/syllables.js` - dictionary decoder, fallback rules engine, number reader
- `public/src/finder.js` - segmentation and the pattern matcher
- `public/data/syllables.txt` - the built syllable table, committed
- `netlify.toml` - publish directory and cache headers
- `serve.mjs` - local server: gzip, plus the Bluesky proxy route
- `tools/build-dict.mjs` - builds `public/data/syllables.txt` from CMUdict
- `tools/errors.mjs` - reports where the fallback rules disagree with CMUdict
- `test/engine.test.mjs` - engine tests
- `test/e2e.mjs` - browser tests

Rebuilding the dictionary

`tools/cmudict.dict` is not committed, since only the build tool reads it and its
output is. Fetch it first:

```bash
wget -O tools/cmudict.dict https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict
bun tools/build-dict.mjs      # rewrites public/data/syllables.txt, prints accuracy
bun tools/errors.mjs 3        # groups the fallback's remaining errors by suffix
```

`tools/errors.mjs` is how the fallback was tuned from 83.7% to 91.5%: it groups
mistakes by word ending, which is where the systematic ones show up. What remains
is dominated by surnames and loanwords, which are dictionary problems rather than
rule problems.

Credits

Design cloned from `unique` at `https://b.mino.mobi/unique/`. Syllable data from
the CMU Pronouncing Dictionary. Sample text is `Alice's Adventures in Wonderland`
by Lewis Carroll, public domain, from Project Gutenberg.
