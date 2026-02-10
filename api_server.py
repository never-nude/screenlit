#!/usr/bin/env python3
import json, os, sqlite3, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(ROOT, "screenlit.db")

ALLOWED_ORIGIN = "http://127.0.0.1:8147"

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = db()
    cur = conn.cursor()
    cur.execute("""
      CREATE TABLE IF NOT EXISTS profiles(
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL
      )
    """)
    cur.execute("""
      CREATE TABLE IF NOT EXISTS ratings(
        profile_id TEXT NOT NULL,
        title_id   TEXT NOT NULL,
        rating     INTEGER,
        disposition TEXT,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(profile_id, title_id)
      )
    """)
    conn.commit()
    conn.close()

def json_bytes(obj):
    return (json.dumps(obj, separators=(",",":")) + "\n").encode("utf-8")

class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def send_json(self, code, obj):
        data = json_bytes(obj)
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def read_json(self):
        n = int(self.headers.get("Content-Length","0") or "0")
        raw = self.rfile.read(n) if n else b"{}"
        try:
            return json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            return {}

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/api/ping":
            return self.send_json(200, {"ok": True})

        if u.path == "/api/title_stats":
            q = parse_qs(u.query or "")
            tid = (q.get("id") or [None])[0]
            if not tid:
                return self.send_json(400, {"ok": False, "error": "missing id"})
            conn = db()
            cur = conn.cursor()
            # rating IS NOT NULL => only actual star ratings count
            cur.execute("SELECT COUNT(*) AS n, AVG(rating) AS avg FROM ratings WHERE title_id=? AND rating IS NOT NULL", (tid,))
            row = cur.fetchone()
            conn.close()
            n = int(row["n"] or 0)
            avg = row["avg"]
            mean = float(avg) if avg is not None else None
            return self.send_json(200, {"ok": True, "id": tid, "count": n, "mean": mean})

        return self.send_json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        u = urlparse(self.path)
        data = self.read_json()

        if u.path == "/api/profile":
            pid = str(uuid.uuid4())
            now = int(time.time())
            conn = db()
            cur = conn.cursor()
            cur.execute("INSERT OR IGNORE INTO profiles(id, created_at) VALUES(?,?)", (pid, now))
            conn.commit()
            conn.close()
            return self.send_json(200, {"ok": True, "profile_id": pid})

        if u.path == "/api/rate":
            pid = data.get("profile_id")
            tid = data.get("title_id")
            rating = data.get("rating", None)
            disposition = data.get("disposition", None)

            if not pid or not tid:
                return self.send_json(400, {"ok": False, "error": "missing profile_id or title_id"})

            r = None
            if rating is not None:
                try:
                    r = int(rating)
                    if r < 1 or r > 5:
                        r = None
                except Exception:
                    r = None

            disp = disposition if disposition in ("unknown", "skip", None, "") else None
            now = int(time.time())

            conn = db()
            cur = conn.cursor()
            cur.execute("""
              INSERT OR REPLACE INTO ratings(profile_id, title_id, rating, disposition, updated_at)
              VALUES(?,?,?,?,?)
            """, (pid, tid, r, disp, now))
            conn.commit()
            conn.close()
            return self.send_json(200, {"ok": True})

        return self.send_json(404, {"ok": False, "error": "not found"})

def main():
    init_db()
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8148)
    args = ap.parse_args()
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"[api] listening on http://127.0.0.1:{args.port}")
    srv.serve_forever()

if __name__ == "__main__":
    main()
