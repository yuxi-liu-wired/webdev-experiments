A stepper page for undo under sync in Logseq (DB version): 12 user journeys, each shown 2 ways and in 3 columns.

In each journey Alice makes a change, Bob's change reaches the server, and Alice presses Ctrl+Z. The page runs each journey with Alice's change confirmed before Bob's arrives, and with it still unconfirmed. It shows 3 columns side by side:

- The Google approach: undo restores the state before Alice's change, even if that discards Bob's later change (what Google Sheets, Google Slides, Excel Online, PowerPoint Online and Figma do, per Stewen and Kleppmann, PaPoC 2024).
- The Miro / ADR 0011 approach: undo only when the 2 changes commute, otherwise refuse (what Miro does, and what Logseq's ADR 0011 says).
- What Logseq does, measured on upstream master `16c4ed1a0`.

Each column is a sequence chart of Alice's app and the server, with the page outline at every step. The controls step through the journey; the arrow keys, Home and End do the same.

Files in this folder:

- `index.html`: the page, 1 self-contained file with the data embedded.
- `sync-run.jsonl`: the test output the page is built from, 1 JSON line per journey run.
- `build.mjs`: builds `index.html` from `sync-run.jsonl`.
- `undo_sync_journey_test.cljs`: the test that produced `sync-run.jsonl`. It runs inside a Logseq checkout at `src/test/frontend/worker/`.
- `netlify.toml`: Netlify config (base directory `logseq-undo-journeys`, no build step).

To rebuild the page and serve it locally:

```bash
bun build.mjs
python3 -m http.server 8093
```

To reproduce the test output, copy the test into a Logseq checkout at upstream master and run:

```bash
cp undo_sync_journey_test.cljs <logseq>/src/test/frontend/worker/
cd <logseq> && pnpm cljs:test
LOGSEQ_STABLE_IDENTS=1 node static/tests.js -n frontend.worker.undo-sync-journey-test | grep '^SYNCJ ' > sync-run.jsonl
```
