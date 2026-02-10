#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[doctor] root=$ROOT"

# ---- Required files (core runtime) ----
REQ=(index.html discover.html catalog.js storage.js index.js discover.js)
missing=0
for f in "${REQ[@]}"; do
  if [ ! -f "$f" ]; then
    echo "[doctor] MISSING: $f"
    missing=1
  fi
done
if [ "$missing" -ne 0 ]; then
  echo "[doctor] FAIL: missing core files"
  exit 1
fi

# ---- HTML wiring sanity ----
grep -q 'index.js' index.html || { echo "[doctor] FAIL: index.html does not reference index.js"; exit 1; }
grep -q 'discover.js' discover.html || { echo "[doctor] FAIL: discover.html does not reference discover.js"; exit 1; }
grep -q 'catalog.js' index.html discover.html || { echo "[doctor] FAIL: html missing catalog.js include"; exit 1; }
grep -q 'storage.js' index.html discover.html || { echo "[doctor] FAIL: html missing storage.js include"; exit 1; }

echo "[doctor] html wiring ok"

# ---- Contamination firewall ----
echo "[doctor] contamination scan"
FILES="$(ls -1 *.html *.js *.css 2>/dev/null || true)"
if [ -n "$FILES" ]; then
  BAD='(<user__selection>|<truncated__content|michael@Mac|^>>>|zsh:|\[ScreenLit|\bEOF\b|contentReference)'
  # grep returns nonzero when nothing is found; that is GOOD.
  if echo "$FILES" | xargs grep -nE "$BAD" 2>/dev/null; then
    echo "[doctor] FAIL: contamination markers found"
    exit 1
  fi
fi
echo "[doctor] contamination ok"

# ---- JS parse check (if node exists) ----
if command -v node >/dev/null 2>&1; then
  echo "[doctor] node syntax check"
  for f in *.js; do
    [ -f "$f" ] || continue
    node --check "$f" >/dev/null
  done
  echo "[doctor] js syntax ok"
else
  echo "[doctor] node not found; skipping js syntax check"
fi

# ---- Catalog audit (IDs count + duplicates) ----
if [ -f catalog.js ]; then
  echo "[doctor] catalog audit"
  python3 - <<'PY'
import re, sys
s=open("catalog.js","r",encoding="utf-8",errors="ignore").read()
ids=re.findall(r'\bid\s*:\s*["\']([^"\']+)["\']', s)
print("[catalog] id_count=", len(ids))
dups={}
for i in ids:
  dups[i]=dups.get(i,0)+1
bad=[(k,v) for k,v in dups.items() if v>1]
if bad:
  print("[catalog] DUPLICATE IDS:")
  for k,v in bad: print(" ",k,v)
  sys.exit(1)
print("[catalog] ok")
PY
fi

echo "[doctor] PASS"
