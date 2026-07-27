#!/usr/bin/env -S uv run --no-project --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["websocket-client>=1.7"]
# ///
"""
Capture ALL app.bsky.feed.post creates from Jetstream, through the box's
egress proxy (websocket-client speaks HTTP CONNECT, which squid carries for
allowed hosts). Jetstream frames are JSON, so unlike the relay capture there
is no CAR decoding and no dependency on the atproto package.

Writes slim JSONL for tools/rarity-survey.mjs: did, rkey, text, langs,
isReply, time_us.

Connections drop; the capture does not: on any socket loss it reconnects
with the cursor at the last event seen, so coverage is continuous and the
survey's did/rkey dedupe absorbs the small replay overlap.

Env:
  OUT           /workspace/firehose-data/jetstream-all.jsonl
  HOURS_BACK    rewind the cursor this many hours (server clamps to its buffer)
  CURSOR_US     resume from an exact jetstream cursor (overrides HOURS_BACK)
  HARD_STOP_SEC stop after this many seconds (default: run until signalled)
  MAX_POSTS     stop after this many posts
  JETSTREAM     wss://jetstream2.us-east.bsky.network/subscribe
"""
from __future__ import annotations

import json
import os
import signal
import sys
import time
from urllib.parse import urlparse

import websocket

OUT = os.environ.get("OUT", "/workspace/firehose-data/jetstream-all.jsonl")
STATS = OUT + ".stats.json"
JET = os.environ.get("JETSTREAM", "wss://jetstream2.us-east.bsky.network/subscribe")
HOURS_BACK = float(os.environ.get("HOURS_BACK", "0"))
HARD_STOP_SEC = float(os.environ.get("HARD_STOP_SEC", "0"))
MAX_POSTS = int(os.environ.get("MAX_POSTS", "0"))

def make_url(cursor_us):
    u = JET + "?wantedCollections=app.bsky.feed.post"
    if cursor_us:
        u += f"&cursor={cursor_us}"
    return u


cursor_us = int(os.environ.get("CURSOR_US", "0")) or (
    int((time.time() - HOURS_BACK * 3600) * 1_000_000) if HOURS_BACK > 0 else None)

proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
proxy_kwargs = {}
if proxy:
    p = urlparse(proxy)
    proxy_kwargs = {"http_proxy_host": p.hostname, "http_proxy_port": p.port, "proxy_type": "http"}

start = time.time()
stats = {"started_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(start)),
         "url": JET, "events": 0, "posts": 0, "written_bytes": 0,
         "first_time_us": None, "last_time_us": None}
f = open(OUT, "a", buffering=1 << 20)


def flush_stats():
    stats["elapsed_sec"] = int(time.time() - start)
    if stats["first_time_us"] and stats["last_time_us"]:
        stats["covered_hours"] = round((stats["last_time_us"] - stats["first_time_us"]) / 3.6e9, 2)
    with open(STATS, "w") as sf:
        json.dump(stats, sf, indent=2)


def bail(sig=None, frame=None):
    flush_stats()
    f.flush()
    f.close()
    print(f"\nstopped: {stats['posts']:,} posts, {stats.get('covered_hours', '?')}h covered", file=sys.stderr)
    sys.exit(0)


signal.signal(signal.SIGTERM, bail)
signal.signal(signal.SIGINT, bail)

last_report = start
ws = None

while True:
    if HARD_STOP_SEC and time.time() - start >= HARD_STOP_SEC:
        bail()
    if MAX_POSTS and stats["posts"] >= MAX_POSTS:
        bail()
    if ws is None:
        resume = stats["last_time_us"] or cursor_us
        u = make_url(resume)
        print(f"connecting: {u}\nproxy: {proxy or 'none'}", file=sys.stderr, flush=True)
        try:
            ws = websocket.WebSocket()
            ws.connect(u, **proxy_kwargs)
        except Exception as e:
            print(f"connect failed ({e}); retrying in 10s", file=sys.stderr, flush=True)
            ws = None
            time.sleep(10)
            continue
    try:
        raw = ws.recv()
    except websocket.WebSocketTimeoutException:
        continue
    except Exception as e:
        print(f"stream lost ({e}); reconnecting from cursor", file=sys.stderr, flush=True)
        try:
            ws.close()
        except Exception:
            pass
        ws = None
        flush_stats()
        f.flush()
        time.sleep(5)
        continue
    if not raw:
        continue
    stats["events"] += 1
    try:
        ev = json.loads(raw)
    except Exception:
        continue
    if ev.get("kind") != "commit":
        continue
    c = ev.get("commit") or {}
    if c.get("operation") != "create" or c.get("collection") != "app.bsky.feed.post":
        continue
    rec = c.get("record") or {}
    text = rec.get("text", "")
    if not text:
        continue
    line = json.dumps({
        "did": ev.get("did"),
        "rkey": c.get("rkey"),
        "text": text,
        "langs": rec.get("langs"),
        "isReply": rec.get("reply") is not None,
        "parent": ((rec.get("reply") or {}).get("parent") or {}).get("uri"),
        "time_us": ev.get("time_us"),
    }, ensure_ascii=False) + "\n"
    f.write(line)
    stats["posts"] += 1
    stats["written_bytes"] += len(line.encode())
    if stats["first_time_us"] is None:
        stats["first_time_us"] = ev.get("time_us")
    stats["last_time_us"] = ev.get("time_us")

    now = time.time()
    if now - last_report >= 30:
        flush_stats()
        rate = stats["posts"] / (now - start)
        print(f"  {stats['posts']:,} posts · {rate:.0f}/s · {stats.get('covered_hours', 0)}h covered", file=sys.stderr, flush=True)
        last_report = now
