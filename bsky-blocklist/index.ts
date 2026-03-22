#!/usr/bin/env bun
import { AtpAgent } from "@atproto/api";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

// ─── Config ───────────────────────────────────────────────────────────
const MIN_FOLLOWERS = 50_000;
const STATE_FILE = "./state/state.json";
const RATE_LIMIT_MS = 130; // ~7.5 req/sec, stays under limits
const LIST_NAME = "Block: 50k+ followers";
const LIST_DESC =
  "Auto-generated blocklist of all Bluesky accounts with >50,000 followers. Updated periodically by a crawler.";

const SEARCH_TERMS = [
  ..."abcdefghijklmnopqrstuvwxyz".split(""),
  "news",
  "politics",
  "tech",
  "science",
  "art",
  "music",
  "sports",
  "gaming",
  "food",
  "travel",
  "health",
  "business",
  "education",
  "entertainment",
  "fashion",
  "comedy",
  "film",
  "books",
  "photography",
  "crypto",
  "ai",
  "climate",
  "law",
  "medicine",
  "journalism",
  "podcast",
  "memes",
  "anime",
  "cats",
  "dogs",
  "nba",
  "nfl",
  "soccer",
  "baseball",
  "hockey",
  "tennis",
  "golf",
  "olympics",
  "wrestling",
  "football",
  "basketball",
  "python",
  "javascript",
  "rust",
  "linux",
  "apple",
  "google",
  "microsoft",
  "amazon",
  "tesla",
  "spacex",
  "nasa",
  "weather",
  "breaking",
  "celebrity",
  "official",
  "verified",
  "president",
  "senator",
  "governor",
  "mayor",
  "cnn",
  "bbc",
  "nytimes",
  "reuters",
  "associated press",
  "guardian",
  "economist",
  "bloomberg",
  "fox",
  "msnbc",
  "npr",
  "washington post",
  "wall street",
  "usa today",
  "daily",
  "reporter",
  "correspondent",
  "anchor",
  "editor",
  "author",
  "writer",
  "actor",
  "actress",
  "singer",
  "rapper",
  "musician",
  "producer",
  "director",
  "comedian",
  "influencer",
  "youtuber",
  "streamer",
  "athlete",
  "player",
  "coach",
  "analyst",
];

// ─── Types ────────────────────────────────────────────────────────────
interface AccountInfo {
  did: string;
  handle: string;
  displayName: string;
  followers: number;
  discoveredAt: string;
}

interface State {
  discovered: Record<string, AccountInfo>;
  checked: string[];
  crawledFollowing: string[];
  completedPhases: string[];
  listUri?: string;
  listMembers: string[];
}

// ─── Globals ──────────────────────────────────────────────────────────
let state: State = {
  discovered: {},
  checked: [],
  crawledFollowing: [],
  completedPhases: [],
  listMembers: [],
};
let checkedSet = new Set<string>();

// ─── Helpers ──────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loadState(): Promise<void> {
  if (!existsSync("./state")) await mkdir("./state", { recursive: true });
  try {
    const data = await readFile(STATE_FILE, "utf-8");
    state = JSON.parse(data);
    state.completedPhases ??= [];
    checkedSet = new Set([
      ...state.checked,
      ...Object.keys(state.discovered),
    ]);
  } catch {
    // fresh state
  }
}

