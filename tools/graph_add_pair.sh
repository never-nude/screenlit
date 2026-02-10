#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: tools/graph_add_pair.sh <idA> <idB>"
  exit 1
fi

A="$1"
B="$2"

python3 - "$A" "$B" <<'PY'
import json, re, sys, time

a = sys.argv[1]
b = sys.argv[2]
p = "graph_seed.js"

s = open(p, "r", encoding="utf-8").read()
m = re.search(r'window\.SL_GRAPH_SEED\s*=\s*(\{.*\})\s*;\s*$', s, flags=re.S)
if not m:
    raise SystemExit("[fail] graph_seed.js is not in expected format: window.SL_GRAPH_SEED = {...};")

data = json.loads(m.group(1))
edges = data.setdefault("edges", {})

def add(u, v):
    arr = edges.get(u)
    if not isinstance(arr, list):
        arr = []
    if v not in arr:
        arr.append(v)
    edges[u] = arr

add(a, b)
add(b, a)

bak = f"graph_seed.js.bak_{time.strftime('%Y%m%d_%H%M%S')}"
open(bak, "w", encoding="utf-8").write(s)

out = "window.SL_GRAPH_SEED = " + json.dumps(data, indent=2, sort_keys=True) + ";\n"
open(p, "w", encoding="utf-8").write(out)

print(f"[ok] added pair: {a} <-> {b}")
print(f"[ok] backup: {bak}")
PY
