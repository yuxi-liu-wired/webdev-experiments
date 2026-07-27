#!/usr/bin/env -S uv run --no-project --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["atproto>=0.0.59"]
# ///
"""
Connect to the AT Protocol relay (com.atproto.sync.subscribeRepos), decode each
commit's CAR bundle, extract ALL app.bsky.feed.post creates (no link filter —
this feeds the found-haiku rarity survey), write slim JSONL. Cursor-resume on restart.

Env:
  RELAY            wss://bsky.network (default)
  OUT              /workspace/firehose-data/firehose-relay.jsonl
  CURSOR           start sequence number; default = whatever resume.json says or 0
  STATS_INTERVAL   30 (seconds)
  HARD_STOP_AT     epoch seconds; default = +7d from now
"""

from __future__ import annotations
import json
import os
import signal
import sys
import time
from atproto import (
    FirehoseSubscribeReposClient,
    parse_subscribe_repos_message,
    CAR,
    firehose_models,
    models,
)

OUT = os.environ.get("OUT", "/workspace/firehose-data/allposts.jsonl")
STATS = OUT + ".stats.json"
RESUME = OUT + ".resume.json"
RELAY = os.environ.get("RELAY", "wss://bsky.network/xrpc")
STATS_INTERVAL = int(os.environ.get("STATS_INTERVAL", "30"))
START_TS = time.time()
HARD_STOP_AT = float(os.environ.get("HARD_STOP_AT", str(START_TS + 7 * 86400)))

_cursor_env = os.environ.get("CURSOR")
START_CURSOR: int | None
if _cursor_env is not None:
    START_CURSOR = int(_cursor_env)
else:
    # Try resume.json
    try:
        with open(RESUME) as rf:
            START_CURSOR = json.load(rf).get("cursor")
    except Exception:
        START_CURSOR = None

# Optional upper bound on cursor — process exits when this seq is reached.
# Used to split a backfill range across parallel workers.
_end_env = os.environ.get("SEQ_END_AT")
SEQ_END_AT: int | None = int(_end_env) if _end_env else None

stats = {
    "started_at": START_TS,
    "started_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(START_TS)),
    "messages": 0,
    "commits": 0,
    "feed_post_creates": 0,
    "kept": 0,
    "written_bytes": 0,
    "min_seq_seen": None,
    "max_seq_seen": 0,
    "errors_decode": 0,
    "info_events": 0,
    "skipped_non_commit": 0,
}

# Open output for APPEND so cursor-resume works
f = open(OUT, "a", buffering=64 * 1024)
last_flush = time.time()


def flush_stats():
    elapsed = time.time() - START_TS
    stats["elapsed_sec"] = int(elapsed)
    stats["mb_written"] = round(stats["written_bytes"] / 1024 / 1024, 2)
    if stats["max_seq_seen"] and stats["min_seq_seen"]:
        stats["seq_range"] = stats["max_seq_seen"] - stats["min_seq_seen"]
    try:
        with open(STATS, "w") as sf:
            json.dump(stats, sf, indent=2, default=str)
        with open(RESUME, "w") as rf:
            json.dump({"cursor": stats["max_seq_seen"]}, rf)
    except Exception:
        pass


def on_message(message: firehose_models.MessageFrame):
    global last_flush
    stats["messages"] += 1

    # Hard stop
    if time.time() >= HARD_STOP_AT:
        print("hard stop reached", file=sys.stderr)
        flush_stats()
        f.flush()
        os._exit(0)

    try:
        commit = parse_subscribe_repos_message(message)
    except Exception:
        stats["errors_decode"] += 1
        return

    # Info / handle / account / tombstone events: not commits
    if not isinstance(commit, models.ComAtprotoSyncSubscribeRepos.Commit):
        if isinstance(commit, models.ComAtprotoSyncSubscribeRepos.Info):
            stats["info_events"] += 1
            stats["info_last"] = {"name": commit.name, "message": commit.message}
        else:
            stats["skipped_non_commit"] += 1
        return

    stats["commits"] += 1
    if stats["min_seq_seen"] is None or commit.seq < stats["min_seq_seen"]:
        stats["min_seq_seen"] = commit.seq
    if commit.seq > stats["max_seq_seen"]:
        stats["max_seq_seen"] = commit.seq

    # Honour optional upper bound — exit cleanly once we've passed our window.
    if SEQ_END_AT is not None and commit.seq >= SEQ_END_AT:
        print(f"reached SEQ_END_AT={SEQ_END_AT}, flushing & exiting", file=sys.stderr)
        flush_stats()
        f.flush()
        os._exit(0)

    # Fast pre-check: skip decoding CAR if no feed.post create ops in this commit
    has_post_create = any(
        op.action == "create" and op.path.startswith("app.bsky.feed.post/")
        for op in commit.ops
    )
    if not has_post_create:
        return

    if not commit.blocks:
        return
    try:
        car = CAR.from_bytes(commit.blocks)
    except Exception:
        stats["errors_decode"] += 1
        return

    for op in commit.ops:
        if op.action != "create":
            continue
        if not op.path.startswith("app.bsky.feed.post/"):
            continue
        stats["feed_post_creates"] += 1

        cid = op.cid
        if cid is None:
            continue
        block = car.blocks.get(cid)
        if block is None:
            continue

        # slim record: the survey needs text and identity, nothing else
        rkey = op.path.split("/", 1)[1]
        text = block.get("text", "")
        if not text:
            continue
        out_record = {
            "did": commit.repo,
            "rkey": rkey,
            "text": text,
            "langs": block.get("langs"),
            "isReply": block.get("reply") is not None,
            "seq": commit.seq,
        }
        try:
            line = json.dumps(out_record, default=str, ensure_ascii=False) + "\n"
        except Exception:
            stats["errors_decode"] += 1
            continue
        f.write(line)
        stats["written_bytes"] += len(line.encode("utf-8"))
        stats["kept"] += 1

    now = time.time()
    if now - last_flush >= STATS_INTERVAL:
        flush_stats()
        f.flush()
        last_flush = now
        elapsed = int(now - START_TS)
        print(
            f"  msgs={stats['messages']:,} commits={stats['commits']:,} posts={stats['feed_post_creates']:,} kept={stats['kept']:,} seq={stats['max_seq_seen']:,} t={elapsed}s",
            file=sys.stderr,
            flush=True,
        )


def handle_signal(sig, frame):
    print(f"signal {sig}, flushing", file=sys.stderr)
    flush_stats()
    f.flush()
    f.close()
    sys.exit(0)


signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)

print(f"relay={RELAY} cursor={START_CURSOR} out={OUT} hard_stop={time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(HARD_STOP_AT))}", file=sys.stderr)

params = (
    models.ComAtprotoSyncSubscribeRepos.Params(cursor=START_CURSOR)
    if START_CURSOR is not None
    else None
)
client = FirehoseSubscribeReposClient(params=params, base_uri=RELAY)
client.start(on_message)
