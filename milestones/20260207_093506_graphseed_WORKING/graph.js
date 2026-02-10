// ScreenLit Graph v1.1 (deterministic seed ingestion)
// ---------------------------------------------------
// - SL_GRAPH_SEED.edges is ingested when ?graphseed=1
// - Retries ingestion a few times to avoid script-order timing issues
// - Exposes: SL_Graph.__seededEdgeCount and SL_Graph.loadSeedNow()

(function () {
  function qs(name) {
    try { return new URLSearchParams(location.search).get(name); }
    catch (e) { return null; }
  }

  function debugEnabled() { return qs("graphdebug") === "1"; }

  var edges = Object.create(null);

  function clear() { edges = Object.create(null); }

  function setEdges(map) {
    clear();
    if (!map) return;

    for (var k in map) {
      if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
      var arr = map[k] || [];
      var out = [];
      for (var i = 0; i < arr.length; i++) {
        var ref = arr[i];
        if (!ref) continue;
        if (typeof ref === "string") out.push({ id: ref, w: 1 });
        else if (ref.id) out.push({ id: ref.id, w: (typeof ref.w === "number" ? ref.w : 1) });
      }
      edges[k] = out;
    }
  }

  function getNeighbors(id) { return edges[id] || []; }

  function ingestSeedIfRequested() {
    try {
      var sp = new URLSearchParams(location.search);
      if (sp.get("graphseed") !== "1") return false;

      var seed = window.SL_GRAPH_SEED || null;
      if (!seed || !seed.edges) return false;

      var n = Object.keys(seed.edges).length;
      if (!n) return false;

      setEdges(seed.edges);

      // Always set these so you can check in console
      window.SL_Graph.__seedLoaded = true;
      window.SL_Graph.__seededEdgeCount = n;

      if (debugEnabled()) {
        console.info("[graph] seed ingested", { edges: n });
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // Deterministic test seed (optional)
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function seedTestEdges(catalog) {
    if (!Array.isArray(catalog) || catalog.length === 0) return;
    var byType = { Film: [], TV: [], Book: [] };
    for (var i = 0; i < catalog.length; i++) {
      var it = catalog[i];
      if (it && byType[it.type]) byType[it.type].push(it.id);
    }
    function pickFrom(arr, h, salt) {
      if (!arr || arr.length === 0) return null;
      return arr[(h + salt) % arr.length];
    }
    var seeded = Object.create(null);
    for (var j = 0; j < catalog.length; j++) {
      var item = catalog[j];
      if (!item || !item.id) continue;
      var h = hashStr(item.id);
      var neigh = [];
      if (item.type !== "Book" && byType.Book.length) {
        var b = pickFrom(byType.Book, h, 7);
        if (b && b !== item.id) neigh.push({ id: b, w: 1.0 });
      }
      if (item.type !== "Film" && byType.Film.length) {
        var f = pickFrom(byType.Film, h, 13);
        if (f && f !== item.id) neigh.push({ id: f, w: 0.85 });
      }
      if (item.type !== "TV" && byType.TV.length) {
        var t = pickFrom(byType.TV, h, 29);
        if (t && t !== item.id) neigh.push({ id: t, w: 0.85 });
      }
      if (neigh.length) seeded[item.id] = neigh;
    }
    setEdges(seeded);
    window.SL_Graph.__seedLoaded = true;
    window.SL_Graph.__seededEdgeCount = Object.keys(seeded).length;
    if (debugEnabled()) console.info("[graph] seeded test edges", { edges: window.SL_Graph.__seededEdgeCount });
  }

  window.SL_Graph = {
    getNeighbors: getNeighbors,
    setEdges: setEdges,
    clear: clear,
    __seedLoaded: false,
    __seededEdgeCount: 0,
    loadSeedNow: ingestSeedIfRequested,
    _debugEnabled: debugEnabled,
    _seedTestEdges: seedTestEdges
  };

  // Try ingest a few times (order/timing proof)
  function retry() {
    if (window.SL_Graph.__seedLoaded) return;
    var ok = ingestSeedIfRequested();
    if (ok) return;
  }

  // Retry immediately and after load; plus a few timed retries.
  retry();
  setTimeout(retry, 0);
  setTimeout(retry, 200);
  setTimeout(retry, 800);
  window.addEventListener("load", retry);

  // Optional graphtest seed
  if (qs("graphtest") === "1") {
    try { seedTestEdges(window.SL_CATALOG); } catch (e) {}
  }
})();
