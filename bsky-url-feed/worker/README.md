# bsky-url-feed worker

Cloudflare Worker + Durable Object that drains the [Jetstream](https://docs.bsky.app/blog/jetstream) firehose every 5 minutes (cursor-resumed), runs every `app.bsky.feed.post` through the shared `scripts/classify.ts` URL-list classifier, and writes matching post URIs to KV. A second Worker route serves `app.bsky.feed.getFeedSkeleton` straight from KV.

This is the "real algo feed" version — no `searchPosts` keyword guessing, no GitHub-Actions cron, no static JSON. The classifier is the same one the cron-based version uses.

## Architecture

```
Cron trigger (every 5 min)
        │
        ▼
JetstreamDO.runBatch()
   ├── Connect to wss://jetstream2.../subscribe?cursor=<last_run-30s>
   ├── Drain until idle ≥ 2s (catches up to live) or hard timeout 90s
   ├── Per message: classify(text, facets, reply, author)
   │     ├── on-demand getProfile lookup for handle + labels (LRU cached)
   │     └── on match → unshift to items[], cap at 200
   ├── Disconnect WebSocket
   ├── Persist items + cursor to DO storage
   ├── Flush skeleton JSON to KV (only if matches > 0)
   └── Hibernate until next cron / alarm
        │
        ▼
Cloudflare KV (FEED_KV / "skeleton")
        │
        ▼
Worker fetch handler
   ├── /.well-known/did.json
   ├── /xrpc/app.bsky.feed.describeFeedGenerator
   ├── /xrpc/app.bsky.feed.getFeedSkeleton   ← reads KV
   ├── /admin/run                             (force a batch)
   └── /admin/status                          (last batch stats)
        │
        ▼
Bluesky AppView
```

## Free-tier fit

| Resource | Daily usage | Free tier | % |
|---|---|---|---|
| DO duration | ~720 GB-s (288 batches × ~20s × 0.125 GB) | 13,000 GB-s | 6% |
| DO requests | ~300 | 100,000 | <1% |
| KV writes | 0–10 (only on match) | 1,000 | <1% |
| KV reads | bounded by feed-view traffic | 100,000 | <1% |
| Worker requests | ~2,000 (cron + admin + feed) | 100,000 | 2% |
| Outbound bandwidth | not metered for free Workers | — | — |

Headroom for ~10–15 feeds of this shape on a single free account.

## Deploy

From this directory:

1. **Install wrangler and log in**
   ```bash
   bun install
   bunx wrangler login   # browser OAuth
   ```

2. **Create the KV namespace**
   ```bash
   bunx wrangler kv namespace create FEED_KV
   ```
   Wrangler prints something like:
   ```
   [[kv_namespaces]]
   binding = "FEED_KV"
   id = "a1b2c3d4..."
   ```
   Replace `REPLACE_WITH_KV_NAMESPACE_ID` in `wrangler.toml` with that id.

3. **Deploy once** to get the worker hostname:
   ```bash
   bunx wrangler deploy
   ```
   Wrangler prints something like `https://bsky-url-feed.<your-subdomain>.workers.dev`. That hostname will be the did:web identifier.

4. **Update `FEED_HOST` in `wrangler.toml`** to that hostname (replace `REPLACE_WITH_YOUR_SUBDOMAIN`), then redeploy:
   ```bash
   bunx wrangler deploy
   ```
   `PUBLISHER_DID` and `FEED_RKEY` are already set under `[vars]` and don't need changing unless you want a different feed.

5. **Re-publish the feed record** so the AppView resolves to the new worker instead of the old Pages deploy:
   ```bash
   cd .. && BSKY_HANDLE=yuxi.ml BSKY_APP_PASSWORD=xxxx bun run scripts/publish.ts
   ```
   (publish.ts reads the DID from `public/.well-known/did.json` — update that file's hostname to match the worker before running, or temporarily replace the path inside publish.ts.)

6. **Kick the DO once** so it connects to Jetstream right away (it'll auto-start on the next cron tick anyway):
   ```bash
   curl https://<your-worker-host>/admin/start
   ```

7. **Verify**
   ```bash
   curl https://<your-worker-host>/admin/status
   # → {"connected":true,"items":N,...}
   ```

## Local dev

```bash
bun install
bunx wrangler dev --local --port 8087
```
`wrangler dev --local` simulates DOs and KV in-memory. Real Jetstream connection works against either local or remote mode since the WS is outbound.

## How the DO runs

The DO is event-driven, not always-on. Two redundant triggers wake it:
- **Cron** (`*/5 * * * *`) — Worker's `scheduled()` handler calls `runBatch()` on the DO every 5 minutes.
- **DO alarm** (`setAlarm(now + 5min)`) — same cadence, scheduled at the end of each batch as belt-and-suspenders in case the cron is delayed or skipped.

Between batches the DO hibernates (no compute billed). Each batch connects to Jetstream with `cursor=<last_run_us - 30s>` to catch any messages that arrived during the prior batch's disconnect, drains until the stream is idle for ≥2s, then closes.

If a batch fails (network blip, Jetstream restart), `lastCursorUs` is not advanced and the next batch retries the same window — at worst we re-read 5 min of stream, which is fine.
