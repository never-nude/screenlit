#!/usr/bin/env python3
import json, random, re, time

POOL_TOTAL = 2000
ACTIVE_TOTAL = 300

TARGETS = {"Film": 750, "TV": 650, "Book": 600}
ACTIVE_TARGETS = {"Film": 110, "TV": 100, "Book": 90}

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
  m = re.search(r"window\.(\w*CATALOG\w*)", txt)
  return m.group(1) if m else "SL_CATALOG"

# A deliberately plural seed list (still compact) that we expand algorithmically.
FILM_SEEDS = [
  ("Casablanca", 1942), ("Singin’ in the Rain", 1952), ("Vertigo", 1958), ("Psycho", 1960),
  ("2001: A Space Odyssey", 1968), ("The Godfather", 1972), ("Jaws", 1975), ("Star Wars", 1977),
  ("Raiders of the Lost Ark", 1981), ("Back to the Future", 1985), ("Die Hard", 1988), ("Goodfellas", 1990),
  ("Jurassic Park", 1993), ("Pulp Fiction", 1994), ("Toy Story", 1995), ("Titanic", 1997),
  ("The Matrix", 1999), ("Spirited Away", 2001), ("Mean Girls", 2004), ("The Dark Knight", 2008),
  ("Frozen", 2013), ("Her", 2013), ("Mad Max: Fury Road", 2015), ("Get Out", 2017),
  ("Parasite", 2019), ("Dune", 2021), ("Barbie", 2023),
]
TV_SEEDS = [
  ("The Twilight Zone", 1959), ("M*A*S*H", 1972), ("Cheers", 1982), ("The Simpsons", 1989),
  ("Seinfeld", 1989), ("The X-Files", 1993), ("Friends", 1994), ("Buffy the Vampire Slayer", 1997),
  ("The Sopranos", 1999), ("Band of Brothers", 2001), ("The Wire", 2002), ("Arrested Development", 2003),
  ("Lost", 2004), ("The Office (US)", 2005), ("Mad Men", 2007), ("Breaking Bad", 2008),
  ("Parks and Recreation", 2009), ("Game of Thrones", 2011), ("Black Mirror", 2011), ("BoJack Horseman", 2014),
  ("Fargo", 2014), ("Stranger Things", 2016), ("The Good Place", 2016), ("Succession", 2018),
  ("Ted Lasso", 2020),
]
BOOK_SEEDS = [
  ("Pride and Prejudice", 1813), ("Frankenstein", 1818), ("Moby-Dick", 1851), ("Crime and Punishment", 1866),
  ("The Great Gatsby", 1925), ("The Hobbit", 1937), ("1984", 1949), ("The Catcher in the Rye", 1951),
  ("The Lord of the Rings", 1954), ("To Kill a Mockingbird", 1960), ("Dune", 1965), ("Slaughterhouse-Five", 1969),
  ("The Shining", 1977), ("The Handmaid’s Tale", 1985), ("Neuromancer", 1984), ("Harry Potter and the Sorcerer’s Stone", 1997),
  ("Life of Pi", 2001), ("The Kite Runner", 2003), ("Gone Girl", 2012), ("The Fault in Our Stars", 2012),
  ("The Martian", 2011), ("Ready Player One", 2011), ("The Goldfinch", 2013), ("Normal People", 2018),
]

# Expansion strategy: generate plausible “terrain” by combining seed titles with thematic/format variations.
# This is not meant to be perfect; it’s meant to be plural, huge, and stable (no internet).
VARIANTS = [
  " (Remastered)", " (Director’s Cut)", " (Extended Edition)", " (Special Edition)",
  " II", " III", " IV", " Returns", " Reloaded", " Reborn", " Redux",
  ": The Beginning", ": The Reckoning", ": After Dark", ": Season One",
]

def expand(kind, seeds, target):
  items = []
  seen = set()

  # Start with seeds as-is
  for title, year in seeds:
    key = (title, year)
    if key in seen: continue
    seen.add(key)
    items.append((title, year))

  # Expand deterministically
  rnd = random.Random(28 + hash(kind) % 9999)
  while len(items) < target:
    base_title, base_year = rnd.choice(seeds)
    v = rnd.choice(VARIANTS)
    # Keep years in a plausible range
    y = base_year
    if kind in ("Film","TV"):
      y = max(1950, min(2025, base_year + rnd.randint(-10, 10)))
    else:
      y = max(1500, min(2025, base_year + rnd.randint(-25, 25)))
    t = base_title + v
    key = (t, y)
    if key in seen: continue
    seen.add(key)
    items.append((t, y))

  return items[:target]

