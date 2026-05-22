import { classify, isBotAuthor, type Facet, type ReplyRef } from "../../scripts/classify";

const JETSTREAM_HOST = "https://jetstream2.us-east.bsky.network/subscribe";
const APPVIEW = "https://api.bsky.app";
const SKELETON_KEY = "skeleton";
const MAX_ITEMS = 200;

const BATCH_INTERVAL_MS = 5 * 60_000;  // run every 5 minutes
const OVERLAP_SAFETY_MS = 30_000;       // re-read last 30s to cover gaps
const DRAIN_LIVE_MS = 2_000;            // consider "live" when no msg for 2s
const DRAIN_HARD_TIMEOUT_MS = 90_000;   // never drain longer than 90s per batch
const HANDLE_CACHE_MAX = 5_000;         // LRU cap

interface Env {
  FEED_KV: KVNamespace;
}

interface Item {
  uri: string;
  cid: string;
  createdAt: string;
}

interface JetstreamCommit {
  rev: string;
  operation: "create" | "update" | "delete";
  collection: string;
  rkey: string;
  cid: string;
  record?: {
    $type: string;
    text?: string;
    facets?: Facet[];
    reply?: ReplyRef;
    createdAt?: string;
  };
}

interface JetstreamEvent {
  did: string;
  time_us: number;
  kind: "commit" | "identity" | "account";
  commit?: JetstreamCommit;
  identity?: { handle?: string };
}

interface AuthorInfo {
  handle: string;
  labels: { val: string }[];
}

interface ProfileResponse {
  did: string;
  handle: string;
  labels?: { val: string }[];
}

