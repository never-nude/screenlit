window.SL_Storage = (function () {
  // ScreenLit Storage Boundary
  // --------------------------
  // This file is the ONLY place that reads/writes browser storage.
  //
  // Design commitment:
  // - guest mode: ephemeral (session-only), does NOT affect aggregate
  // - local mode: persistent (placeholder for logged-in), WILL be used for aggregate later

  var LOCAL_KEY = "screenlit-state-v1";          // persistent
  var GUEST_KEY = "screenlit-guest-state-v1";    // per-tab session
  var MODE_KEY  = "screenlit-mode-v1";           // stored in sessionStorage

  // Inference constants (single tuning surface)
  var INFERENCE = {
    RECENT_WINDOW: 12,
    RECENT_WEIGHT: 0.3,
    TYPE_BASE_WEIGHT: 0.2,
    TYPE_RAMP_COUNT: 10
  };

  // Debug (OFF by default)
  var DEBUG_INFERENCE = false;
  function setInferenceDebug(on) { DEBUG_INFERENCE = !!on; }

  function now() { return Date.now(); }

  function blankState() {
    return {
      ratings: {},
      ratingTimes: {},
      dispositions: {},
      dispositionTimes: {}
    };
  }

  // ---- Mode seam ----
  // Default stays "local" so we do not change behavior until you explicitly switch.
  function getSessionMode() {
    try {
      var m = sessionStorage.getItem(MODE_KEY);
      return (m === "guest") ? "guest" : "local";
    } catch (e) {
      return "local";
    }
  }

  function setSessionMode(mode) {
    var m = (mode === "guest") ? "guest" : "local";
    try { sessionStorage.setItem(MODE_KEY, m); } catch (e) {}
    return m;
  }

  function hasSessionMode() {
    try { return sessionStorage.getItem(MODE_KEY) !== null; } catch (e) { return false; }
  }

  function clearGuestSession() {
    try { sessionStorage.removeItem(GUEST_KEY); } catch (e) {}
  }

  // Storage driver: (sessionStorage + guest key) OR (localStorage + local key)
  // If storage is blocked, we fall back to in-memory for that mode.
  var mem = {
    local: null,
    guest: null
  };

  function driver() {
    if (getSessionMode() === "guest") {
      return { kind: "guest", store: safeSessionStorage(), key: GUEST_KEY };
    }
    return { kind: "local", store: safeLocalStorage(), key: LOCAL_KEY };
  }

  function safeLocalStorage() {
    try { return localStorage; } catch (e) { return null; }
  }

  function safeSessionStorage() {
    try { return sessionStorage; } catch (e) { return null; }
  }

  function load() {
    var d = driver();

    // memory fallback
    if (!d.store) {
      if (!mem[d.kind]) mem[d.kind] = blankState();
      return normalize(mem[d.kind]);
    }

    try {
      var raw = d.store.getItem(d.key);
      if (!raw) return blankState();
      var parsed = JSON.parse(raw);
      return normalize(parsed);
    } catch (e) {
      // storage read/parse failed → memory fallback
      if (!mem[d.kind]) mem[d.kind] = blankState();
      return normalize(mem[d.kind]);
    }
  }

  function save(state) {
    var d = driver();

    // memory fallback
    if (!d.store) {
      mem[d.kind] = normalize(state);
      return;
    }

    try {
      d.store.setItem(d.key, JSON.stringify(state));
    } catch (e) {
      // storage write failed → memory fallback
      mem[d.kind] = normalize(state);
    }
  }

  function normalize(s) {
    if (!s || typeof s !== "object") s = blankState();
    s.ratings = s.ratings || {};
    s.ratingTimes = s.ratingTimes || {};
    s.dispositions = s.dispositions || {};
    s.dispositionTimes = s.dispositionTimes || {};
    return s;
  }

  function getRating(id) {
    var s = load();
    return (id in s.ratings) ? s.ratings[id] : null;
  }

  function setRating(id, value) {
    var s = load();
    s.ratings[id] = value;
    s.ratingTimes[id] = now();
    // If you rate it, disposition becomes irrelevant
    if (id in s.dispositions) {
      delete s.dispositions[id];
      delete s.dispositionTimes[id];
    }
    save(s);
    // Aggregate submission: local mode only (guest never affects aggregate)
    try {
      if (getSessionMode() === "local" && window.SL_Aggregate && typeof window.SL_Aggregate.recordRating === "function") {
        window.SL_Aggregate.recordRating(id, value);
      }
    } catch (e) {}
  }

  function getDisposition(id) {
    var s = load();
    return (id in s.dispositions) ? s.dispositions[id] : null;
  }

  function setDisposition(id, value) {
    var s = load();
    s.dispositions[id] = value;
    s.dispositionTimes[id] = now();
    save(s);
  }

  function getAllRatings() {
    return load().ratings;
  }

  function getAllDispositions() {
    return load().dispositions;
  }

  // Cooldowns are per-mode (guest cooldown is within-session; local cooldown persists)
  var COOLDOWN_MS = {
    no: 1000 * 60 * 60 * 24 * 90,
    unknown: 1000 * 60 * 60 * 24 * 30,
    add: 1000 * 60 * 60 * 24 * 7
  };

  function isEligible(id) {
    var s = load();
    if (id in s.ratings) return false;
    if (!(id in s.dispositions)) return true;

    var disp = s.dispositions[id];
    var t = s.dispositionTimes[id] || 0;
    var cd = COOLDOWN_MS[disp] || COOLDOWN_MS.unknown;
    return (now() - t) > cd;
  }

  function activePoolSet() {
    try {
      var pools = window.SL_POOLS;
      if (!pools || !pools.ACTIVE_POOL || !pools.ACTIVE_POOL.length) return null;
      var set = {};
      for (var i = 0; i < pools.ACTIVE_POOL.length; i++) {
        set[pools.ACTIVE_POOL[i]] = true;
      }
      return set;
    } catch (e) {
      return null;
    }
  }

  function eligibleTitles(catalog) {
    var set = activePoolSet();
    return catalog.filter(function (it) {
      if (set && !set[it.id]) return false;
      return isEligible(it.id);
    });
  }

  function mostRecentRating() {
    var s = load();
    var bestId = null;
    var bestT = -1;
    for (var id in s.ratingTimes) {
      var t = s.ratingTimes[id];
      if (t > bestT) { bestT = t; bestId = id; }
    }
    if (!bestId) return null;
    return { id: bestId, value: s.ratings[bestId], time: bestT };
  }

  // -------- Inference (global + recent + type) --------
  function inferForTitle(item, catalog) {
    var s = load();
    var ratings = s.ratings;
    var times = s.ratingTimes;

    var allVals = [];
    for (var k in ratings) allVals.push(ratings[k]);
    if (allVals.length === 0) return 3.0;

    var global =
      allVals.reduce(function (a, b) { return a + b; }, 0) / allVals.length;

    // recent mean
    var ids = Object.keys(times).sort(function (a, b) { return times[b] - times[a]; });
    var recentIds = ids.slice(0, INFERENCE.RECENT_WINDOW);

    var recentVals = [];
    for (var i = 0; i < recentIds.length; i++) {
      recentVals.push(ratings[recentIds[i]]);
    }

    var recentMean = recentVals.length
      ? recentVals.reduce(function (a, b) { return a + b; }, 0) / recentVals.length
      : global;

    var blendedGlobal =
      (1 - INFERENCE.RECENT_WEIGHT) * global +
      INFERENCE.RECENT_WEIGHT * recentMean;

    // type-specific mean
    var typeVals = [];
    for (var id in ratings) {
      for (var j = 0; j < catalog.length; j++) {
        if (catalog[j].id === id) {
          if (catalog[j].type === item.type) typeVals.push(ratings[id]);
          break;
        }
      }
    }

    var inferred, typeMean = null, typeWeight = 0;

    if (typeVals.length === 0) {
      inferred = blendedGlobal;
    } else {
      typeMean =
        typeVals.reduce(function (a, b) { return a + b; }, 0) / typeVals.length;

      typeWeight =
        Math.min(typeVals.length / INFERENCE.TYPE_RAMP_COUNT, 1.0) *
        INFERENCE.TYPE_BASE_WEIGHT;

      inferred =
        (1 - typeWeight) * blendedGlobal +
        typeWeight * typeMean;
    }

    inferred = clamp(inferred, 1, 5);

    if (DEBUG_INFERENCE) {
      console.info("[Infer]",
        item.title,
        "| mode:", getSessionMode(),
        "| global:", global.toFixed(2),
        "| recent:", recentMean.toFixed(2),
        "| type:", (typeMean === null ? "n/a" : typeMean.toFixed(2)),
        "| w(type):", typeWeight.toFixed(2),
        "| result:", inferred.toFixed(2)
      );
    }

    return inferred;
  }
  // ----------------------------------------------------

  function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
  }

  return {
    // storage boundary
    load: load,
    save: save,

    // ratings/dispositions
    getRating: getRating,
    setRating: setRating,
    getDisposition: getDisposition,
    setDisposition: setDisposition,
    getAllRatings: getAllRatings,
    getAllDispositions: getAllDispositions,

    // eligibility
    isEligible: isEligible,
    eligibleTitles: eligibleTitles,
    mostRecentRating: mostRecentRating,

    // inference
    inferForTitle: inferForTitle,
    setInferenceDebug: setInferenceDebug,

    // mode seam
    getSessionMode: getSessionMode,
    hasSessionMode: hasSessionMode,
    setSessionMode: setSessionMode,
    clearGuestSession: clearGuestSession
  };
})();