def make_pool():
  pool = []
  # Expand each category to target sizes
  film = expand("Film", FILM_SEEDS, TARGETS["Film"])
  tv = expand("TV", TV_SEEDS, TARGETS["TV"])
  books = expand("Book", BOOK_SEEDS, TARGETS["Book"])

  def pack(kind, pairs):
    for title, year in pairs:
      _id = f"{kind.lower()}_{slugify(title)}_{year}"
      pool.append({"id": _id, "title": title, "type": kind, "year": int(year)})

  pack("Film", film)
  pack("TV", tv)
  pack("Book", books)

  # If any shortfall (shouldn't happen), top up with repeats avoided
  return pool[:POOL_TOTAL]

def choose_active(pool):
  rnd = random.Random(28)
  by = {"Film": [], "TV": [], "Book": []}
  for it in pool:
    by[it["type"]].append(it)
  active = []
  for kind, n in ACTIVE_TARGETS.items():
    items = by[kind][:]
    rnd.shuffle(items)
    active.extend(items[:n])
  # Top up if needed
  have = set(x["id"] for x in active)
  rest = [x for x in pool if x["id"] not in have]
  rnd.shuffle(rest)
  active.extend(rest[:max(0, ACTIVE_TOTAL - len(active))])
  return active[:ACTIVE_TOTAL]

def write_catalog_js(active, global_name):
  lines = []
  lines.append(f"window.{global_name} = [")
  for i, it in enumerate(active):
    title = it["title"].replace("\\\\","\\\\\\\\").replace('"','\\"')
    lines.append(f'  {{ id: "{it["id"]}", title: "{title}", type: "{it["type"]}", year: {int(it["year"])} }}{"," if i != len(active)-1 else ""}')
  lines.append("];\n")
  open("catalog.js", "w", encoding="utf-8").write("\n".join(lines))

def main():
  global_name = detect_catalog_global("catalog.js")
  print(f"[info] Detected catalog global: window.{global_name}")
  pool = make_pool()
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
cd ~/Desktop/SL29 && cat > make_catalog_pool_offline.py <<'PY'
#!/usr/bin/env python3
import json, random, re, time

POOL_TOTAL = 2000
ACTIVE_TOTAL = 300

TARGETS = {"Film": 750, "TV": 650, "Book": 600}
ACTIVE_TARGETS = {"Film": 110, "TV": 100, "Book": 90}

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
  m = re.search(r"window\.(\w*CATALOG\w*)", txt)
  return m.group(1) if m else "SL_CATALOG"

# A deliberately plural seed list (still compact) that we expand algorithmically.
FILM_SEEDS = [
  ("Casablanca", 1942), ("Singin’ in the Rain", 1952), ("Vertigo", 1958), ("Psycho", 1960),
  ("2001: A Space Odyssey", 1968), ("The Godfather", 1972), ("Jaws", 1975), ("Star Wars", 1977),
  ("Raiders of the Lost Ark", 1981), ("Back to the Future", 1985), ("Die Hard", 1988), ("Goodfellas", 1990),
  ("Jurassic Park", 1993), ("Pulp Fiction", 1994), ("Toy Story", 1995), ("Titanic", 1997),
  ("The Matrix", 1999), ("Spirited Away", 2001), ("Mean Girls", 2004), ("The Dark Knight", 2008),
  ("Frozen", 2013), ("Her", 2013), ("Mad Max: Fury Road", 2015), ("Get Out", 2017),
  ("Parasite", 2019), ("Dune", 2021), ("Barbie", 2023),
]
TV_SEEDS = [
  ("The Twilight Zone", 1959), ("M*A*S*H", 1972), ("Cheers", 1982), ("The Simpsons", 1989),
  ("Seinfeld", 1989), ("The X-Files", 1993), ("Friends", 1994), ("Buffy the Vampire Slayer", 1997),
  ("The Sopranos", 1999), ("Band of Brothers", 2001), ("The Wire", 2002), ("Arrested Development", 2003),
  ("Lost", 2004), ("The Office (US)", 2005), ("Mad Men", 2007), ("Breaking Bad", 2008),
  ("Parks and Recreation", 2009), ("Game of Thrones", 2011), ("Black Mirror", 2011), ("BoJack Horseman", 2014),
  ("Fargo", 2014), ("Stranger Things", 2016), ("The Good Place", 2016), ("Succession", 2018),
  ("Ted Lasso", 2020),
]
BOOK_SEEDS = [
  ("Pride and Prejudice", 1813), ("Frankenstein", 1818), ("Moby-Dick", 1851), ("Crime and Punishment", 1866),
  ("The Great Gatsby", 1925), ("The Hobbit", 1937), ("1984", 1949), ("The Catcher in the Rye", 1951),
  ("The Lord of the Rings", 1954), ("To Kill a Mockingbird", 1960), ("Dune", 1965), ("Slaughterhouse-Five", 1969),
  ("The Shining", 1977), ("The Handmaid’s Tale", 1985), ("Neuromancer", 1984), ("Harry Potter and the Sorcerer’s Stone", 1997),
  ("Life of Pi", 2001), ("The Kite Runner", 2003), ("Gone Girl", 2012), ("The Fault in Our Stars", 2012),
  ("The Martian", 2011), ("Ready Player One", 2011), ("The Goldfinch", 2013), ("Normal People", 2018),
]

