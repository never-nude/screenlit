(function () {
  var catalog = window.SL_CATALOG;
  var store = window.SL_Storage;
  var agg = window.SL_Aggregate || null;

  var conveyor = document.getElementById("conveyor");

  var sessionSeen = {}; // Discover exposure (session-scoped)
  var leftItem = null;  // {item, rating} or null
  var centerItem = null; // catalog item
  var rightItem = null;  // catalog item

  init();

  function init() {
    // left starts empty by design
    centerItem = pickNext(null, null);
    rightItem = pickNext(centerItem, null);
    render();
  }

  function render() {
    conveyor.innerHTML = "";

    conveyor.appendChild(renderSlot("left", leftItem ? leftItem.item : null, leftItem ? leftItem.rating : null));
    conveyor.appendChild(renderSlot("center", centerItem, null));
    conveyor.appendChild(renderSlot("right", rightItem, null));
  }

  function renderSlot(role, item, explicitRating) {
    var slot = document.createElement("div");
    slot.className = "slot " + role;

    if (!item) {
      var empty = document.createElement("div");
      empty.className = "tile tileEmpty";
      slot.appendChild(empty);
      return slot;
    }

    var tile = document.createElement("div");
    tile.className = "tile";

    var title = document.createElement("div");
    title.className = "tileTitle";
    title.textContent = item.title;

    var meta = document.createElement("div");
    meta.className = "tileMeta";
    meta.textContent = item.type + " · " + item.year;

    // Optional: anonymous aggregate count (Discover only). Hidden unless available.
    var stats = (agg && typeof agg.getTitleStats === "function") ? agg.getTitleStats(item.id) : null;
    if (stats && stats.count != null) {
      var countEl = document.createElement("span");
      countEl.className = "aggCount";
      countEl.textContent = "  ⋄ " + String(stats.count);
      meta.appendChild(countEl);
    }

    var starsRow = document.createElement("div");
    starsRow.className = "starsRow";

    // inferred rating for this title (float)
    var inferred = store.inferForTitle(item, catalog);

    // paint modes:
    // - left tile shows explicit gold rating (explicitRating float/int)
    // - center/right show inferred dark by default
    // - center hover shows gold preview and hides inferred
    // - center mouseleave restores inferred
    if (role === "left") {
      paintStars(starsRow, explicitRating || 0, "gold", false);
    } else {
      paintStars(starsRow, inferred, "infer", false);
    }

    // Build 5 star buttons
    for (var i = 1; i <= 5; i++) {
      (function (n) {
        var btn = makeStarButton("discover", item.id, n);

        if (role !== "center") {
          btn.setAttribute("aria-disabled", "true");
        } else {
          btn.onmouseenter = function () {
            // hide inferred; show gold preview
            paintStars(starsRow, n, "gold", true);
          };
          btn.onclick = function (e) {
            e.stopPropagation();
            commitRating(item, n);
          };
        }

        starsRow.appendChild(btn);
      })(i);
    }
    // Ensure inferred stars paint on first render (buttons now exist)
    var __inf = (typeof inferred !== "undefined" && inferred != null) ? inferred : 0;
    var __exp = (typeof explicitRating !== "undefined" && explicitRating != null) ? explicitRating : 0;
    if (typeof role !== "undefined" && role === "left") {
      paintStars(starsRow, __exp, "gold", false);
    } else {
      paintStars(starsRow, __inf, "infer", false);
    }


    if (role === "center") {
      starsRow.onmouseleave = function () {
        // restore inferred
        paintStars(starsRow, inferred, "infer", false);
      };
    }

    // Icon triad must be present on ALL tiles (same layout),
    // but only center tile is active. Left tile remains clickable as a whole.
    var triad = makeTriad({
      active: role === "center",
      onNo: function () { resolveDisposition(item, "no"); },
      onUnknown: function () { resolveDisposition(item, "unknown"); },
      onAdd: function () { resolveDisposition(item, "add"); }
    });

    // Left tile retreat: click tile (not symbols/stars)
    if (role === "left") {
      tile.onclick = function () {
        // pull left back to center for revision
        if (!leftItem) return;
        // shift current center to right, right to remain (conservative)
        rightItem = centerItem;
        centerItem = leftItem.item;
        leftItem = null;
        render();
      };
    }

    tile.appendChild(title);
    tile.appendChild(meta);
    tile.appendChild(starsRow);
    tile.appendChild(triad);
    slot.appendChild(tile);

    return slot;
  }

  function commitRating(item, n) {
    store.setRating(item.id, n);
    leftItem = { item: item, rating: n };
    advance();
  }

  function resolveDisposition(item, disp) {
    store.setDisposition(item.id, disp);
    leftItem = { item: item, rating: null };
    advance();
  }

  function advance() {
    // Mark exposure
    if (centerItem) sessionSeen[centerItem.id] = true;
    if (rightItem) sessionSeen[rightItem.id] = true;

    // Shift conveyor
    centerItem = rightItem;
    rightItem = pickNext(centerItem, leftItem ? leftItem.item : null);

    render();
  }

  function pickNext(excludeA, excludeB) {
    var eligible = store.eligibleTitles(catalog);
    // GRAPH_NEIGHBOR_PICK v1 (optional)
    // If a graph is present, try neighbors of the most recent committed title.
    try {
      var graph = window.SL_Graph;
      // Prefer the most recent user action in Discover (leftItem), fall back to storage's mostRecentRating.
      var anchor = (typeof leftItem !== "undefined" && leftItem && leftItem.item) ? leftItem.item : null;
      if (!anchor && store && typeof store.mostRecentRating === "function") {
        var mr = store.mostRecentRating();
        if (mr && mr.id) anchor = { id: mr.id };
      }

      if (graph && anchor && typeof graph.getNeighbors === "function") {
        var neigh = graph.getNeighbors(anchor.id) || [];
        if (neigh && neigh.length) {
          var excludeIds = {};
          if (excludeA) excludeIds[excludeA.id] = true;
          if (excludeB) excludeIds[excludeB.id] = true;

          // eligible[] already computed above; build a quick set
          var eligibleSet = {};
          for (var _e = 0; _e < eligible.length; _e++) eligibleSet[eligible[_e].id] = true;

          // catalog lookup
          var byId = {};
          for (var _c = 0; _c < catalog.length; _c++) byId[catalog[_c].id] = catalog[_c];

          var picks = [];
          var totalW = 0;

          for (var _n = 0; _n < neigh.length; _n++) {
            var ref = neigh[_n];
            var nid = (typeof ref === "string") ? ref : (ref && ref.id);
            var w = (ref && typeof ref.w === "number") ? ref.w : 1;
            if (!nid) continue;
            if (excludeIds[nid]) continue;
            if (!eligibleSet[nid]) continue;
            if (sessionSeen && sessionSeen[nid]) continue;

            var it = byId[nid];
            if (!it) continue;

            totalW += w;
            picks.push({ item: it, w: w });
          }

          if (picks.length) {
            var r = Math.random() * totalW;
            for (var _p = 0; _p < picks.length; _p++) {
              r -= picks[_p].w;
              if (r <= 0) {
                if (graph._debugEnabled && graph._debugEnabled()) {
                  console.info("[graph pick]", { anchor: anchor.id, pick: picks[_p].item.id, title: picks[_p].item.title });
                }
                return picks[_p].item;
              }
            }
            if (graph._debugEnabled && graph._debugEnabled()) {
              var last = picks[picks.length - 1].item;
              console.info("[graph pick]", { anchor: anchor.id, pick: last.id, title: last.title });
            }
            return picks[picks.length - 1].item;
          }
        }
      }
    } catch (e) {}


    var exclude = {};
    if (excludeA) exclude[excludeA.id] = true;
    if (excludeB) exclude[excludeB.id] = true;

    // Prefer not-seen-this-session
    var candidates = [];
    for (var i = 0; i < eligible.length; i++) {
      var it = eligible[i];
      if (exclude[it.id]) continue;
      if (!sessionSeen[it.id]) candidates.push(it);
    }
    if (candidates.length === 0) {
      for (var j = 0; j < eligible.length; j++) {
        var it2 = eligible[j];
        if (!exclude[it2.id]) candidates.push(it2);
      }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // ----- star painting (fractional) -----

  function paintStars(starsRow, value, mode, isPreviewInteger) {
    starsRow.dataset.paintValue = String(value);
    starsRow.dataset.paintMode = mode;

    var btns = starsRow.querySelectorAll(".starBtn");
    for (var i = 0; i < btns.length; i++) {
      var starIndex = i + 1;
      var frac = 0;

      if (isPreviewInteger) {
        frac = (starIndex <= value) ? 1 : 0;
      } else {
        // fractional fill: value like 3.2
        var diff = value - (starIndex - 1);
        frac = clamp(diff, 0, 1);
      }

      setStarFill(btns[i], frac, mode === "gold" ? "gold" : "infer");
      // outlines should stay neutral in Discover
      var outline = btns[i].querySelector(".starOutline");
      if (outline) outline.classList.remove("hoverEmph");
    }
  }

  function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
  }

  // ---------- shared UI builders (same as Index) ----------

  function makeTriad(cfg) {
    var triad = document.createElement("div");
    triad.className = "triad";

    triad.appendChild(makeIcon("−", "No", cfg.active ? cfg.onNo : null, cfg.active));
    triad.appendChild(makeIcon("○", "Don’t know", cfg.active ? cfg.onUnknown : null, cfg.active));
    triad.appendChild(makeIcon("+", "Add", cfg.active ? cfg.onAdd : null, cfg.active));

    return triad;
  }

  function makeIcon(glyph, label, fn, active) {
    var el = document.createElement("div");
    el.className = "icon";
    el.tabIndex = 0;

    var lbl = document.createElement("div");
    lbl.className = "iconLabel";
    lbl.textContent = label;

    el.innerHTML = glyph;
    el.appendChild(lbl);

    if (!active || typeof fn !== "function") {
      el.setAttribute("aria-disabled", "true");
      el.onclick = function (e) { e.stopPropagation(); };
      return el;
    }

    el.onclick = function (e) {
      e.stopPropagation();
      fn();
    };

    return el;
  }

  function makeStarButton(scope, id, n) {
    var btn = document.createElement("button");
    btn.className = "starBtn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Star " + n);

    var clipId = "clip_" + scope + "_" + id + "_" + n + "_" + Math.floor(Math.random() * 1e9);

    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
        '<defs><clipPath id="' + clipId + '"><rect x="0" y="0" width="0" height="24"></rect></clipPath></defs>' +
        '<path class="starFillInfer" clip-path="url(#' + clipId + ')" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path>' +
        '<path class="starOutline" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path>' +
      '</svg>';

    btn.dataset.clipId = clipId;
    return btn;
  }

  function setStarFill(btn, frac0to1, mode) {
    var clipId = btn.dataset.clipId;
    if (!clipId) return;

    var rect = btn.querySelector('#' + cssEscape(clipId) + ' rect');
    if (!rect) return;

    rect.setAttribute("width", String(Math.max(0, Math.min(1, frac0to1)) * 24));

    var inferFill = btn.querySelector("path.starFillInfer, path.starFillGold");
    if (!inferFill) return;

    if (mode === "gold") {
      inferFill.className.baseVal = "starFillGold";
    } else {
      inferFill.className.baseVal = "starFillInfer";
    }
  }

  function cssEscape(id) {
    return id.replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g,'\\$1');
  }
})();

/* --- ScreenLit graph probe (auto) --- */
(function(){
  try {
    var qs = new URLSearchParams(location.search);
    if (qs.get('graphdebug') === '1') {
      var seed = window.SL_GRAPH_SEED || null;
      var edges = (seed && seed.edges) ? Object.keys(seed.edges).length : 0;
      var pairs = (seed && seed.pairs) ? seed.pairs.length : 0;
      console.log('[graph] probe', { graphseed: qs.get('graphseed'), graphtest: qs.get('graphtest'), edges: edges, pairs: pairs, hasGraph: !!window.SL_Graph });
    }
  } catch (e) {}
})();
