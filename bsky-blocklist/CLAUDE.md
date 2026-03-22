# CLAUDE.md — bsky-blocklist

## What this project does

Two tools for Bluesky moderation list management:

1. **Crawler** (`index.ts`) — discovers all Bluesky accounts with >50k followers and adds them to an `app.bsky.graph.list` moderation list. Subscribing to this list blocks all those accounts.
2. **Visualization** (`viz/`) — React dashboard showing who blocked you back, with timeline, follower histogram, and an interactive word cloud with concordance panel.

## Runtime

- **Bun** — used as both package manager and TypeScript runtime. No npm/npx.
- **Node.js compatibility** — the code uses standard APIs and `@atproto/api`, so it works under Node too, but bun is preferred.

## Key architecture decisions

### Crawler

- **State file** (`state/state.json`) is the source of truth. Every operation is resumable. The `completedPhases` array tracks which discovery phases are done so re-runs skip them.
- **`checked` set** (stored as array in state, loaded into a `Set` at runtime) prevents re-fetching profiles across restarts. Can grow to 100k+ entries — this is fine for JSON.
- **Batch writes** use `com.atproto.repo.applyWrites` (50 items/call) instead of individual `createRecord` calls. Falls back to retrying the same batch on failure, never to individual writes (that just makes rate limiting worse).
- **Rate limiting** — the `rateLimited()` wrapper handles 429s with exponential backoff up to 10 minutes, 10 retries. Write rate limits are hourly (5000 points/hr, creates cost 3 each), so backoff needs to be long.

### Visualization

- **Word cloud uses `@visx/wordcloud`** with a render-prop pattern. The layout (d3-cloud) is computed once and the positioned words are captured into a ref. Subsequent renders use the frozen positions directly in a static SVG — this prevents words from jostling when selection state changes.
- **Canvas charts** (timeline, histogram) are vanilla Canvas API in `useEffect`. No charting library needed for these.
- **Concordance** is built client-side from the profiles JSON using regex matching with surrounding context (50 chars before/after).

## Constellation API

The block analysis uses `constellation.microcosm.blue` (the backend behind pdsls.dev's backlinks feature):

```
GET /links?target={did}&collection=app.bsky.graph.block&path=.subject&limit=500
```

Returns `{ total, cursor, linking_records: [{ did, collection, rkey }] }`. Timestamps are decoded from the TID rkey (base32-sortable, top bits are microsecond timestamp, bottom 10 bits are clock ID).

## AT Protocol records

```
app.bsky.graph.list     → { $type, name, purpose: "app.bsky.graph.defs#modlist", description, createdAt }
app.bsky.graph.listitem → { $type, subject: "did:...", list: "at://...", createdAt }
```

That's it. The list is "published" the moment these records exist in your repo. The subscribe URL is `https://bsky.app/profile/{handle}/lists/{rkey}`.

## Customizing

To change the follower threshold, edit `MIN_FOLLOWERS` in `index.ts`. To change search terms, edit the `SEARCH_TERMS` array. To add new discovery strategies, add a new phase function and register it in the `completedPhases` logic in `main()`.

For the viz, data files go in `viz/public/`. The word cloud stop words list is in `App.tsx` (`STOP_WORDS`). The color palette is in `COLORS` and `App.css` CSS variables.

## Credentials

The crawler needs `BSKY_HANDLE` and `BSKY_APP_PASSWORD` env vars. Get an app password from https://bsky.app/settings/app-passwords. Never commit credentials — they're passed as env vars only.

## Current deployment

- List: `at://did:plc:rpe5afe3qleyyzkdcs2nnvwx/app.bsky.graph.list/3mhhqs5j47p26`
- Subscribe URL: https://bsky.app/profile/yuxi.ml/lists/3mhhqs5j47p26
- Account: yuxi.ml (did:plc:rpe5afe3qleyyzkdcs2nnvwx)
- As of 2026-03-21, there are 2,478 accounts discovered and added to the list.
