# bsky-50k-blocklist

A Bluesky moderation list that automatically blocks every account with >50,000 followers, plus a visualization dashboard for analyzing who blocks you back.

**Subscribe:** https://bsky.app/profile/yuxi.ml/lists/3mhhqs5j47p26

## Crawler (`index.ts`)

Creates and maintains an `app.bsky.graph.list` (moderation list) on your Bluesky account. Subscribe to it as a block list and it just works — new accounts are added as they cross the threshold.

### Discovery phases

1. **Suggested follows** — Bluesky's own recommendations, batch-checked via `getProfiles`
2. **Search** — ~100 terms across topics, media orgs, sports, tech, job titles, etc.
3. **Following crawl** — BFS through who discovered accounts follow (popular accounts follow each other), repeating in rounds until diminishing returns (<3 new per round)

### State management

All state persists to `state/state.json`:
- `discovered` — accounts with ≥50k followers (did, handle, follower count)
- `checked` — all DIDs ever inspected (prevents re-checking)
- `crawledFollowing` — DIDs whose following list has been crawled
- `completedPhases` — which discovery phases are done (skipped on re-run)
- `listUri` — AT URI of the moderation list
- `listMembers` — DIDs already added to the list

Ctrl+C safe (SIGINT handler saves state). Fully resumable.

### Usage

```bash
bun install
```

```bash
# Full pipeline: discover + create/update list
BSKY_HANDLE=you.bsky.social BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx bun run index.ts

# Discover only (no list writes)
bun run index.ts discover

# Build/update list from existing discoveries
bun run index.ts build

# Show stats
bun run index.ts stats
```

Get an app password at [bsky.app/settings/app-passwords](https://bsky.app/settings/app-passwords).

### How the list works

It's just AT Protocol records in your repo:

```
app.bsky.graph.list/3abc...       <- the list itself (name, purpose: modlist)
app.bsky.graph.listitem/3def...   <- one per blocked account (subject: did, list: at://...)
app.bsky.graph.listitem/3ghi...
...
```

Anyone can subscribe at `https://bsky.app/profile/{handle}/lists/{rkey}`. Subscriptions are dynamic — new items take effect immediately for all subscribers.

### Rate limits

- Creates cost 3 points each; 5,000 points/hour, 35,000/day
- List population uses `applyWrites` batches (50 items/call)
- Discovery respects ~7.5 req/sec with exponential backoff on 429s (up to 10 min waits)

A full first run takes 30–60 minutes. Subsequent runs skip completed phases and already-checked profiles.

### Cron

```bash
0 */6 * * * cd /path/to/bsky-blocklist && BSKY_HANDLE=... BSKY_APP_PASSWORD=... bun run index.ts >> cron.log 2>&1
```

## Block analysis visualization (`viz/`)

A React + Vite dashboard that visualizes who blocked you back, built with a cyberpunk dark theme.

### Data pipeline

1. **Fetch blocks** — uses the [Constellation API](https://constellation.microcosm.blue) (same backend as pdsls.dev) to find all `app.bsky.graph.block` records targeting your DID
2. **Decode timestamps** — AT Protocol record keys (TIDs) encode microsecond timestamps in base32-sortable
3. **Fetch profiles** — batch `getProfiles` via the public Bluesky API (no auth needed)
4. **Generate viz** — `viz.ts` produces a static `viz.html`, or run the React app in `viz/`

### Dashboard sections

1. **Stats cards** — total blocks, total followers of blockers, count with ≥50k, time span
2. **Block timeline** — hourly-bucketed bar chart (canvas) showing when blocks arrived
3. **Follower histogram** — log-scale distribution of blocker follower counts (canvas)
4. **Word cloud + concordance** — interactive `@visx/wordcloud` built from blocker bios
   - Click a word → right panel shows KWIC (keyword-in-context) concordance with handle attribution
   - Click same word or background or press Escape → deselect
   - Layout is computed once and frozen — clicking doesn't jostle words

### Running the viz

```bash
cd viz
bun install
bun run dev --port 8086 --host 0.0.0.0
```

### Key dependencies

- `@visx/wordcloud` — d3-cloud layout with React render-prop pattern
- `@visx/text` — SVG text rendering with word wrapping
- Canvas API — timeline and histogram charts (no library needed)

## Project structure

```
bsky-blocklist/
  index.ts              # crawler + list builder
  viz.ts                # static HTML viz generator (standalone)
  package.json          # @atproto/api
  state/                # persisted crawler state (gitignored)
    state.json
  viz/                  # React dashboard app
    src/
      App.tsx           # all charts + word cloud + concordance
      App.css           # cyberpunk dark theme
    public/
      blocks-decoded.json
      blocker-profiles.json
```

## APIs used

| API | Purpose |
|-----|---------|
| `bsky.social/xrpc/app.bsky.actor.getSuggestions` | Seed discovery |
| `bsky.social/xrpc/app.bsky.actor.searchActors` | Search-based discovery |
| `bsky.social/xrpc/app.bsky.actor.getProfiles` | Batch follower count checks (25/call) |
| `bsky.social/xrpc/app.bsky.graph.getFollows` | Crawl who popular accounts follow |
| `bsky.social/xrpc/com.atproto.repo.applyWrites` | Batch-create list items (50/call) |
| `constellation.microcosm.blue/links` | Fetch backlinks (who blocked you) |
| `public.api.bsky.app/xrpc/app.bsky.actor.getProfiles` | Unauthenticated profile lookups |

## License

Public domain. Do whatever you want.