# Expansion strategy: generate plausible “terrain” by combining seed titles with thematic/format variations.
# This is not meant to be perfect; it’s meant to be plural, huge, and stable (no internet).
VARIANTS = [
  " (Remastered)", " (Director’s Cut)", " (Extended Edition)", " (Special Edition)",
  " II", " III", " IV", " Returns", " Reloaded", " Reborn", " Redux",
  ": The Beginning", ": The Reckoning", ": After Dark", ": Season One",
]

def expand(kind, seeds, target):
  items = []
  seen = set()

  # Start with seeds as-is
  for title, year in seeds:
    key = (title, year)
    if key in seen: continue
    seen.add(key)
    items.append((title, year))

  # Expand deterministically
  rnd = random.Random(28 + hash(kind) % 9999)
  while len(items) < target:
    base_title, base_year = rnd.choice(seeds)
    v = rnd.choice(VARIANTS)
    # Keep years in a plausible range
    y = base_year
    if kind in ("Film","TV"):
      y = max(1950, min(2025, base_year + rnd.randint(-10, 10)))
    else:
      y = max(1500, min(2025, base_year + rnd.randint(-25, 25)))
    t = base_title + v
    key = (t, y)
    if key in seen: continue
    seen.add(key)
    items.append((t, y))

  return items[:target]

def make_pool():
  pool = []
  # Expand each category to target sizes
  film = expand("Film", FILM_SEEDS, TARGETS["Film"])
  tv = expand("TV", TV_SEEDS, TARGETS["TV"])
  books = expand("Book", BOOK_SEEDS, TARGETS["Book"])

  def pack(kind, pairs):
    for title, year in pairs:
      _id = f"{kind.lower()}_{slugify(title)}_{year}"
      pool.append({"id": _id, "title": title, "type": kind, "year": int(year)})

  pack("Film", film)
  pack("TV", tv)
  pack("Book", books)

  # If any shortfall (shouldn't happen), top up with repeats avoided
  return pool[:POOL_TOTAL]

def choose_active(pool):
  rnd = random.Random(28)
  by = {"Film": [], "TV": [], "Book": []}
  for it in pool:
    by[it["type"]].append(it)
  active = []
  for kind, n in ACTIVE_TARGETS.items():
    items = by[kind][:]
    rnd.shuffle(items)
    active.extend(items[:n])
  # Top up if needed
  have = set(x["id"] for x in active)
  rest = [x for x in pool if x["id"] not in have]
  rnd.shuffle(rest)
  active.extend(rest[:max(0, ACTIVE_TOTAL - len(active))])
  return active[:ACTIVE_TOTAL]

def write_catalog_js(active, global_name):
  lines = []
  lines.append(f"window.{global_name} = [")
  for i, it in enumerate(active):
    title = it["title"].replace("\\\\","\\\\\\\\").replace('"','\\"')
    lines.append(f'  {{ id: "{it["id"]}", title: "{title}", type: "{it["type"]}", year: {int(it["year"])} }}{"," if i != len(active)-1 else ""}')
  lines.append("];\n")
  open("catalog.js", "w", encoding="utf-8").write("\n".join(lines))

def main():
  global_name = detect_catalog_global("catalog.js")
  print(f"[info] Detected catalog global: window.{global_name}")
  pool = make_pool()
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
cd ~/Desktop/SL29 && python3 make_catalog_pool_offline.py
