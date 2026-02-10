#!/usr/bin/env python3
import json, random, re, time
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ENDPOINT = "https://query.wikidata.org/sparql"
UA = "ScreenLitCatalogBuilder/1.0 (personal project; wikidata sparql)"

POOL_TOTAL = 2000
POOL_TARGETS = {"Film": 750, "TV": 650, "Book": 600}

ACTIVE_TOTAL = 300
ACTIVE_TARGETS = {"Film": 110, "TV": 100, "Book": 90}

def sparql(query: str, tries=10):
  params = urlencode({"format": "json", "query": query})
  url = ENDPOINT + "?" + params
  last = None
  for t in range(tries):
    try:
      req = Request(url, headers={"User-Agent": UA})
      with urlopen(req, timeout=60) as r:
        data = json.loads(r.read().decode("utf-8", errors="replace"))
      return data["results"]["bindings"]
    except HTTPError as e:
      last = e
      if getattr(e, "code", None) == 429:
        wait = 45 * (t + 1)
        print(f"[warn] 429 rate limit; sleeping {wait}s then retrying…")
        time.sleep(wait)
        continue
      time.sleep(5 * (t + 1))
    except Exception as e:
      last = e
      time.sleep(5 * (t + 1))
  raise RuntimeError(f"SPARQL failed: {last}")

def qid(uri: str) -> str:
  m = re.search(r"(Q\\d+)$", uri)
  return m.group(1) if m else uri

def slugify(s: str) -> str:
  s = s.lower().strip()
  s = re.sub(r"[^a-z0-9]+", "_", s)
  s = re.sub(r"_+", "_", s).strip("_")
  return s or "untitled"

def detect_catalog_global(path="catalog.js") -> str:
  try:
    txt = open(path, "r", encoding="utf-8", errors="ignore").read()
  except Exception:
    return "SL_CATALOG"
  for name in ["SL_CATALOG", "ScreenLitCatalog", "SCREENLIT_CATALOG", "CATALOG"]:
    if f"window.{name}" in txt:
      return name
  m = re.search(r"window\\.(\\w*CATALOG\\w*)", txt)
  return m.group(1) if m else "SL_CATALOG"

def query_kind(kind: str, limit: int):
  if kind == "Film":
    q = f"""
    SELECT ?item ?itemLabel (YEAR(?date) AS ?year) WHERE {{
      ?item wdt:P31 wd:Q11424 .
      ?item wdt:P577 ?date .
      FILTER(YEAR(?date) >= 1900 && YEAR(?date) <= 2035)
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    ORDER BY RAND()
    LIMIT {limit}
    """
  elif kind == "TV":
    q = f"""
    SELECT ?item ?itemLabel (YEAR(COALESCE(?incept, ?date)) AS ?year) WHERE {{
      ?item wdt:P31 wd:Q5398426 .
      OPTIONAL {{ ?item wdt:P571 ?incept . }}
      OPTIONAL {{ ?item wdt:P577 ?date . }}
      FILTER(BOUND(?incept) || BOUND(?date))
      FILTER(YEAR(COALESCE(?incept, ?date)) >= 1950 && YEAR(COALESCE(?incept, ?date)) <= 2035)
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    ORDER BY RAND()
    LIMIT {limit}
    """
  elif kind == "Book":
    q = f"""
    SELECT ?item ?itemLabel (YEAR(?date) AS ?year) WHERE {{
      ?item wdt:P31 wd:Q571 .
      ?item wdt:P577 ?date .
      FILTER(YEAR(?date) >= 1500 && YEAR(?date) <= 2035)
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    ORDER BY RAND()
    LIMIT {limit}
    """
  else:
    raise ValueError("Unknown kind")

  rows = sparql(q)
  out = []
  for r in rows:
    title = r["itemLabel"]["value"].strip()
    yr = int(float(r["year"]["value"])) if "year" in r else 0
    qv = qid(r["item"]["value"])
    out.append((qv, title, yr))
  return out

def build_pool():
  random.seed(29)
  pools = {}

  # Only 3 requests total, large batches, then we subsample to targets.
  plan = {"Film": 1400, "TV": 1300, "Book": 1500}
  for kind, lim in plan.items():
    time.sleep(1.5)
    rows = query_kind(kind, lim)
    random.shuffle(rows)
    pools[kind] = rows

  pool = []
  seen_qids = set()

  for kind, target in POOL_TARGETS.items():
    rows = pools.get(kind, [])
    for qv, title, yr in rows:
      if qv in seen_qids:
        continue
      seen_qids.add(qv)
      s = slugify(title)
      year = yr if yr else 0
      _id = f"{kind.lower()}_{s}_{year}_{qv}"
      pool.append({"id": _id, "title": title, "type": kind, "year": year, "qid": qv})
      if sum(1 for x in pool if x["type"] == kind) >= target:
        break

  random.shuffle(pool)
  return pool[:POOL_TOTAL]

def choose_active(pool):
  rnd = random.Random(29)
  by = {"Film": [], "TV": [], "Book": []}
  for it in pool:
    by[it["type"]].append(it)

  active = []
  for kind, n in ACTIVE_TARGETS.items():
    items = by.get(kind, [])[:]
    rnd.shuffle(items)
    active.extend(items[:min(n, len(items))])

  have = set(x["id"] for x in active)
  rest = [x for x in pool if x["id"] not in have]
  rnd.shuffle(rest)
  active.extend(rest[:max(0, ACTIVE_TOTAL - len(active))])
  return active[:ACTIVE_TOTAL]

def write_catalog_js(active, global_name):
  lines = []
  lines.append(f"window.{global_name} = [")
  for i, it in enumerate(active):
    title = it["title"].replace("\\\\", "\\\\\\\\").replace('"', '\\"')
    comma = "," if i != len(active)-1 else ""
    lines.append(f'  {{ id: "{it["id"]}", title: "{title}", type: "{it["type"]}", year: {int(it["year"])} }}{comma}')
  lines.append("];\n")
  open("catalog.js", "w", encoding="utf-8").write("\n".join(lines))

def main():
  global_name = detect_catalog_global("catalog.js")
  print(f"[info] Detected catalog global: window.{global_name}")
  print("[info] Pulling 3 batches from Wikidata (rate-limit safe)…")

  pool = build_pool()
  print(f"[info] Pool size: {len(pool)}")
  open("catalog_pool.json", "w", encoding="utf-8").write(json.dumps(pool, indent=2))

  active = choose_active(pool)
  print(f"[info] Active size: {len(active)}")
  write_catalog_js(active, global_name)

  manifest = {
    "pool_total": len(pool),
    "active_total": len(active),
    "active_breakdown": {
      "Film": sum(1 for x in active if x["type"]=="Film"),
      "TV": sum(1 for x in active if x["type"]=="TV"),
      "Book": sum(1 for x in active if x["type"]=="Book"),
    }
  }
  open("catalog_manifest.json", "w", encoding="utf-8").write(json.dumps(manifest, indent=2))
  print("[info] Wrote catalog_pool.json, catalog_manifest.json, and catalog.js")
  print("[done] Refresh the app; UI unchanged.")

if __name__ == "__main__":
  main()
