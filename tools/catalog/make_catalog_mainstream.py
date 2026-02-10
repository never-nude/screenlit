#!/usr/bin/env python3
import json, random, re, time
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ENDPOINT = "https://query.wikidata.org/sparql"
UA = "ScreenLitCatalogBuilder/1.0 (personal project; wikidata sparql)"

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

def query_kind_mainstream(kind: str, limit: int):
  # Use sitelinks as a popularity proxy. Pull a big top slice and sample from it.
  if kind == "Film":
    q = f"""
    SELECT ?item ?itemLabel (YEAR(?date) AS ?year) ?sitelinks WHERE {{
      ?item wdt:P31 wd:Q11424 .
      ?item wdt:P577 ?date .
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
      SERVICE wikibase:sitelinks {{ ?item wikibase:sitelinks ?sitelinks. }}
      FILTER(YEAR(?date) >= 1930 && YEAR(?date) <= 2035)
    }}
    ORDER BY DESC(?sitelinks)
    LIMIT {limit}
    """
  elif kind == "TV":
    q = f"""
    SELECT ?item ?itemLabel (YEAR(COALESCE(?incept, ?date)) AS ?year) ?sitelinks WHERE {{
      ?item wdt:P31 wd:Q5398426 .
      OPTIONAL {{ ?item wdt:P571 ?incept . }}
      OPTIONAL {{ ?item wdt:P577 ?date . }}
      FILTER(BOUND(?incept) || BOUND(?date))
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
      SERVICE wikibase:sitelinks {{ ?item wikibase:sitelinks ?sitelinks. }}
      FILTER(YEAR(COALESCE(?incept, ?date)) >= 1950 && YEAR(COALESCE(?incept, ?date)) <= 2035)
    }}
    ORDER BY DESC(?sitelinks)
    LIMIT {limit}
    """
  elif kind == "Book":
    q = f"""
    SELECT ?item ?itemLabel (YEAR(?date) AS ?year) ?sitelinks WHERE {{
      ?item wdt:P31 wd:Q571 .
      ?item wdt:P577 ?date .
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
      SERVICE wikibase:sitelinks {{ ?item wikibase:sitelinks ?sitelinks. }}
      FILTER(YEAR(?date) >= 1500 && YEAR(?date) <= 2035)
    }}
    ORDER BY DESC(?sitelinks)
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
    sitelinks = int(r["sitelinks"]["value"]) if "sitelinks" in r else 0
    out.append((qv, title, yr, sitelinks))
  return out

def build_active():
  random.seed(29)

  # Pull a top slice (by sitelinks), then sample to keep variety inside mainstream.
  slices = {
    "Film": query_kind_mainstream("Film", 2500),
    "TV":   query_kind_mainstream("TV",   2000),
    "Book": query_kind_mainstream("Book", 2500),
  }

  active = []
  seen_qids = set()

  for kind, need in ACTIVE_TARGETS.items():
    rows = slices[kind]
    # Weighted sampling: prefer higher sitelinks but not strictly top-only.
    # We take a window of the top N and sample randomly within it.
    window = rows[:1200] if len(rows) > 1200 else rows[:]
    random.shuffle(window)

    picked = 0
    for qv, title, yr, sl in window:
      if qv in seen_qids:
        continue
      seen_qids.add(qv)
      s = slugify(title)
      year = yr if yr else 0
      _id = f"{kind.lower()}_{s}_{year}_{qv}"
      active.append({"id": _id, "title": title, "type": kind, "year": year, "qid": qv, "sitelinks": sl})
      picked += 1
      if picked >= need:
        break

  random.shuffle(active)
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
  print("[info] Building mainstream active catalog via Wikidata sitelinks…")

  active = build_active()
  print(f"[info] Active size: {len(active)}")
  write_catalog_js(active, global_name)

  manifest = {
    "active_total": len(active),
    "active_breakdown": {
      "Film": sum(1 for x in active if x["type"]=="Film"),
      "TV": sum(1 for x in active if x["type"]=="TV"),
      "Book": sum(1 for x in active if x["type"]=="Book"),
    }
  }
  open("catalog_manifest_mainstream.json", "w", encoding="utf-8").write(json.dumps(manifest, indent=2))
  print("[info] Wrote catalog.js and catalog_manifest_mainstream.json")
  print("[done] Refresh the app; UI unchanged.")

if __name__ == "__main__":
  main()
