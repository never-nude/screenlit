// ScreenLit Aggregate Boundary (API-backed, safe by default)
// ---------------------------------------------------------
// Read path (Discover):
// - getTitleStats(id) returns cached stats synchronously
// - triggers background fetch from the local API when needed
// - emits window event "sl:agg" when a stat arrives so UI can update
//
// Write path:
// - still a no-op here; backend_hook.js posts ratings in Saved mode.
//
// Dev tools:
// - ?aggtest=1 seeds deterministic fake counts (no API needed)
// - ?aggdebug=1 logs fetch + recordRating breadcrumbs

window.SL_Aggregate = (function () {
  var stub = null;           // { [id]: {count, mean} }
  var cache = {};            // { [id]: {count, mean, at} }
  var inflight = {};         // { [id]: true }
  var TTL_MS = 60 * 1000;    // refresh window for API reads

  function qp(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  }
  function shouldSeed() { return qp("aggtest") === "1"; }
  function debugOn() { return qp("aggdebug") === "1"; }

  function log() {
    if (!debugOn()) return;
    try { console.info.apply(console, arguments); } catch (e) {}
  }

  function apiBase() {
    try { return localStorage.getItem("SL_API_BASE") || "http://127.0.0.1:8148"; }
    catch (e) { return "http://127.0.0.1:8148"; }
  }

  function canSeedNow() {
    return !!(window.SL_CATALOG && Array.isArray(window.SL_CATALOG) && window.SL_CATALOG.length);
  }

  function seedIfNeeded() {
    try {
      if (stub != null) return;
      if (!shouldSeed()) return;
      if (!canSeedNow()) return;

      var map = {};
      for (var i = 0; i < window.SL_CATALOG.length; i++) {
        map[window.SL_CATALOG[i].id] = { count: (i % 97) + 1, mean: null };
      }
      stub = map;

      window.__SL_AGGTEST_SEEDED = true;
      log("[agg] seeded stub counts");
    } catch (e) {}
  }

  function normalize(x) {
    if (x == null) return { count: null, mean: null };
    if (typeof x === "number") return { count: x, mean: null };
    return {
      count: (typeof x.count === "number") ? x.count : null,
      mean: (typeof x.mean === "number") ? x.mean : null
    };
  }

  function emit(id) {
    try {
      window.dispatchEvent(new CustomEvent("sl:agg", { detail: { id: id } }));
    } catch (e) {
      try { window.dispatchEvent(new Event("sl:agg")); } catch (e2) {}
    }
  }

  async function fetchTitleStats(id) {
    if (!id) return;
    if (inflight[id]) return;
    inflight[id] = true;

    try {
      var url = apiBase() + "/api/title_stats?id=" + encodeURIComponent(id);
      log("[agg] GET", url);
      var r = await fetch(url, { method: "GET", cache: "no-store" });
      var j = await r.json();

      if (j && j.ok) {
        cache[id] = {
          count: (typeof j.count === "number" && j.count > 0) ? j.count : null,
          mean: (typeof j.mean === "number") ? j.mean : null,
          at: Date.now()
        };
        emit(id);
      }
    } catch (e) {
      log("[agg] fetch failed", id, e);
    } finally {
      delete inflight[id];
    }
  }

  function getTitleStats(id) {
    seedIfNeeded();

    if (stub && Object.prototype.hasOwnProperty.call(stub, id)) {
      return normalize(stub[id]);
    }

    var hit = cache[id];
    var now = Date.now();

    if (!hit || !hit.at || (now - hit.at) > TTL_MS) {
      fetchTitleStats(id);
    }

    return normalize(hit);
  }

  function prefetch(ids) {
    try {
      if (!ids || !ids.length) return;
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        if (!id) continue;
        getTitleStats(id);
      }
    } catch (e) {}
  }

  // WRITE boundary (still a stub; backend_hook.js does real POSTs in saved mode)
  function recordRating(id, value) {
    seedIfNeeded();
    log("[agg] recordRating (noop)", { id: id, value: value });
  }

  function setStub(map) { stub = map || null; }
  function clearStub() { stub = null; }

  return {
    getTitleStats: getTitleStats,
    prefetch: prefetch,
    recordRating: recordRating,
    setStub: setStub,
    clearStub: clearStub
  };
})();
