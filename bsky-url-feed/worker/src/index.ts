import { JetstreamDO } from "./jetstream-do";

export { JetstreamDO };

export interface Env {
  JETSTREAM_DO: DurableObjectNamespace;
  FEED_KV: KVNamespace;
  FEED_HOST: string;
  PUBLISHER_DID: string;
  FEED_RKEY: string;
}

const SKELETON_KEY = "skeleton";
const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

function didDoc(host: string) {
  return JSON.stringify({
    "@context": ["https://www.w3.org/ns/did/v1"],
    id: `did:web:${host}`,
    service: [
      {
        id: "#bsky_fg",
        type: "BskyFeedGenerator",
        serviceEndpoint: `https://${host}`,
      },
    ],
  });
}

function describeDoc(host: string, publisherDid: string, rkey: string) {
  return JSON.stringify({
    did: `did:web:${host}`,
    feeds: [{ uri: `at://${publisherDid}/app.bsky.feed.generator/${rkey}` }],
  });
}

function getDoStub(env: Env) {
  const id = env.JETSTREAM_DO.idFromName("singleton");
  return env.JETSTREAM_DO.get(id);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const host = env.FEED_HOST || url.host;

    switch (url.pathname) {
      case "/.well-known/did.json":
        return new Response(didDoc(host), { headers: JSON_HEADERS });

      case "/xrpc/app.bsky.feed.describeFeedGenerator":
        return new Response(
          describeDoc(host, env.PUBLISHER_DID, env.FEED_RKEY),
          { headers: JSON_HEADERS },
        );

      case "/xrpc/app.bsky.feed.getFeedSkeleton": {
        const stored = await env.FEED_KV.get(SKELETON_KEY);
        return new Response(stored ?? '{"feed":[]}', { headers: JSON_HEADERS });
      }

      case "/admin/run": {
        const r = await getDoStub(env).fetch(new Request("https://do/runBatch"));
        return new Response(await r.text(), {
          status: r.status,
          headers: { "Content-Type": "application/json" },
        });
      }

      case "/admin/status": {
        const r = await getDoStub(env).fetch(new Request("https://do/status"));
        return r;
      }

      case "/":
        return new Response(
          `bsky-url-feed worker\n\ntry:\n  /.well-known/did.json\n  /xrpc/app.bsky.feed.describeFeedGenerator\n  /xrpc/app.bsky.feed.getFeedSkeleton\n  /admin/status\n  /admin/start\n`,
          { headers: { "Content-Type": "text/plain" } },
        );

      default:
        return new Response("Not Found", { status: 404 });
    }
  },

  async scheduled(_: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Cron tick: run one Jetstream drain batch. The DO also has its own alarm
    // as belt-and-suspenders, but the cron is the primary trigger.
    ctx.waitUntil(
      getDoStub(env).fetch(new Request("https://do/runBatch")).then(() => {}),
    );
  },
};