export class JetstreamDO {
  state: DurableObjectState;
  env: Env;
  items: Item[] = [];
  lastCursorUs: number = 0;
  lastRunAt: number = 0;
  lastBatchStats: {
    at: number;
    messages: number;
    candidates: number;
    prelimMatches: number;
    matches: number;
    durationMs: number;
    rejections: Record<string, number>;
    error?: string;
  } | null = null;
  handleCache = new Map<string, AuthorInfo>();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.state.blockConcurrencyWhile(async () => {
      this.items = (await this.state.storage.get<Item[]>("items")) ?? [];
      this.lastCursorUs = (await this.state.storage.get<number>("lastCursorUs")) ?? 0;
      this.lastRunAt = (await this.state.storage.get<number>("lastRunAt")) ?? 0;
      this.lastBatchStats = (await this.state.storage.get("lastBatchStats")) ?? null;
      const existingAlarm = await this.state.storage.getAlarm();
      if (existingAlarm === null) {
        await this.state.storage.setAlarm(Date.now() + 2_000);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    switch (url.pathname) {
      case "/runBatch":
        await this.runBatch();
        return Response.json(this.lastBatchStats);
      case "/keepalive":
      case "/start":
        return new Response("ok (alarm-driven; next batch on schedule)");
      case "/status":
        return Response.json({
          items: this.items.length,
          lastCursorUs: this.lastCursorUs,
          lastCursorIso:
            this.lastCursorUs > 0
              ? new Date(Math.floor(this.lastCursorUs / 1000)).toISOString()
              : null,
          lastRunAt: this.lastRunAt,
          lastRunIso: this.lastRunAt ? new Date(this.lastRunAt).toISOString() : null,
          cachedAuthors: this.handleCache.size,
          lastBatch: this.lastBatchStats,
        });
      default:
        return new Response("not found", { status: 404 });
    }
  }

  async alarm() {
    try {
      await this.runBatch();
    } finally {
      await this.state.storage.setAlarm(Date.now() + BATCH_INTERVAL_MS);
    }
  }

  private async runBatch() {
    const startedAt = Date.now();
    const startedUs = startedAt * 1000;

    // First run: backfill the last 5 minutes only.
    // Subsequent runs: replay from lastCursorUs - overlap.
    const cursorUs =
      this.lastCursorUs > 0
        ? this.lastCursorUs - OVERLAP_SAFETY_MS * 1000
        : startedUs - BATCH_INTERVAL_MS * 1000;

    const url = `${JETSTREAM_HOST}?wantedCollections=app.bsky.feed.post&cursor=${cursorUs}`;

    interface PrelimMatch {
      uri: string;
      cid: string;
      did: string;
      createdAt: string;
    }

    let ws: WebSocket | undefined;
    let messages = 0;
    let candidates = 0;
    let maxCursor = cursorUs;
    let error: string | undefined;
    const rejections: Record<string, number> = {};
    const prelimMatches: PrelimMatch[] = [];

    try {
      const resp = await fetch(url, { headers: { Upgrade: "websocket" } });
      if (!resp.webSocket) {
        throw new Error(`No WebSocket on response (status ${resp.status})`);
      }
      ws = resp.webSocket;
      ws.accept();

      // Phase 1: drain Jetstream into a prelim-match list. Synchronous handlers
      // only — no awaits in the message path. Author lookup is deferred to phase 2.
      await new Promise<void>((resolve) => {
        let lastMessageAt = Date.now();
        const checkIdle = setInterval(() => {
          const idle = Date.now() - lastMessageAt;
          const total = Date.now() - startedAt;
          if (idle >= DRAIN_LIVE_MS || total >= DRAIN_HARD_TIMEOUT_MS) {
            clearInterval(checkIdle);
            resolve();
          }
        }, 500);

        ws!.addEventListener("message", (e) => {
          lastMessageAt = Date.now();
          if (typeof e.data !== "string") return;
          messages++;
          let event: JetstreamEvent;
          try {
            event = JSON.parse(e.data);
          } catch {
            return;
          }
          if (event.time_us > maxCursor) maxCursor = event.time_us;

          if (event.kind === "identity" && event.identity?.handle) {
            this.cacheHandle(event.did, {
              handle: event.identity.handle,
              labels: this.handleCache.get(event.did)?.labels ?? [],
            });
            return;
          }
          if (event.kind !== "commit") return;
          const c = event.commit;
          if (!c || c.operation !== "create") return;
          if (c.collection !== "app.bsky.feed.post") return;
          if (!c.record || c.record.$type !== "app.bsky.feed.post") return;

          candidates++;

          // Pre-classify with empty author info — skips the bot check but runs
          // the cheap structural checks (link count, self-reply, char coverage).
          const cached = this.handleCache.get(event.did);
          const result = classify({
            text: c.record.text ?? "",
            facets: c.record.facets,
            reply: c.record.reply,
            authorDid: event.did,
            authorHandle: cached?.handle ?? "",
            authorLabels: cached?.labels,
          });

          if (!result.isUrlList) {
            const reason = result.reason ?? "unknown";
            const key = reason.replace(/\d+/g, "N");
            rejections[key] = (rejections[key] ?? 0) + 1;
            return;
          }

          // Survived structural filters. Queue for author lookup in phase 2.
          prelimMatches.push({
            uri: `at://${event.did}/app.bsky.feed.post/${c.rkey}`,
            cid: c.cid,
            did: event.did,
            createdAt:
              c.record.createdAt ??
              new Date(Math.floor(event.time_us / 1000)).toISOString(),
          });
        });

        ws!.addEventListener("close", () => {
          clearInterval(checkIdle);
          resolve();
        });
        ws!.addEventListener("error", () => {
          clearInterval(checkIdle);
          resolve();
        });
      });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      try {
        ws?.close();
      } catch {}
    }

    // Phase 2: author lookup (only for the small prelim-match set) to enforce bot check.
    let matches = 0;
    for (const m of prelimMatches) {
      if (this.items.some((i) => i.uri === m.uri)) continue;
      const author = await this.lookupAuthor(m.did);
      if (isBotAuthor(author.handle, author.labels)) {
        rejections["bot author"] = (rejections["bot author"] ?? 0) + 1;
        continue;
      }
      this.items.unshift({ uri: m.uri, cid: m.cid, createdAt: m.createdAt });
      if (this.items.length > MAX_ITEMS) this.items.length = MAX_ITEMS;
      matches++;
      console.log(`+ match ${m.uri} by @${author.handle || "?"}`);
    }

    if (matches > 0) {
      await this.flushSkeleton();
    }
    this.lastCursorUs = maxCursor;
    this.lastRunAt = startedAt;
    this.lastBatchStats = {
      at: startedAt,
      messages,
      candidates,
      prelimMatches: prelimMatches.length,
      matches,
      durationMs: Date.now() - startedAt,
      rejections,
      error,
    };
    await this.state.storage.put("items", this.items);
    await this.state.storage.put("lastCursorUs", this.lastCursorUs);
    await this.state.storage.put("lastRunAt", this.lastRunAt);
    await this.state.storage.put("lastBatchStats", this.lastBatchStats);
  }

  private async flushSkeleton() {
    const skeleton = { feed: this.items.map((i) => ({ post: i.uri })) };
    await this.env.FEED_KV.put(SKELETON_KEY, JSON.stringify(skeleton));
  }

  private cacheHandle(did: string, info: AuthorInfo) {
    if (this.handleCache.size >= HANDLE_CACHE_MAX) {
      // Evict the oldest entry (Map iterates in insertion order)
      const oldest = this.handleCache.keys().next().value;
      if (oldest) this.handleCache.delete(oldest);
    }
    this.handleCache.set(did, info);
  }

  private async lookupAuthor(did: string): Promise<AuthorInfo> {
    const cached = this.handleCache.get(did);
    if (cached) return cached;
    try {
      const url = `${APPVIEW}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const empty: AuthorInfo = { handle: "", labels: [] };
        this.cacheHandle(did, empty);
        return empty;
      }
      const profile = (await res.json()) as ProfileResponse;
      const entry: AuthorInfo = {
        handle: profile.handle ?? "",
        labels: profile.labels ?? [],
      };
      this.cacheHandle(did, entry);
      return entry;
    } catch {
      const empty: AuthorInfo = { handle: "", labels: [] };
      this.cacheHandle(did, empty);
      return empty;
    }
  }
}
