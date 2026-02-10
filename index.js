(function () {

  // --- ScreenLit: default session mode (no entry gate) ---
  try {
    var __m = localStorage.getItem("SL_SESSION_MODE");
    if (!__m) localStorage.setItem("SL_SESSION_MODE", "guest");
  } catch (e) {}
  // --- end default mode ---

var catalog = window.SL_CATALOG;
  var store = window.SL_Storage;

  var grid = document.getElementById("grid");

  var slots = [];        // 9 items (catalog objects)
  var slotNodes = [];    // 9 DOM nodes
  var sessionSeen = {};  // session exposure for Index (soft)

  init();

  function init() {
    var pool = pickPool();
    for (var i = 0; i < 9; i++) {
      slots[i] = pool[i] || null;
    }
    renderInitial();
  }

  function pickPool() {
    var eligible = store.eligibleTitles(catalog);
    // shuffle
    var shuffled = eligible.slice().sort(function () { return Math.random() - 0.5; });
    return shuffled.slice(0, 9);
  }

  function renderInitial() {
    grid.innerHTML = "";
    slotNodes = [];
    for (var i = 0; i < 9; i++) {
      var node = buildTile(slots[i], i);
      slotNodes[i] = node;
      grid.appendChild(node);
    }
  }

  function replaceSlot(slotIndex) {
    var oldItem = slots[slotIndex];
    if (oldItem) sessionSeen[oldItem.id] = true;

    var oldNode = slotNodes[slotIndex];
    oldNode.classList.add("fadeOut");

    window.setTimeout(function () {
      var next = pickNextForIndex();
      slots[slotIndex] = next;

      var newNode = buildTile(next, slotIndex);
      grid.replaceChild(newNode, oldNode);
      slotNodes[slotIndex] = newNode;
    }, 180);
  }

  function pickNextForIndex() {
    var eligible = store.eligibleTitles(catalog);

    // exclude currently visible
    var visible = {};
    for (var i = 0; i < slots.length; i++) {
      if (slots[i]) visible[slots[i].id] = true;
    }

    // prefer not-seen-this-session
    var candidates = [];
    for (var j = 0; j < eligible.length; j++) {
      var it = eligible[j];
      if (!visible[it.id] && !sessionSeen[it.id]) candidates.push(it);
    }
    if (candidates.length === 0) {
      for (var k = 0; k < eligible.length; k++) {
        var it2 = eligible[k];
        if (!visible[it2.id]) candidates.push(it2);
      }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function buildTile(item, slotIndex) {
    var tile = document.createElement("div");
    tile.className = "tile";

    if (!item) {
      tile.classList.add("tileEmpty");
      tile.innerHTML = '<div class="tileTitle">No titles</div><div class="tileMeta">All resolved</div>';
      return tile;
    }

    var title = document.createElement("div");
    title.className = "tileTitle";
    title.textContent = item.title;

    var meta = document.createElement("div");
    meta.className = "tileMeta";
    meta.textContent = item.type + " · " + item.year;

    var starsRow = document.createElement("div");
    starsRow.className = "starsRow";

    // Index: outline-only hover preview, gold only on click
    var hoverN = 0;

    for (var i = 1; i <= 5; i++) {
      (function (n) {
        var btn = makeStarButton("index", item.id, n);
        btn.onmouseenter = function () {
          hoverN = n;
          paintIndexHover(starsRow, hoverN);
        };
        btn.onmouseleave = function () {
          // do nothing here; row-level leave will clear
        };
        btn.onclick = function (e) {
          e.stopPropagation();
          store.setRating(item.id, n);
          replaceSlot(slotIndex);
        };
        starsRow.appendChild(btn);
      })(i);
    }

    starsRow.onmouseleave = function () {
      hoverN = 0;
      paintIndexHover(starsRow, 0);
    };

    var triad = makeTriad({
      active: true,
      onNo: function () { store.setDisposition(item.id, "no"); replaceSlot(slotIndex); },
      onUnknown: function () { store.setDisposition(item.id, "unknown"); replaceSlot(slotIndex); },
      onAdd: function () { store.setDisposition(item.id, "add"); replaceSlot(slotIndex); }
    });

    tile.appendChild(title);
    tile.appendChild(meta);
    tile.appendChild(starsRow);
    tile.appendChild(triad);

    return tile;
  }

    function paintIndexHover(starsRow, n) {
    // Index hover preview: gold fill (not persisted). Click persists.
    var buttons = starsRow.querySelectorAll(".starBtn");
    for (var i = 0; i < buttons.length; i++) {
      var outline = buttons[i].querySelector(".starOutline");
      if (outline) outline.classList.remove("hoverEmph");
      if (i < n) setStarFill(buttons[i], 1, "gold");
      else setStarFill(buttons[i], 0, "infer");
    }
  }
  

  // ---------- shared UI builders ----------

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

  // SVG star button factory
  function makeStarButton(scope, id, n) {
    var btn = document.createElement("button");
    btn.className = "starBtn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Star " + n);

    // unique ids for clip path
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

    var fillPath = btn.querySelector("path.starFillInfer, path.starFillGold");
    var inferFill = btn.querySelector("path.starFillInfer");
    if (mode === "gold") {
      // ensure fill path has gold class
      if (inferFill) inferFill.className.baseVal = "starFillGold";
    } else {
      // inferred/neutral
      if (inferFill) inferFill.className.baseVal = "starFillInfer";
    }
  }

  function cssEscape(id) {
    // minimal escape for querySelector
    return id.replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g,'\\$1');
  }
})();