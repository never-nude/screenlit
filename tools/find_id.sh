#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: tools/find_id.sh <query>"
  exit 1
fi

q="$*"

python3 - "$q" <<'PY'
import re, sys

q = sys.argv[1].lower()
s = open("catalog.js", "r", encoding="utf-8").read()

# Matches entries like:
# { id:"...", title:"...", type:"...", year:1999 }
pat = re.compile(r'\{\s*id:"([^"]+)"\s*,\s*title:"([^"]+)"\s*,\s*type:"([^"]+)"\s*,\s*year:(\d+)', re.M)

rows = []
for id_, title, typ, year in pat.findall(s):
    if q in title.lower() or q in id_.lower():
        rows.append((typ, int(year), title, id_))

rows.sort()

for typ, year, title, id_ in rows:
    print(f"{id_}\t{typ}\t{year}\t{title}")
PY