async function saveState(): Promise<void> {
  state.checked = [...checkedSet];
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

// Save on Ctrl+C
process.on("SIGINT", async () => {
  log("Interrupted — saving state...");
  await saveState();
  process.exit(0);
});

// ─── Rate-limited API wrapper ─────────────────────────────────────────
async function rateLimited<T>(fn: () => Promise<T>, retries = 10): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await fn();
      await sleep(RATE_LIMIT_MS);
      return result;
    } catch (e: any) {
      if (e?.status === 429 || e?.message?.includes("429") || e?.message?.includes("RateLimitExceeded")) {
        // Write rate limits are hourly — need real backoff (up to 10 min)
        const wait = Math.min(600_000, 30_000 * 2 ** attempt);
        log(`  Rate limited, waiting ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/${retries})...`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
  throw new Error("Max retries exceeded");
}

// ─── Discovery: check profiles in batch ───────────────────────────────
async function checkProfiles(
  agent: AtpAgent,
  dids: string[]
): Promise<number> {
  const unknown = dids.filter((d) => !checkedSet.has(d));
  if (unknown.length === 0) return 0;

  let added = 0;
  for (let i = 0; i < unknown.length; i += 25) {
    const batch = unknown.slice(i, i + 25);
    try {
      const res = await rateLimited(() =>
        agent.app.bsky.actor.getProfiles({ actors: batch })
      );
      for (const profile of res.data.profiles) {
        checkedSet.add(profile.did);
        const followers = profile.followersCount ?? 0;
        if (followers >= MIN_FOLLOWERS) {
          state.discovered[profile.did] = {
            did: profile.did,
            handle: profile.handle,
            displayName: profile.displayName ?? "",
            followers,
            discoveredAt: new Date().toISOString(),
          };
          added++;
          log(
            `  + ${profile.handle} (${followers.toLocaleString()} followers)`
          );
        }
      }
      // Mark all in batch as checked even if not returned (deleted/suspended)
      for (const did of batch) checkedSet.add(did);
    } catch (e: any) {
      // Skip batch on non-rate-limit errors
      for (const did of batch) checkedSet.add(did);
    }
  }
  return added;
}

// ─── Phase 1: Suggested follows ───────────────────────────────────────
async function discoverViaSuggestions(agent: AtpAgent) {
  log("Phase 1: Suggested follows...");
  let cursor: string | undefined;
  let total = 0;
  for (let page = 0; page < 30; page++) {
    try {
      const res = await rateLimited(() =>
        agent.app.bsky.actor.getSuggestions({ limit: 100, cursor })
      );
      const dids = res.data.actors.map((a) => a.did);
      total += await checkProfiles(agent, dids);
      cursor = res.data.cursor;
      if (!cursor || res.data.actors.length === 0) break;
    } catch {
      break;
    }
  }
  log(
    `  => ${total} new accounts from suggestions (${Object.keys(state.discovered).length} total)`
  );
}

// ─── Phase 2: Search ──────────────────────────────────────────────────
async function discoverViaSearch(agent: AtpAgent) {
  log(`Phase 2: Searching ${SEARCH_TERMS.length} terms...`);
  let total = 0;
  for (let t = 0; t < SEARCH_TERMS.length; t++) {
    const term = SEARCH_TERMS[t];
    let cursor: string | undefined;
    for (let page = 0; page < 4; page++) {
      try {
        const res = await rateLimited(() =>
          agent.app.bsky.actor.searchActors({ q: term, limit: 100, cursor })
        );
        const dids = res.data.actors.map((a) => a.did);
        total += await checkProfiles(agent, dids);
        cursor = res.data.cursor;
        if (!cursor || res.data.actors.length < 50) break;
      } catch {
        break;
      }
    }
    if ((t + 1) % 15 === 0) {
      await saveState();
      log(
        `  Progress: ${t + 1}/${SEARCH_TERMS.length} terms, ${Object.keys(state.discovered).length} total discovered`
      );
    }
  }
  log(
    `  => ${total} new accounts from search (${Object.keys(state.discovered).length} total)`
  );
}

// ─── Phase 3: Crawl following ─────────────────────────────────────────
async function crawlFollowing(agent: AtpAgent) {
  log("Phase 3: Crawling following lists...");
  const crawledSet = new Set(state.crawledFollowing);
  let totalNew = 0;
  let round = 0;

  while (true) {
    round++;
    const toCrawl = Object.keys(state.discovered).filter(
      (d) => !crawledSet.has(d)
    );
    if (toCrawl.length === 0) break;

    log(`  Round ${round}: crawling ${toCrawl.length} accounts' following...`);
    let roundNew = 0;

    for (let idx = 0; idx < toCrawl.length; idx++) {
      const did = toCrawl[idx];
      const info = state.discovered[did];
      let cursor: string | undefined;
      const followDids: string[] = [];

      // Paginate through who this account follows (cap at 3000)
      for (let page = 0; page < 30; page++) {
        try {
          const res = await rateLimited(() =>
            agent.app.bsky.graph.getFollows({
              actor: did,
              limit: 100,
              cursor,
            })
          );
          for (const f of res.data.follows) followDids.push(f.did);
          cursor = res.data.cursor;
          if (!cursor || res.data.follows.length < 100) break;
        } catch {
          break;
        }
      }

      if (followDids.length > 0) {
        const found = await checkProfiles(agent, followDids);
        roundNew += found;
      }

      crawledSet.add(did);
      state.crawledFollowing = [...crawledSet];

      // Save every 5 accounts
      if ((idx + 1) % 5 === 0) {
        await saveState();
        log(
          `    Crawled ${idx + 1}/${toCrawl.length} (${info.handle}), +${roundNew} this round`
        );
      }
    }

    totalNew += roundNew;
    await saveState();
    log(
      `  Round ${round} done: +${roundNew} new (${Object.keys(state.discovered).length} total)`
    );

    // Stop if diminishing returns
    if (roundNew < 3) {
      log("  Diminishing returns, stopping crawl.");
      break;
    }
  }

  log(`  => ${totalNew} new accounts from crawling`);
}

// ─── Phase 4: Build/update the moderation list ───────────────────────
async function findOrCreateList(agent: AtpAgent): Promise<string> {
  // Check saved URI
  if (state.listUri) {
    try {
      await rateLimited(() =>
        agent.app.bsky.graph.getList({ list: state.listUri!, limit: 1 })
      );
      log(`Using existing list: ${state.listUri}`);
      return state.listUri;
    } catch {
      log("Saved list URI invalid, searching...");
      state.listUri = undefined;
    }
  }

  // Search existing lists
  let cursor: string | undefined;
  while (true) {
    const res = await rateLimited(() =>
      agent.com.atproto.repo.listRecords({
        repo: agent.session!.did,
        collection: "app.bsky.graph.list",
        limit: 100,
        cursor,
      })
    );
    for (const record of res.data.records) {
      const val = record.value as any;
      if (
        val.name === LIST_NAME &&
        val.purpose === "app.bsky.graph.defs#modlist"
      ) {
        state.listUri = record.uri;
        log(`Found existing list: ${record.uri}`);
        return record.uri;
      }
    }
    cursor = res.data.cursor;
    if (!cursor) break;
  }

  // Create new list
  const res = await rateLimited(() =>
    agent.com.atproto.repo.createRecord({
      repo: agent.session!.did,
      collection: "app.bsky.graph.list",
      record: {
        $type: "app.bsky.graph.list",
        name: LIST_NAME,
        description: LIST_DESC,
        purpose: "app.bsky.graph.defs#modlist",
        createdAt: new Date().toISOString(),
      },
    })
  );
  state.listUri = res.data.uri;
  log(`Created new moderation list: ${res.data.uri}`);
  return res.data.uri;
}

async function populateList(agent: AtpAgent) {
  const listUri = await findOrCreateList(agent);
  const memberSet = new Set(state.listMembers);

  // Sync existing list members
  let cursor: string | undefined;
  while (true) {
    try {
      const res = await rateLimited(() =>
        agent.app.bsky.graph.getList({ list: listUri, limit: 100, cursor })
      );
      for (const item of res.data.items) memberSet.add(item.subject.did);
      cursor = res.data.cursor;
      if (!cursor) break;
    } catch {
      break;
    }
  }
  state.listMembers = [...memberSet];

  const toAdd = Object.values(state.discovered).filter(
    (a) => !memberSet.has(a.did)
  );
  log(
    `Phase 4: Adding ${toAdd.length} accounts to list (${memberSet.size} already on it)...`
  );

  let added = 0;
  // Batch writes: up to 200 per applyWrites call (each create = 3 rate points)
  // 5000 points/hr = ~1666 creates/hr. Use batches of 50 with 2s gaps = ~90 creates/min = ~5400/hr
  const BATCH_SIZE = 50;
  const WRITE_DELAY_MS = 2000;
  for (let i = 0; i < toAdd.length; i += BATCH_SIZE) {
    const batch = toAdd.slice(i, i + BATCH_SIZE);
    const writes = batch.map((account) => ({
      $type: "com.atproto.repo.applyWrites#create" as const,
      collection: "app.bsky.graph.listitem",
      value: {
        $type: "app.bsky.graph.listitem",
        subject: account.did,
        list: listUri,
        createdAt: new Date().toISOString(),
      },
    }));
    try {
      await rateLimited(() =>
        agent.com.atproto.repo.applyWrites({
          repo: agent.session!.did,
          writes,
        })
      );
      for (const account of batch) memberSet.add(account.did);
      added += batch.length;
      state.listMembers = [...memberSet];
      await saveState();
      log(`  Added ${added}/${toAdd.length}...`);
    } catch (e: any) {
      // rateLimited already retried 429s with long backoff — if we're here
      // it's either a non-rate-limit error or we exhausted retries
      log(`  Batch failed: ${e?.message}. Saving and continuing...`);
      state.listMembers = [...memberSet];
      await saveState();
      // Back off the loop index so we retry this batch next iteration
      i -= BATCH_SIZE;
      // Wait 5 minutes before retrying
      log(`  Waiting 5 min before retry...`);
      await sleep(300_000);
    }
  }

  state.listMembers = [...memberSet];
  log(`  Added ${added} accounts. Total on list: ${memberSet.size}`);
}

// ─── Stats ────────────────────────────────────────────────────────────
function showStats() {
  const accounts = Object.values(state.discovered).sort(
    (a, b) => b.followers - a.followers
  );
  console.log(`\n=== Blocklist State ===`);
  console.log(`Discovered:    ${accounts.length} accounts with ≥${MIN_FOLLOWERS.toLocaleString()} followers`);
  console.log(`Checked:       ${checkedSet.size} total profiles inspected`);
  console.log(`Crawled:       ${state.crawledFollowing.length} following lists crawled`);
  console.log(`List members:  ${state.listMembers.length}`);
  console.log(`List URI:      ${state.listUri ?? "(not created)"}`);

  if (accounts.length > 0) {
    const totalFollowers = accounts.reduce((s, a) => s + a.followers, 0);
    console.log(
      `Total followers blocked: ${totalFollowers.toLocaleString()}`
    );
    console.log(`\nTop 30:`);
    for (const a of accounts.slice(0, 30)) {
      console.log(
        `  ${a.handle.padEnd(35)} ${a.followers.toLocaleString().padStart(12)} followers`
      );
    }
    console.log(`\nBottom 10 (near threshold):`);
    for (const a of accounts.slice(-10)) {
      console.log(
        `  ${a.handle.padEnd(35)} ${a.followers.toLocaleString().padStart(12)} followers`
      );
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────
async function main() {
  const cmd = process.argv[2] ?? "all";

  await loadState();

  if (cmd === "stats") {
    showStats();
    return;
  }

  const handle = process.env.BSKY_HANDLE;
  const password = process.env.BSKY_APP_PASSWORD;
  if (!handle || !password) {
    console.error(
      "Set BSKY_HANDLE and BSKY_APP_PASSWORD env vars.\nGet an app password: https://bsky.app/settings/app-passwords"
    );
    process.exit(1);
  }

  const agent = new AtpAgent({ service: "https://bsky.social" });
  await agent.login({ identifier: handle, password });
  log(`Logged in as ${handle} (${agent.session!.did})`);
  log(
    `State: ${Object.keys(state.discovered).length} discovered, ${checkedSet.size} checked, ${state.listMembers.length} on list`
  );

  if (cmd === "all" || cmd === "discover") {
    if (!state.completedPhases.includes("suggestions")) {
      await discoverViaSuggestions(agent);
      state.completedPhases.push("suggestions");
      await saveState();
    } else {
      log("Phase 1: Suggestions already done, skipping.");
    }

    if (!state.completedPhases.includes("search")) {
      await discoverViaSearch(agent);
      state.completedPhases.push("search");
      await saveState();
    } else {
      log("Phase 2: Search already done, skipping.");
    }

    if (!state.completedPhases.includes("crawl")) {
      await crawlFollowing(agent);
      state.completedPhases.push("crawl");
      await saveState();
    } else {
      log("Phase 3: Following crawl already done, skipping.");
    }

    log(
      `\nDiscovery complete: ${Object.keys(state.discovered).length} accounts with ≥${MIN_FOLLOWERS.toLocaleString()} followers`
    );
  }

  if (cmd === "all" || cmd === "build") {
    await populateList(agent);
    await saveState();
  }

  showStats();

  if (state.listUri) {
    // Convert AT URI to web URL
    const match = state.listUri.match(
      /at:\/\/(did:[^/]+)\/app\.bsky\.graph\.list\/(.+)/
    );
    if (match) {
      log(
        `\nSubscribe to this list at:\n  https://bsky.app/profile/${handle}/lists/${match[2]}`
      );
    }
  }

  log("Done!");
}

main().catch((e) => {
  console.error("Fatal:", e);
  saveState().then(() => process.exit(1));
});
