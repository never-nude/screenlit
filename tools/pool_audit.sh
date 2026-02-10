#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CAT="$ROOT/catalog.js"
POOLS="$ROOT/pools.js"

python3 - <<'PY'
import re, sys

cat_path = "catalog.js"
pools_path = "pools.js"

cat = open(cat_path, "r", encoding="utf-8").read()
ids = re.findall(r'id\s*:\s*"([^"]+)"', cat)

seen=set()
catalog=[]
for i in ids:
    if i not in seen:
        seen.add(i)
        catalog.append(i)

if not catalog:
    print("ERROR: parsed 0 catalog ids from catalog.js")
    sys.exit(1)

pools = open(pools_path, "r", encoding="utf-8").read()

def extract(name):
    m = re.search(rf'{name}\s*:\s*\[(.*?)\]', pools, flags=re.S)
    if not m:
        return []
    return re.findall(r'"([^"]+)"', m.group(1))

active = extract("ACTIVE_POOL")
reserve = extract("RESERVE_POOL")

catalog_set = set(catalog)
active_set = set(active)
reserve_set = set(reserve)
union = active_set | reserve_set

dup_active = sorted([x for x in set(active) if active.count(x) > 1])
dup_reserve = sorted([x for x in set(reserve) if reserve.count(x) > 1])
overlap = sorted(active_set & reserve_set)
not_in_catalog = sorted([x for x in union if x not in catalog_set])
missing_from_pools = sorted([x for x in catalog_set if x not in union])

print("Pool audit")
print("---------")
print(f"Catalog IDs : {len(catalog)}")
print(f"Active IDs  : {len(active_set)}")
print(f"Reserve IDs : {len(reserve_set)}")
print(f"Union IDs   : {len(union)}")
print()

problems = 0

def err(title, items):
    global problems
    problems = 1
    print("ERROR:", title)
    for x in items:
        print(" ", x)
    print()

if dup_active:
    err("duplicate IDs inside ACTIVE_POOL", dup_active)
if dup_reserve:
    err("duplicate IDs inside RESERVE_POOL", dup_reserve)
if overlap:
    err("IDs present in BOTH Active and Reserve", overlap)
if not_in_catalog:
    err("IDs in pools that are NOT in catalog.js", not_in_catalog)
if missing_from_pools:
    err("Catalog IDs missing from pools (must be in Active or Reserve)", missing_from_pools)

if problems:
    print("FAIL: fix errors above")
    sys.exit(1)

print("OK: Pools are a strict partition of the catalog.")
PY
