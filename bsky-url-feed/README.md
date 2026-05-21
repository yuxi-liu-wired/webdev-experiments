# bsky-url-feed

A Bluesky custom feed surfacing posts whose text is **mostly a list of links** — bibliographies, "sources" dumps, paper-thread roundups.

Zero-server design: GitHub Actions cron rebuilds a static JSON file every 30 min; Cloudflare Pages serves it; Bluesky AppView reads it. No certs, no servers, no DB.

## Architecture

```
api.bsky.app (searchPosts)
        │
        ▼
GitHub Actions (every 30 min)
   scripts/ingest.ts → classify → write public/xrpc/app.bsky.feed.getFeedSkeleton
        │
        │  git push
        ▼
Cloudflare Pages (auto-deploy)
   serves public/  at  https://bsky-url-feed.pages.dev
        │
        ▼
Bluesky AppView (GETs did.json, describe, getFeedSkeleton)
        │
        ▼
User's feed
```

## The classifier

A post is classified as a URL list iff:

1. It has **≥2 link facets** (`app.bsky.richtext.facet#link`), and
2. The bytes covered by those facets are **≥70%** of the post's non-whitespace text bytes.

Pure function in `scripts/classify.ts`; tested against the canonical example post in `scripts/classify.test.ts` plus negative cases.

## Layout

```
bsky-url-feed/
  .github/workflows/refresh.yml      # 30-min cron
  scripts/
    classify.ts                      # the pure classifier
    classify.test.ts                 # bun test
    ingest.ts                        # search API → classify → JSON
    publish.ts                       # one-shot feed-record write
    serve-local.ts                   # Cloudflare Pages simulator
    e2e-test.ts                      # AppView simulator
  public/                            # what Cloudflare Pages serves
    _headers
    .well-known/did.json
    xrpc/
      app.bsky.feed.describeFeedGenerator
      app.bsky.feed.getFeedSkeleton  # rewritten every cron
  state/
    seen.json                        # dedupe + cursor
```

## Local development

```bash
bun install
bun test scripts/                    # unit tests
bun run scripts/ingest.ts            # populate the skeleton from live API
bun run scripts/serve-local.ts       # serve ./public/ on :8087
# in another shell:
bun run scripts/e2e-test.ts          # simulate the AppView's three GETs
```

`e2e-test.ts` performs the exact requests the Bluesky AppView makes against a feed-generator, then hydrates every returned post URI through `api.bsky.app` to prove they'd render.

## Deploy checklist

1. **Drop the folder into the repo.** From your `webdev-experiments` checkout:
   ```bash
   cp -r /workspace/bsky-url-feed ./bsky-url-feed
   git add bsky-url-feed
   git commit -m "add bsky-url-feed"
   git push
   ```

2. **Cloudflare Pages.** Dashboard → Workers & Pages → Create → Pages → Connect to Git → pick `webdev-experiments`. Settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `bsky-url-feed/public`
   - **Root directory (advanced):** *(leave empty — keep at repo root so the build output path resolves correctly)*

   Click "Save and Deploy". You'll get a hostname like `webdev-experiments.pages.dev` or `<random>.pages.dev`.

3. **Update `did.json` and `describeFeedGenerator` to that hostname.** Edit `bsky-url-feed/public/.well-known/did.json` and replace `bsky-url-feed.pages.dev` with your real Pages hostname. Same for the `did` field in `bsky-url-feed/public/xrpc/app.bsky.feed.describeFeedGenerator`. Commit and push.

4. **Verify the deploy** with the E2E test pointed at production:
   ```bash
   HOST=https://your-pages-hostname.pages.dev bun run scripts/e2e-test.ts
   ```

5. **Publish the feed record** (one-shot, from your laptop):
   ```bash
   BSKY_HANDLE=yuxi.ml \
   BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
   bun run scripts/publish.ts
   ```
   App passwords: https://bsky.app/settings/app-passwords. The script prints the subscribe URL.

6. **Subscribe to the feed in-app**, scroll, sanity-check.

That's it. From here on, the GH Action keeps the feed fresh; nothing else to maintain.

## Tweakable knobs

- `MIN_LINKS` and `MIN_COVERAGE` in `scripts/classify.ts` — raise/lower the bar.
- `QUERY_TERMS` in `scripts/ingest.ts` — broaden candidate pool.
- `MAX_FEED_ITEMS` — how many posts the skeleton holds.
- Cron schedule in `.github/workflows/refresh.yml`.

## Caveats

- **`searchPosts` is best-effort.** Recent posts can be indexed a few minutes late, and 5+ pages per query get CDN-rate-limited (the workflow ignores the partial loss; 100 results × 12 queries is plenty of candidate pool).
- **No pagination.** Cloudflare Pages serves the same JSON regardless of `?cursor=`. In practice users see the latest ~200 items and can't scroll further. If that ever matters, swap the static file for a Cloudflare Pages Function in `functions/xrpc/[[path]].ts`.
- **CDN deploy lag.** A push usually goes live in 30–90 s. The 30-min cron is forgiving.
- **The feed record lives in `yuxi.ml`'s repo.** Anyone subscribing pulls the URI list from the Pages hostname, so don't take it offline without re-pointing the DID document.
