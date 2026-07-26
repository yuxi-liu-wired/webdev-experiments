2026-07-26 - the bot

The engine became a Bluesky bot: mention it and it replies with a poem found
in someone's posts. Grammar per the spec, both slots optional, any order (slots are named by
token shape: @-prefixed is the target, anything else the format):
@found-haiku <format> <@someone>, format = haiku|tanka|tanaga|[3-9]{3,9} with
digits read one line each, and the exact error wordings for malformed
requests, disallowed formats, out-of-bounds digits, and missing users, each
linking the pinned usage post.

Architecture: bot/parse.js (commands; mention facets carry pre-resolved DIDs,
the protocol's own parser, with resolveHandle for hand-typed handles),
bot/compose.js (replies; the 300-grapheme cap and UTF-8 byte offsets for link
facets are computed in one place), bot/engine.js (the browser engine loaded
server-side; URLs stripped to clause boundaries; scopes cascade
segment > span > cross so whole-clause poems win), bot/bsky.js (public
appview for reads, PDS session for writes, byparr routing for in-container
reads), bot/run.js (one poll cycle), and a Netlify scheduled function every
five minutes — createSession is rate-limited per day, so no faster. State is
Bluesky's own notification cursor: no database.

The dry run caught the engine miscounting "bluesky" (guessed 3, spoken 2) in
the platform's own posts, so the dictionary build gained a small supplement
list (bluesky, bsky, skeet, atproto, fediverse, emoji) — CMUdict predates
them all. That moved the table to 126,036 words and broke a test that had
encoded the undercount, plus the hardcoded count in the page footer and the
e2e check, now count-agnostic.

Untestable from the container: actually posting (auth POSTs cannot leave).
Tested: the whole read path live through byparr — parse, resolve, fetch,
find, compose — plus 20 unit tests on the pure logic. First real find, from
@bsky.app: "You can now reply / to specific messages / in group chats and
DMs".

The close button also gained its pale disk so it reads as a button.

2026-07-26 - screenshot-friendly cards

Two small card changes for arranging a screenshot to post: an unobtrusive
close button in each card's top-right corner removes that card from the list
(the found-counter deliberately keeps the true count), and the live-post link
is now labeled with the post's rkey instead of "the live post", so a cropped
screenshot still says exactly which post each poem came from. The close
button sits above the first line's syllable count; checked visually for
collision.

2026-07-26 - reactive settings

Changing a setting used to leave the old results on screen until find was
pressed again, which read as stuckness. Every control now re-runs the search
by itself: pills and checkboxes immediately, the text box and the custom
pattern field on a 400-500 ms debounce. A run started while another is in
flight queues one re-run for when it finishes, so the newest settings always
win and runs never interleave. A half-typed custom pattern is skipped rather
than reported as an error.

The trap was Bluesky: a pill click must not refetch ten pages of posts. The
fetched text and its post spans are cached per handle; settings changes
recompute from the cache in milliseconds, and only the find button fetches
fresh. Checked in the browser: a form change on mined posts produced 107 tanka
with zero network requests.

2026-07-26 - live-post links on Bluesky cards

Each poem found in a Bluesky account now carries "the live post" with an
external-link icon, opening the source post on bsky.app. The finder works on
one joined text blob, so the feature is an offset map: public/src/posts.js
records each post's [start, end) span at join time, a poem's start offset
resolves to the span it fell in, and the span's at:// URI converts to a
bsky.app permalink. Posts are joined with a blank line, which the finder
already treats as a paragraph boundary, so a poem can never straddle two posts
and the mapping is always unambiguous. Pasted text has no spans and renders no
link. Checked in the browser suite: every card's href matches the permalink
shape, 400 of 400.

2026-07-25 - initial build

Cloned the layout and typography of `https://b.mino.mobi/unique/` and rebuilt the
machinery underneath as a found-poetry finder: normalize, split at punctuation and
line breaks, count syllables, keep the runs that partition exactly into a target
form.

Syllable counting

The first version counted vowel groups with a pile of spelling rules and got 83.7%
of CMUdict right. That is not good enough when a single word being off by one
silently destroys or invents a poem. Two changes fixed it.

First, ship the dictionary. CMUdict records phonemes, so a syllable is a phone
carrying a stress digit, and the count is exact rather than inferred from spelling.
All 126,030 words are front-coded into `public/data/syllables.txt`: 806 KB raw,
278 KB compressed, parsed in the browser in under 150 ms. An earlier version stored
only the words the rules got wrong, which was 91 KB, but then a correct dictionary
word was indistinguishable from a lucky guess and the interface could not honestly
say which counts it trusted. The full table buys that distinction.

Second, tune the rules engine that handles everything outside the dictionary, since
names, slang and typos are exactly what real text is full of. `tools/errors.mjs`
groups mistakes by word ending, which is where systematic errors show up. That
found several rules that were confidently backwards: a subtraction for `y` after a
vowel that double-counted every `-ey` name, a vowel-splitting rule that fired on
`oo` and `ea` and broke every `-ood`, `-ook` and `-ead` word, and a silent-e rule
fighting a syllabic-l rule so that `able` came out as three. Fixing those took the
rules engine to 91.5%. What is left is dominated by surnames and loanwords, which
are dictionary problems rather than rule problems.

Words with two accepted readings, such as `fire` and `hour`, keep both counts, and
the matcher may use either to make a line fit. CMUdict lists the primary
pronunciation first, so the table preserves insertion order rather than sorting
numerically; sorting had quietly made `camera` two syllables instead of three.

Test fixtures

Several first-draft tests asserted syllable counts I had not computed. The invented
haiku used to test the finder turned out to be fourteen syllables, so it could
never have matched, and the test was measuring nothing. Every fixture is now either
computed from the engine or copied from a CMUdict entry quoted in a comment beside
it, so a reader can check the number without trusting me.

Scope

Straddling punctuation originally straddled paragraph breaks too, which produced
poems joining the end of one thought to the start of an unrelated one. Blank lines
now bound the search in every mode.

Deployment

The site is `public/`: static files, no build step. `serve.mjs` exists for local
development only. It gzips text assets, which Netlify does by itself, and it
exposes `/api/feed`, which is needed only because this container's firewall denies
`bsky.app`.

The deployed page reads Bluesky's public author feed directly from the browser.
That works because the API answers with `access-control-allow-origin: *`, checked
against the live endpoint rather than assumed. The local proxy is a fallback taken
only when the direct call is refused, so one code path serves both environments,
and the first refusal is remembered so later pages skip the attempt.

`NO_API=1 bun serve.mjs 8094` reproduces the deployed site exactly, and the browser
suite passes against it with `--no-bsky`. The one thing not verifiable from inside
the container is the direct Bluesky call itself, since reaching `bsky.app` from a
browser is precisely what the firewall forbids.

A note on the firewall

While building this I filed a request to add `bsky.app` to the outbound allowlist,
justified on the grounds that byparr could already reach it so allowing it directly
changed nothing. That argument is wrong, and it was withdrawn. It proves too much:
the same reasoning would justify allowlisting every domain byparr can fetch, which
is an argument against having an allowlist rather than for extending it. The
correct conclusion is the opposite one, that a capability already available through
a narrow deliberate route needs no second, wider route. Direct allowlisting would
have granted connection-oriented access that the byparr path does not.
