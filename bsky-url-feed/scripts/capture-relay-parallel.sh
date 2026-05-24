#!/bin/bash
# Launch N parallel capture-relay.py workers, each with its own non-overlapping
# cursor window. Speeds up backfill by ~Nx (SDK is single-threaded).
#
# Args:
#   $1  N (number of workers, default 4)
#   $2  START cursor (default: read from RESUME_FILE)
#   $3  END cursor   (default: estimated live)
#
# Output: /workspace/firehose-data/relay-{0..N-1}.jsonl + stats/resume each

set -e
N=${1:-4}
START=${2:-}
END=${3:-}
OUTDIR=/workspace/firehose-data
RESUME_FILE=$OUTDIR/relay.jsonl.resume.json

if [ -z "$START" ]; then
  if [ -f "$RESUME_FILE" ]; then
    START=$(grep -oE '"cursor":\s*[0-9]+' "$RESUME_FILE" | grep -oE '[0-9]+')
  fi
fi
if [ -z "$START" ]; then
  echo "no START cursor — provide as arg 2 or have $RESUME_FILE present" >&2
  exit 1
fi

if [ -z "$END" ]; then
  # Estimate live cursor: latest known + 1h of live rate (445 seq/sec)
  END=$(( START + 60 * 60 * 445 ))
  echo "no END given; estimating live as START + 1h = $END" >&2
fi

RANGE=$(( END - START ))
WINDOW=$(( RANGE / N ))
echo "N=$N start=$START end=$END range=$RANGE window=$WINDOW" >&2

for i in $(seq 0 $((N-1))); do
  WSTART=$(( START + i * WINDOW ))
  if [ $i -eq $(( N - 1 )) ]; then
    WEND=""  # last worker keeps streaming past END to catch up to live
  else
    WEND=$(( START + (i + 1) * WINDOW ))
  fi
  echo "worker $i: cursor=$WSTART end=${WEND:-(none)}" >&2
  OUT=$OUTDIR/relay-$i.jsonl
  ARGS="CURSOR=$WSTART OUT=$OUT HARD_STOP_AT=$(($(date +%s) + 4 * 3600))"
  [ -n "$WEND" ] && ARGS="$ARGS SEQ_END_AT=$WEND"
  rm -f "$OUT" "$OUT.stats.json" "$OUT.resume.json"
  nohup env $ARGS uv run --no-project --with 'atproto>=0.0.59' python3 \
    /workspace/webdev-experiments/bsky-url-feed/scripts/capture-relay.py \
    > $OUTDIR/capture-relay-$i.log 2>&1 &
  disown
done
echo "launched $N workers" >&2
