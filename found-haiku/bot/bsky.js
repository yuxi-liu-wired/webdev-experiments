// Bluesky API access for the bot.
//
// Reads (feeds, handle resolution) go to the public appview and need no auth.
// Writes (replies) and notifications go to the PDS with an app-password
// session. The session is cached at module scope: on a warm serverless
// instance it is reused, on a cold start it is recreated — createSession is
// rate-limited per day, which is why the poll schedule stays at minutes, not
// seconds.
//
// BYPARR_URL, if set, routes the public GETs through the byparr proxy so the
// read path can be exercised from inside the development container, whose
// firewall denies bsky.app.

const PDS = process.env.BOT_PDS || 'https://bsky.social';
const APPVIEW = 'https://public.api.bsky.app';

async function publicGet(path, params) {
  const url = new URL(`${APPVIEW}/xrpc/${path}`);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);

  const byparr = process.env.BYPARR_URL;
  if (byparr) {
    const res = await fetch(`${byparr}/v1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: 'request.get', url: url.toString(), maxTimeout: 60000 }),
    });
    const body = await res.json();
    const html = body?.solution?.response || '';
    const json = html.replace(/^[\s\S]*?<pre[^>]*>/i, '').replace(/<\/pre>[\s\S]*$/i, '').trim() || html.trim();
    const decoded = json.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const status = body?.solution?.status;
    let data;
    try { data = JSON.parse(decoded); } catch { throw new Error(`unparseable response for ${path}`); }
    return { ok: !status || status < 400, status: status || 200, data };
  }

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** did for a handle, or null if the account does not exist. */
export async function resolveHandle(handle) {
  const r = await publicGet('com.atproto.identity.resolveHandle', { handle });
  return r.ok ? r.data.did : null;
}

/** Has this account already replied in the thread under `uri`? */
export async function alreadyAnswered(uri, did) {
  const r = await publicGet('app.bsky.feed.getPostThread', { uri, depth: '1' });
  if (!r.ok) return false; // on doubt, answer; the guard is best-effort
  return (r.data?.thread?.replies || []).some((rep) => rep?.post?.author?.did === did);
}

/** Up to `pages` x 100 of an author's own posts: [{ text, uri }]. */
export async function authorPosts(did, pages = 10) {
  const posts = [];
  let cursor = '';
  for (let i = 0; i < pages; i++) {
    const r = await publicGet('app.bsky.feed.getAuthorFeed', {
      actor: did, limit: '100', filter: 'posts_no_replies', cursor,
    });
    if (!r.ok) {
      if (posts.length) break;
      throw new Error(r.data?.message || `feed failed (${r.status})`);
    }
    for (const item of r.data.feed || []) {
      const post = item?.post;
      if (post?.record?.text && post.author?.did === did) {
        posts.push({ text: post.record.text, uri: post.uri });
      }
    }
    cursor = r.data.cursor || '';
    if (!cursor) break;
  }
  return posts;
}

// --- authenticated ----------------------------------------------------------

let session = null; // { did, handle, accessJwt } — reused while the instance is warm

async function pds(path, { method = 'GET', body, jwt, params } = {}) {
  const url = new URL(`${PDS}/xrpc/${path}`);
  for (const [k, v] of Object.entries(params || {})) if (v) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // an expired or rejected token must never outlive the failure it caused:
    // drop the cached session so the next call logs in fresh
    if (res.status === 401 || data.error === 'ExpiredToken' || /expired/i.test(data.message || '')) {
      session = null;
    }
    const err = new Error(data.message || `${path} failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function ensureSession(env = process.env) {
  if (session) return session;
  const identifier = env.BOT_IDENTIFIER;
  const password = env.BOT_APP_PASSWORD;
  if (!identifier || !password) throw new Error('BOT_IDENTIFIER / BOT_APP_PASSWORD not set');
  const s = await pds('com.atproto.server.createSession', {
    method: 'POST',
    body: { identifier, password },
  });
  session = { did: s.did, handle: s.handle, accessJwt: s.accessJwt };
  return session;
}

export function dropSession() {
  session = null;
}

export async function listNotifications(s, limit = 50) {
  const r = await pds('app.bsky.notification.listNotifications', {
    jwt: s.accessJwt, params: { limit: String(limit) },
  });
  return r.notifications || [];
}

export async function updateSeen(s, seenAt) {
  await pds('app.bsky.notification.updateSeen', {
    method: 'POST', jwt: s.accessJwt, body: { seenAt },
  });
}

/** Post a reply in the mention's thread. */
export async function postReply(s, mention, reply) {
  const parent = { uri: mention.uri, cid: mention.cid };
  const root = mention.record?.reply?.root || parent;
  return pds('com.atproto.repo.createRecord', {
    method: 'POST',
    jwt: s.accessJwt,
    body: {
      repo: s.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text: reply.text,
        ...(reply.facets ? { facets: reply.facets } : {}),
        reply: { root, parent },
        langs: ['en'],
        createdAt: new Date().toISOString(),
      },
    },
  });
}
