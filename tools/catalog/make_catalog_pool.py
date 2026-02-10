#!/usr/bin/env python3
import json, random, re, time, sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ENDPOINT = "https://query.wikidata.org/sparql"

POOL_TOTAL = 2000
ACTIVE_TOTAL = 300

# Roughly balanced, with a slight bias toward film/TV so Discover has motion
TARGETS = {
  "Film": 750,
  "TV":   650,
  "Book": 600,
}

ACTIVE_TARGETS = {
  "Film": 110,
  "TV":   100,
  "Book": 90,
}

UA = "ScreenLitCatalogBuilder/1.0 (personal project; wikidata sparql)"

def sparql(query: str, tries=4):
  params = urlencode({"format": "json", "query": query})
  url = ENDPOINT + "?" + params
  last = None
  for t in range(tries):
    try:
      req = Request(url, headers={"User-Agent": UA})
      with urlopen(req, timeout=35) as r:
        data = json.loads(r.read().decode("utf-8", errors="replace"))
      return data["results"]["bindings"]
    except Exception as e:
      last = e
      time.sleep(1.5 * (t + 1))
  raise RuntimeError(f"SPARQL failed: {last}")

def qid(uri: str) -> str:
  m = re.search(r"(Q\\d+)$", uri)
  return m.group(1) if m else uri

def clean_label(s: str) -> str:
  return s.strip()

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
  # Prefer explicit known names in order of likelihood
  for name in ["SL_CATALOG", "ScreenLitCatalog", "SCREENLIT_CATALOG", "CATALOG"]:
    if f"window.{name}" in txt:
      return name
  # Fall back: first window.<NAME> that looks catalog-ish
  m = re.search(r"window\\.(\\w*CATALOG\\w*)", txt)
  if m:
    return m.group(1)
  return "SL_CATALOG"

def query_items(kind: str, limit: int):
  # We use ORDER BY RAND() to get variety. We’ll dedupe client-side.
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
    title = clean_label(r["itemLabel"]["value"])
    yr = int(float(r["year"]["value"])) if "year" in r else 0
    qidv = qid(r["item"]["value"])
    out.append((qidv, title, yr))
  return out

def build_pool():
  random.seed(28)
  pool = []
  seen_qids = set()

  for kind, target in TARGETS.items():
    # Pull in batches; dedupe; keep going until we hit target.
    batch = 200
    tries = 0
    while sum(1 for x in pool if x["type"] == kind) < target and tries < 60:
      tries += 1
      need = target - sum(1 for x in pool if x["type"] == kind)
      lim = batch if need > batch else max(need, 50)
      rows = query_items(kind, lim)
      for qidv, title, yr in rows:
        if qidv in seen_qids:
          continue
        seen_qids.add(qidv)
        s = slugify(title)
        year = yr if yr else 0
        # Stable, collision-proof ID: include QID suffix
        _id = f"{kind.lower()}_{s}_{year if year else 0}_{qidv}"
        pool.append({
          "id": _id,
          "title": title,
          "type": kind,
          "year": year,
          "qid": qidv
        })
      # be polite to Wikidata
      time.sleep(0.25)

  # If we’re short for any reason, just stop cleanly (still usable).
  return pool

def choose_active(pool):
  random.seed(28)
  by_type = {"Film": [], "TV": [], "Book": []}
  for item in pool:
    by_type[item["type"]].append(item)

  active = []
  for kind, n in ACTIVE_TARGETS.items():
    items = by_type.get(kind, [])
    random.shuffle(items)
    active.extend(items[:min(n, len(items))])

  # If still short, top up from remaining pool
  if len(active) < ACTIVE_TOTAL:
    have = set(x["id"] for x in active)
    rest = [x for x in pool if x["id"] not in have]
    random.shuffle(rest)
    active.extend(rest[:(ACTIVE_TOTAL - len(active))])

  return active[:ACTIVE_TOTAL]

def write_catalog_js(active, global_name):
  # Write as a simple array assignment for maximum compatibility.
  lines = []
  lines.append(f"window.{global_name} = [")
  for i, it in enumerate(active):
    # escape quotes safely
    title = it["title"].replace("\\\\", "\\\\\\\\").replace('"', '\\"')
    lines.append(f'  {{ id: "{it["id"]}", title: "{title}", type: "{it["type"]}", year: {int(it["year"]) } }}{"," if i != len(active)-1 else ""}')
  lines.append("];\n")
  open("catalog.js", "w", encoding="utf-8").write("\\n".join(lines))

def main():
  global_name = detect_catalog_global("catalog.js")
  print(f"[info] Detected catalog global: window.{global_name}")

  print("[info] Pulling pool from Wikidata (this can take ~1–3 minutes)…")
  pool = build_pool()
  print(f"[info] Pool size fetched: {len(pool)}")

  # Save pool
  open("catalog_pool.json", "w", encoding="utf-8").write(json.dumps(pool, indent=2))
  print("[info] Wrote catalog_pool.json")

  active = choose_active(pool)
  print(f"[info] Active size: {len(active)}")
  write_catalog_js(active, global_name)
  print("[info] Wrote catalog.js (active set)")

  # Write a tiny manifest for your own sanity
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
  print("[info] Wrote catalog_manifest.json")
  print("[done] Next: refresh the app; no UI code changes needed.")

if __name__ == "__main__":
  main()
