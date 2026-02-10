#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage:"
  echo "  tools/migrate_pool.sh to-reserve <id1> [id2 ...]"
  echo "  tools/migrate_pool.sh to-active  <id1> [id2 ...]"
  exit 1
}

[ $# -ge 2 ] || usage
MODE="$1"; shift

python3 - "$MODE" "$@" <<'PY'
import sys, re

mode = sys.argv[1]
move_ids = sys.argv[2:]

cat = open("catalog.js","r",encoding="utf-8").read()
catalog_ids = re.findall(r'id\s*:\s*"([^"]+)"', cat)
seen=set()
catalog=[]
for i in catalog_ids:
    if i not in seen:
        seen.add(i)
        catalog.append(i)
catalog_set=set(catalog)

pools = open("pools.js","r",encoding="utf-8").read()

def extract(name):
    m = re.search(rf'{name}\s*:\s*\[(.*?)\]', pools, flags=re.S)
    if not m:
        return []
    return re.findall(r'"([^"]+)"', m.group(1))

active = extract("ACTIVE_POOL")
reserve = extract("RESERVE_POOL")

def dedupe_preserve(lst):
    s=set()
    out=[]
    for x in lst:
        if x not in s:
            s.add(x)
            out.append(x)
    return out

active = dedupe_preserve(active)
reserve = dedupe_preserve(reserve)

active_set=set(active)
reserve_set=set(reserve)

# Validate strict partition baseline
union = active_set | reserve_set
missing = [x for x in catalog if x not in union]
if missing:
    print("ERROR: pools.js is missing catalog IDs (run pool init or fix pools.js). First missing:", missing[0])
    sys.exit(1)

def move_to_reserve(idv):
    nonlocal_active = [x for x in active if x != idv]
    nonlocal_reserve = reserve[:] if idv in reserve else reserve + [idv]
    return nonlocal_active, nonlocal_reserve

def move_to_active(idv):
    nonlocal_reserve = [x for x in reserve if x != idv]
    nonlocal_active = active[:] if idv in active else active + [idv]
    return nonlocal_active, nonlocal_reserve

for idv in move_ids:
    if idv not in catalog_set:
        print("ERROR: not in catalog:", idv)
        sys.exit(1)
    if mode == "to-reserve":
        if idv not in active_set and idv in reserve_set:
            continue
        if idv not in active_set:
            print("ERROR: cannot move to reserve (not in ACTIVE_POOL):", idv)
            sys.exit(1)
        active, reserve = move_to_reserve(idv)
    elif mode == "to-active":
        if idv not in reserve_set and idv in active_set:
            continue
        if idv not in reserve_set:
            print("ERROR: cannot move to active (not in RESERVE_POOL):", idv)
            sys.exit(1)
        active, reserve = move_to_active(idv)
    else:
        print("ERROR: mode must be to-reserve or to-active")
        sys.exit(1)

    active_set=set(active); reserve_set=set(reserve)

# Rewrite pools.js canonical
with open("pools.js","w",encoding="utf-8") as f:
    f.write("// ScreenLit Pools (scaffold)\n\n")
    f.write("window.SL_POOLS = {\n")
    f.write("  ACTIVE_POOL: [\n")
    for i,idv in enumerate(active):
        comma="," if i < len(active)-1 else ""
        f.write(f'    "{idv}"{comma}\n')
    f.write("  ],\n")
    f.write("  RESERVE_POOL: [\n")
    for i,idv in enumerate(reserve):
        comma="," if i < len(reserve)-1 else ""
        f.write(f'    "{idv}"{comma}\n')
    f.write("  ]\n")
    f.write("};\n")

print(f"OK: migrated. Active={len(active)} Reserve={len(reserve)}")
PY
