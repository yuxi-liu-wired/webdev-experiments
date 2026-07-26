#!/usr/bin/env bun
// Local server for the found-haiku page. It serves ./public, which is exactly
// what Netlify publishes, so what is tested here is what ships.
//
//   bun serve.mjs [port]        (default 8093; if it is taken, pass another)
//
// Two things here that the deployed site gets for free from Netlify or needs at
// all:
//   gzip       — Netlify compresses text assets itself.
//   /api/feed  — a byparr detour for Bluesky, needed only because this
//                container's firewall denies bsky.app. The deployed page calls
//                public.api.bsky.app directly (it sends
//                access-control-allow-origin: *) and never reaches this route.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, extname, normalize } from 'node:path';

const ROOT = new URL('./public', import.meta.url).pathname.replace(/\/$/, '');
const PORT = Number(process.argv[2] || process.env.PORT || 8093);
const BYPARR = process.env.BYPARR_URL || 'http://byparr:8191';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const cache = new Map();

function asset(path) {
  const hit = cache.get(path);
  const stat = statSync(path);
  if (hit && hit.mtime === stat.mtimeMs) return hit;
  const raw = readFileSync(path);
  const type = TYPES[extname(path)] || 'application/octet-stream';
  const entry = {
    mtime: stat.mtimeMs,
    raw,
    gzip: /text|javascript|json|svg/.test(type) ? gzipSync(raw, { level: 6 }) : null,
    type,
  };
  cache.set(path, entry);
  return entry;
}

/** Bluesky's public appview, reached through byparr (see the note above). */
async function bskyFeed(handle, cursor) {
  const target = new URL('https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed');
  target.searchParams.set('actor', handle);
  target.searchParams.set('limit', '100');
  target.searchParams.set('filter', 'posts_no_replies');
  if (cursor) target.searchParams.set('cursor', cursor);

  const res = await fetch(`${BYPARR}/v1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: 'request.get', url: target.toString(), maxTimeout: 60000 }),
  });
  const body = await res.json();
  const html = body?.solution?.response;
  if (!html) throw new Error('byparr returned no response');
  // byparr hands back the JSON wrapped in a <pre> for display.
  const json = html.replace(/^[\s\S]*?<pre[^>]*>/i, '').replace(/<\/pre>[\s\S]*$/i, '').trim()
    || html.trim();
  const decoded = json.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  try {
    return JSON.parse(decoded);
  } catch {
    throw new Error('could not parse the feed response');
  }
}

Bun.serve({
  port: PORT,
  idleTimeout: 120,
  async fetch(req) {
    const url = new URL(req.url);

    // NO_API=1 reproduces the deployed site exactly: static files only, no
    // proxy route, so the page has to stand on its own.
    if (url.pathname === '/api/feed' && !process.env.NO_API) {
      const handle = url.searchParams.get('handle');
      if (!handle) return Response.json({ error: 'handle required' }, { status: 400 });
      try {
        const data = await bskyFeed(handle, url.searchParams.get('cursor'));
        if (data.error) return Response.json({ error: data.message || data.error }, { status: 404 });
        return Response.json(data);
      } catch (e) {
        return Response.json({ error: String(e.message || e) }, { status: 502 });
      }
    }

    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    if (rel === '/favicon.ico') rel = '/favicon.svg';
    const path = join(ROOT, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!path.startsWith(ROOT) || !existsSync(path) || !statSync(path).isFile()) {
      return new Response('not found\n', { status: 404 });
    }

    const file = asset(path);
    const wantsGzip = (req.headers.get('accept-encoding') || '').includes('gzip');
    const headers = { 'Content-Type': file.type, 'Cache-Control': 'no-cache' };
    if (file.gzip && wantsGzip) {
      return new Response(file.gzip, { headers: { ...headers, 'Content-Encoding': 'gzip' } });
    }
    return new Response(file.raw, { headers });
  },
});

console.log(`found-haiku on http://localhost:${PORT}/  (root ${ROOT})`
  + (process.env.NO_API ? '  [NO_API: static only, as deployed]' : ''));
