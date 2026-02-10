#!/usr/bin/env bash
set -euo pipefail

PORT=8147
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/tools/server_${PORT}.log"
PIDFILE="$ROOT/tools/server_${PORT}.pid"

cd "$ROOT"

# Kill anything already on the port (ignore errors)
lsof -ti :"$PORT" | xargs kill 2>/dev/null || true

# Start in background so the prompt returns (and it survives tab chaos)
nohup python3 -m http.server "$PORT" >"$LOG" 2>&1 &

echo $! > "$PIDFILE"
echo "[ScreenLit] server running: http://localhost:$PORT  (pid $(cat "$PIDFILE"))"
echo "[ScreenLit] log: $LOG"
