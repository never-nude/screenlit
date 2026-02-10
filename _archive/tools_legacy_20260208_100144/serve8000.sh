#!/usr/bin/env bash
set -e

PORT=8000
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Cancel whatever is already using the port
lsof -ti :$PORT | xargs kill 2>/dev/null || true

cd "$ROOT"
python3 -m http.server $PORT
