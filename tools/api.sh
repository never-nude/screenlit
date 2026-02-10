#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=8148
PIDFILE="$ROOT/tools/.api_${PORT}.pid"
LOGFILE="$ROOT/tools/.api_${PORT}.log"

# Kill anything on the port
lsof -ti tcp:$PORT | xargs kill -9 2>/dev/null || true
[ -f "$PIDFILE" ] && kill -9 "$(cat "$PIDFILE" 2>/dev/null || true)" 2>/dev/null || true
rm -f "$PIDFILE" || true

cd "$ROOT"
nohup python3 api_server.py --port $PORT >"$LOGFILE" 2>&1 &

echo $! > "$PIDFILE"
echo "[api] running on http://127.0.0.1:$PORT (pid $(cat "$PIDFILE"))"
echo "[api] log $LOGFILE"
