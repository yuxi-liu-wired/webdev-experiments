UC Berkeley library hours, scraped into one interactive table.

The official hours page at `lib.berkeley.edu/hours` shows one day at a time behind a JavaScript date picker. This project pulls every date in a range, converts the hours into 24-hour format, and renders them as a single sticky-header grid with filtering. The output is a single self-contained `index.html` file, deployable as static hosting.

How to build and run, using `bun`:

```bash
bun build.ts fetch     # scrape lib.berkeley.edu and write data.json + index.html
bun build.ts rebuild   # rebuild index.html from cached data.json (no network)
bun build.ts serve     # serve index.html on http://localhost:8765
bun build.ts all       # fetch + serve
```

The serve handler reads `index.html` fresh on each request, so a new `fetch` or `rebuild` shows up on the next browser reload without restarting the server.

Files in this folder:

- `build.ts`: the scraper + HTML builder + dev server, all in one Bun script.
- `data.json`: cached scrape output, keyed by date then by library name.
- `index.html`: the built static page with all data embedded.
- `netlify.toml`: Netlify build config (runs `bun build.ts fetch` at deploy time, then publishes the folder).

How the page works:

- Columns are libraries, rows are dates, one row per day in the configured range.
- A month-name banner row separates each month.
- Date labels are zero-padded day plus three-letter weekday (e.g. `26 Tue`).
- Hours are converted to 24-hour. Half-hours show as a small superscript `1/2` glyph, so `10:30-16:30` renders as `10` half `- 16` half.
- Green cell: library is open 24 hours that day.
- Blue cell: library closes at 21:00 or later.
- Grey cell: closed (or hours missing from the source).
- Yellow row stripe: weekend.
- Red row stripe: federal holiday (Memorial Day, July 4).
- Hover any cell to see the raw string from `lib.berkeley.edu` in the tooltip.

Filters in the top bar:

- Library name search (substring match).
- Date range (defaults to the full scraped range).
- Hide always-closed libraries.
- Hide weekends.
- Per-library checkbox list, plus `all` / `none` / `core` quick-set buttons. The `core` set is the dozen most-trafficked libraries (Doe, Main Stacks, Business, Law, Engineering, East Asian, Bioscience, Chem/Astro/Phys, Env Design, Bancroft, Morrison, Music).

How the scraper works:

The Berkeley page accepts `?date=YYYY-MM-DD&library_select=0&hours_date_select=YYYY-MM-DD` to render a specific date server-side. The script `GET`s one URL per date in the range, runs a regex over the HTML to pull `<h3 class="library-name">` + `<p class="library-hours">` pairs, strips inner `<br>` tags, and stores the result as `{date: {library: "hours string"}}`. Concurrency is set to 10 simultaneous requests.

To change the date range, edit `START` and `END` at the top of `build.ts`.

To change the holiday set, edit `HOLIDAYS_2026` in the HTML template inside `build.ts`.

Deployment:

The included `netlify.toml` tells Netlify to install Bun, run `bun build.ts fetch` for a fresh scrape at deploy time, and publish the folder. Without a build step, the cached `data.json` and committed `index.html` are also enough to serve as plain static files.
