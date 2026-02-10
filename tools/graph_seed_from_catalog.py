#!/usr/bin/env python3
import argparse, os, re, subprocess, sys, time
from datetime import datetime

def norm_title(t: str) -> str:
    t = t.strip().lower()
    # strip trailing disambiguators like " (Book)" etc
    t = re.sub(r'\s+\((book|film|tv)\)\s*$', '', t, flags=re.I)
    # collapse whitespace
    t = re.sub(r'\s+', ' ', t)
    return t

def parse_catalog(catalog_js: str):
    s = open(catalog_js, "r", encoding="utf-8").read()

    # Matches entries like:
    # { id:"film_xxx_2001", title:"Some Title", type:"Film", year:2001 },
    pat = re.compile(
        r'\{\s*id:"([^"]+)"\s*,\s*title:"([^"]+)"\s*,\s*type:"([^"]+)"\s*,\s*year:(\d{4})\s*\}',
        re.M
    )

    items = []
    for m in pat.finditer(s):
        items.append({
            "id": m.group(1),
            "title": m.group(2),
            "type": m.group(3),
            "year": int(m.group(4)),
        })
    return items

def main():
    ap = argparse.ArgumentParser(description="Seed ScreenLit graph from catalog duplicates (Book ↔ Film/TV).")
    ap.add_argument("--limit", type=int, default=60, help="Max pairs to apply.")
    ap.add_argument("--apply", action="store_true", help="Actually apply via tools/graph_add_pair.sh")
    args = ap.parse_args()

    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    catalog_js = os.path.join(root, "catalog.js")
    graph_add = os.path.join(root, "tools", "graph_add_pair.sh")

    if not os.path.exists(catalog_js):
        print(f"[fail] missing {catalog_js}")
        return 1
    if not os.path.exists(graph_add):
        print(f"[fail] missing {graph_add} (expected graph tooling)")
        return 1

    items = parse_catalog(catalog_js)
    by_key = {}
    for it in items:
        key = norm_title(it["title"])
        by_key.setdefault(key, []).append(it)

    pairs = []
    ambiguous = 0

    for key, group in by_key.items():
        books = [x for x in group if x["type"].lower() == "book"]
        others = [x for x in group if x["type"].lower() in ("film", "tv")]

        # strict: exactly one Book, and 1–2 others, and *no extra* types in the group
        if len(books) == 1 and 1 <= len(others) <= 2 and (len(books) + len(others) == len(group)):
            b = books[0]
            # pair each Film/TV to the Book
            for o in sorted(others, key=lambda x: (x["type"], x["year"], x["id"])):
                pairs.append((o["id"], b["id"], key, o["type"], b["type"]))
        else:
            # only count as ambiguous if it had at least one book and one other
            if len(books) >= 1 and len(others) >= 1:
                ambiguous += 1

    pairs.sort(key=lambda p: p[2])

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    report = os.path.join(root, "tools", f"graph_seed_report_{ts}.txt")

    with open(report, "w", encoding="utf-8") as f:
        f.write(f"[ScreenLit] graph seed report {ts}\n")
        f.write(f"catalog_items={len(items)}\n")
        f.write(f"candidate_pairs={len(pairs)}\n")
        f.write(f"ambiguous_groups_skipped={ambiguous}\n\n")
        f.write("first_50_candidates:\n")
        for (a,b,key,ta,tb) in pairs[:50]:
            f.write(f"  {key} :: {a} <-> {b}\n")

    print(f"[ok] catalog_items={len(items)} candidate_pairs={len(pairs)} ambiguous_groups_skipped={ambiguous}")
    print(f"[ok] report={report}")
    print("[ok] first 20 candidates:")
    for (a,b,key,ta,tb) in pairs[:20]:
        print(f"  {key} :: {a} <-> {b}")

    if not args.apply:
        print("[note] dry run only. Re-run with: --apply")
        return 0

    to_apply = pairs[:max(0, args.limit)]
    print(f"[apply] applying {len(to_apply)} pairs via tools/graph_add_pair.sh ...")

    for (a,b,key,ta,tb) in to_apply:
        # run graph_add_pair.sh <id1> <id2>
        subprocess.run([graph_add, a, b], check=True)

    print("[ok] apply complete")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
