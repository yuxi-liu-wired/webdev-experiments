2026-07-26 - apostrophes, decided

The operator conjectured apostrophes were decidable by dictionary, and the
data proved her right: leading-apostrophe English is a closed class of
fifteen words ('bout 'cause 'course 'cuse 'em 'frisco 'gain 'kay 'm 'n
'round 's 'til 'tis 'twas), and CMUdict lists all 810 trailing-apostrophe
forms, with s'-possessives productive beyond it. The quote gate now
classifies each single quote: interior = always linguistic; leading = the
fifteen or a quotation; trailing = dictionary hit or s' or a quotation;
isolated or opening-curly = quotation. So don't, boys', goin' and 'em pass
where 'quoted verse' is rejected as cited voice — contractions sacred,
citations barred, nothing hand-waved.

2026-07-26 - quotation marks are someone else's voice

The operator asked how quotes are handled; the honest answer was
"incoherently". Now: the strict stack and bot replies reject any poem
containing a double-quote-family mark or sitting immediately beside one —
quoted text is cited voice, and the machine must not discover Basho in
someone's quotation and attribute him to the poster. Apostrophes are
deliberately untouched, since 'quote' and don't cannot be told apart without
parsing and contractions are sacred. The site's opt-in straddle mode keeps
its permissive aesthetic. The first version of the gate only checked inside
the span and the test caught it: segmentation cuts at the quote marks, so a
fully quoted poem contains none — the gate now checks the neighbors too.

2026-07-26 - first contact, two lessons

The bot's first real evening produced its first two bugs, both from the
operator's own mentions. One: a mention was answered twice — the daemon was
killed for an env reload in the window between posting a reply and marking
the notification seen, and its successor answered again. Replies are now
idempotent: the bot checks the thread for its own reply before answering,
which also covers serverless cold-start double-fires. Two: "tanka" returned
a metrically perfect 5-7-5-7-7 that read as word salad, straddling "..." and
"?" — the permissive cascade's cross scope, which the site's defaults never
show and the pinned manual's "strict rules" never promised. findBest now
applies the full strict gates plus a bot-only rule: a reply poem is one
breath, crossing commas but never a sentence ender. Under the new gates the
operator's command gets the honest "Cannot find one in your corpus", which
agrees with the website. The duplicate reply was deleted.

2026-07-26 - the firehose comes home

The operator rebuilt the box's egress as a hostname-policy squid proxy and
allowlisted .bsky.app/.bsky.social/.bsky.network. Everything this project
was missing follows at once: tools/capture-jetstream.py subscribes to
Jetstream through the proxy (websocket-client speaks HTTP CONNECT; frames
are JSON, so no CAR decoding), writing slim survey-ready records. First run
replays the buffer at ~485 posts/s. The mention bot's read path also works
direct now — bun's fetch follows the proxy env — so byparr returns to being
the anti-bot renderer only. The unfiltered rarity table, the thing every
number so far has carried a bias-asterisk for, is now just an accumulation
delay away.

2026-07-26 - all the home data, one table

The survey now takes multiple captures and dedupes across them; every file
in /workspace/firehose-data is folded in: 3,117,811 unique posts, 207,349
strict finds, 330 seconds. Precision notes at the new scale: monovocalic is
the rarest single badge (1 in 1.56M), sanmyaku settles at 1 in 240k (the
May windows held a dozen more mountains, including a geography-hashtag post
whose country names form a perfect 2-3/2-3-2/3-2), and the three-badge
crowns tie at 1 in 3.1M — Port Maritime now leads on badge count, since
being French makes it stopword-free in English. The firehose capture for an
unfiltered table remains one host-side paste (tools/capture-posts.py); the
egress-proxy redesign that would make such walls stop mattering is filed in
CONTAINERFILE-REQUESTS.md.

2026-07-26 - spam out of the prior

The operator asked where a quoted rarity number came from, and the answer
exposed two faults at once: I had asserted a flair without checking the
table (the combination had sightings), and the sightings were the Blood
clot spam — whose display score the uniqueness exponent had crushed, but
whose mask still polluted the rarity prior. Finds below 0.5 uniqueness are
now excluded from mask counts, on the same logic as the display discount:
repetition may not define how rare a combination is. After the resurvey,
isosyllabic+stopless is honestly unseen and the secret achievement's
1-in-3,050,618 is real.

2026-07-26 - 七歩之才

The secret achievement: when the isosyllabic badge fires at n=7, the flair
names it 七歩之才 — Cao Zhi's talent of seven paces, the poem composed under
an impossible constraint. Implementation is exactly the trivial change it
sounds like: isoN rides out of badges() as an annotation (excluded from the
mask, so the rarity table is untouched), and flair() renames the badge when
it equals seven. The dictionary holds 105 plain seven-syllable words
(epidemiologist, heterogeneity, incompatibility...), so a 7-7-7-7 tanaga is
composable as deliberate bait but has never once occurred wild in 1.5M
posts. That asymmetry is the point: the intent filters catch formatting, not
determination, and moots farming the unlock by posting polysyllabic
monstrosities is the battle economy working as designed.

2026-07-26 - three operator badges

isosyllabic (every word the same count; for a 5-7-5 the arithmetic permits
only n=1, while a tanaga could hold four seven-syllable words), sanmyaku 山脈
(2-3 / 2-3-2 / 3-2), and stopless (no function words). Badge logic now
genuinely lives once in public/src/badges.js — the earlier consolidation
claim was half-true, and adding badges in two places is how it got caught.
The survey re-measured everything: isosyllabic 1 in 21,790, stopless 1 in
157 (the corpus is headlines, which are already telegraphic), and sanmyaku,
after banning digit posts from the structural badges (lottery results scan
as "thirty / twenty-one" mountains), exactly one sighting in 1,525,309:
"Stockton homicide / suspect arrested during / Nevada County". A crime
headline is the rarest accidental shape of the week.

2026-07-26 - shininess on the website

The whole rarity apparatus now runs in the browser: public/src/badges.js is
the shared badge module (the node tools keep their own loaders but the logic
lives once), public/data/meter.txt carries per-word stress and rhyme tails
front-coded (2.3 MB raw, ~700 KB compressed, loaded eagerly at boot — the
operator's ruling: people stream 10 MB images, stop being precious), and
public/data/rarity.json is the slim measured table. Badge-eligible poems get
flair and the results are ranked shiniest first; the e2e suite plants the
whale poem mid-prose and checks it comes back badged and on top. The mention
bot shares the same modules, so site and bot cannot disagree about glory.

2026-07-26 - reading the shinies

Actually reading the ranked anthology caught the next exploit: digit-heavy
posts ("2026 10:09 PM") farmed all three orthographic badges, because those
badges judge written letters while digits are spoken as unseen words. The
written-form badges now require prose that is actually written: no
number-source words, at least 15 letters and 5 alphabetic words. That purge
promoted a new co-champion, unique in 1.5M posts: "Saturday morning /
cartoons bad? Why was this show / so racist. Nothing" (kigo + e-lipogram).
Remaining known cheapness, tolerated for now: -ation suffix rhymes are
abundant enough that three near-identical bureaucratic poems tie at 1 in
218k; rhymes within one suffix family could be discounted someday.

2026-07-26 - uniqueness-adjusted shininess

The operator's formula, rarity^(unique/total), closes the repetition exploit:
in log space the uniqueness ratio scales the bits of rarity, so repeated
words proportionally discount a find's claim on its badges. One refinement:
the ratio runs over content words only (function words neither pay nor pad),
since repeating "the" is grammar while repeating "blood clot" is farming.
Result on the real table: the Bloom poem keeps 1 in 1,525,309; "Blood clot!"
nine times drops from 1 in 762,655 to 1 in 5 with its badge list intact,
which reads as exactly the joke it deserves. pickRarest() now takes each
find's uniqueness into account, so an honest single-badge poem beats
decorated spam.

2026-07-26 - the rarity survey and the shininess measure

The week corpus turned out to be the url-feed's own captures in
/workspace/firehose-data — link-posts only, and the relay capture
double-delivers, so the survey dedupes by did:rkey: 1,525,309 unique posts,
107,122 strict finds. tools/strict-lib.mjs holds the shared gates and eight
badges (iambic, rhyme 1-3, triple rhyme, kigo with a collocation blocklist,
e-lipogram, alphabetical word order, monovocalic, stress palindrome);
tools/rarity-survey.mjs streams a capture at ~15k posts/s and writes
data/rarity.json with per-badge and per-combination counts plus specimens.

Measured, per unique post: iambic 1 in 242, kigo 1 in 415, stress-palindrome
1 in 438, e-lipogram 1 in 2.5k, rhyme 1-3 1 in 7.4k, monovocalic 1 in 13k,
alphabetical 1 in 15k, triple rhyme 1 in 763k. Rarest combination sighted:
iambic+rhymed+kigo, exactly once — "We bloomed on Sunday / at Women Writers
in Bloom / A beautiful way".

bot/shiny.js turns the table into the posting measure: a find's rarity is
posts-scanned over finds carrying at least its badge set (supersets counted,
unseen combinations score above everything), tiers of sparkle emoji at powers
of ten, flair like "🌟🌟🌟 1 in 1,525,309 · iambic, rhymed, kigo", and
pickRarest() for the planned once-an-hour cadence. Unit-tested against a
synthetic table. Known exploit, unguarded for now: repetition spam ("Blood
clot!" nine times) earns four badges; a distinct-word ratio would kill it.

2026-07-26 - iambic and rhymed gates

tools/meter-lib.mjs now holds the shared meter machinery (CMUdict phones with
stress, the calibrated scansion rule, rhyme tails), and strict-haiku.mjs
gained --iambic (every line independently scans as iambs) and --rhyme (last
words of the first and final lines share a rhyme tail from the last stressed
vowel; identical words do not rhyme). On the 123,421-post capture the strict
stack's 5,854 finds fall to 331 iambic and then to 2 iambic-and-rhymed — one
genuine ("and Sophia hit / the showers. but Sophia / plans to get a bit",
hit/bit), one degenerate: a URL spelled out letter by letter, since letter
names scan freely and "p" rhymes with "d". Single-letter floods are now
rejected. Rate at maximum strictness: about one per sixty thousand posts,
which against the live firehose is still dozens a day.

2026-07-26 - the strict stack, tested on the firehose at home

tools/strict-haiku.mjs implements the firehose filter stack and ran against
the url-feed's local capture of 123,421 real posts. Gates, in order: found
span within a single source line (deliberate haiku write their line breaks);
dictionary words only; unambiguous counts (every word one pronunciation
length); no line ending on a function word; and the anti-intent rule — if the
author's own commas or slashes sit at every one of our line breaks, their
punctuation already wrote the poem, so it is not found. Whole-post-only was
dropped by design: the best finds live inside long posts, and the operator
named the semantic estrangement as the point.

Funnel: 62,907 raw finds, 40,923 single-line, 18,828 dict-only, 15,039
unambiguous, 5,927 clean-ended, 5,854 unintended, 4,928 distinct — about 4%
of posts. Against the real firehose's daily volume the strictest stack still
passes thousands a day, so a daily-best bot ranks, never scrapes.

Kigo ranking tested and found homonym-poisoned: it surfaced sea turtles and
the Magellanic Cloud, but also ranked Star Wars marketing and "Cloud
Platforms" study guides. Needs a collocation blocklist before it can be
trusted as the anthology editor.

2026-07-26 - iambic pentameter scanner

tools/iambic.mjs reads the stress digits the syllable build discards: each
CMUdict word becomes a 0/1/2 string per syllable, and a run of words scans as
pentameter when some choice of pronunciation variants puts every primary
stress of a polysyllabic word on a strong beat. Calibration against canon
forced two corrections: unstressed syllables must be allowed on strong beats
(promotion — "the QUAL-i-TY of MER-cy" was rejected before), and lines must
not end on a function word ("...random sentence with" scans but is nothing).
After both: all three canonical test lines found, both prose controls
rejected. Lines may cross commas, never sentence ends, line breaks, or post
boundaries; at least two polysyllabic words required so all-monosyllable mush
cannot scan. First live run on three accounts found 87, 123, and 243 lines.

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
