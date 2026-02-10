// jump_ui.js — adds centered ↯ Jump button to Discover footer (Home | ↯ | Mode)
// Behavior:
// - ↯ is always visible (minimal UI)
// - light gray when no neighbors
// - dark gray when neighbors exist
// - click triggers same behavior as pressing W (wormhole jump)

(function () {
  function qs(sel, root){ return (root || document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function hasQueryFlag(name){
    return new URLSearchParams(location.search).get(name) === "1";
  }
  var DEBUG = hasQueryFlag("wormdebug");

  function dlog(){
    if (!DEBUG) return;
    try { console.log.apply(console, arguments); } catch(e) {}
  }

  function ensureStyle() {
    if (qs("#slJumpUiStyle")) return;
    var css = `
/* --- ScreenLit: Discover Jump UI --- */
.slFooterNav{
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
}

#slJumpBtn{
  justify-self: center;
  font-size: 20px;
  line-height: 1;
  text-decoration: none;
  user-select: none;
  color: #d6d6d6;     /* disabled: very light gray */
  cursor: default;
}

#slJumpBtn.enabled{
  color: #666;        /* enabled: dark gray (not black) */
  cursor: pointer;
}

#slJumpBtn.enabled:hover{
  color: #444;
}
`;
    var st = document.createElement("style");
    st.id = "slJumpUiStyle";
    st.textContent = css;
    document.head.appendChild(st);
  }

  // Find the footer element that contains Home and Mode links.
  // This avoids brittle HTML patching.
  function findFooterContainer() {
    var home = qsa("a").find(a => (a.textContent || "").trim() === "Home");
    var mode = qsa("a").find(a => (a.textContent || "").trim() === "Mode");
    if (!home || !mode) return null;

    // Prefer a shared parent (most likely your footer row)
    if (home.parentElement && home.parentElement === mode.parentElement) return home.parentElement;

    // Fallback: nearest common ancestor
    var p = home.parentElement;
    while (p) {
      if (p.contains(mode)) return p;
      p = p.parentElement;
    }
    return null;
  }

  function ensureButton(footerEl) {
    ensureStyle();
    footerEl.classList.add("slFooterNav");

    var btn = qs("#slJumpBtn");
    if (!btn) {
      btn = document.createElement("a");
      btn.id = "slJumpBtn";
      btn.href = "#";
      btn.setAttribute("aria-label", "Jump");
      btn.title = "Jump";
      btn.textContent = "↯";
    }

    // Ensure it's between Home and Mode (insert before Mode if possible)
    var mode = qsa("a", footerEl).find(a => (a.textContent || "").trim() === "Mode");
    if (mode) {
      // If already in footer, just ensure ordering
      if (btn.parentElement !== footerEl) footerEl.insertBefore(btn, mode);
      else {
        // move it right before mode if needed
        if (btn.nextSibling !== mode) footerEl.insertBefore(btn, mode);
      }
    } else {
      // fallback: append
      if (btn.parentElement !== footerEl) footerEl.appendChild(btn);
    }

    // Click = press W (same wormhole behavior)
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      if (!btn.classList.contains("enabled")) return;

      // Trigger the same handler as the W key
      try {
        var ev = new KeyboardEvent("keydown", { key: "w", code: "KeyW", bubbles: true });
        document.dispatchEvent(ev);
        window.dispatchEvent(ev);
      } catch (err) {
        // ultra-fallback: try uppercase
        try {
          var ev2 = new KeyboardEvent("keydown", { key: "W", code: "KeyW", bubbles: true });
          document.dispatchEvent(ev2);
          window.dispatchEvent(ev2);
        } catch(e2){}
      }
    }, true);

    return btn;
  }

  function findCenterTile() {
    // Heuristic: Discover shows 3 tiles (blank, center, right) — take the middle.
    var grid = qs("#grid");
    if (grid) {
      var tiles = qsa(".tile, .card", grid);
      if (tiles.length) return tiles[Math.floor(tiles.length / 2)];
      // fallback: any direct children
      if (grid.children && grid.children.length) return grid.children[Math.floor(grid.children.length / 2)];
    }
    var tiles2 = qsa(".tile, .card");
    if (tiles2.length) return tiles2[Math.floor(tiles2.length / 2)];
    return null;
  }

  function getCurIdFromDOM() {
    var center = findCenterTile();
    if (!center) return null;

    // 1) If some renderer already provides data-id, use it.
    var did = center.getAttribute("data-id") || (center.dataset && center.dataset.id);
    if (did) return did;

    var child = qs("[data-id]", center);
    if (child) {
      var cd = child.getAttribute("data-id") || (child.dataset && child.dataset.id);
      if (cd) return cd;
    }

    // 2) Otherwise: infer from title + meta line (like wormhole does)
    var titleEl = qs(".title, .slTitle, h2, h3", center);
    var metaEl  = qs(".meta, .slMeta, small", center);

    var title = titleEl ? (titleEl.textContent || "").trim() : null;
    var meta  = metaEl  ? (metaEl.textContent  || "").trim() : null;

    if (!title || !meta) return null;
    if (!window.SL_CATALOG || !Array.isArray(window.SL_CATALOG)) return null;

    // meta looks like: "Film · 2003"
    var type = null, year = null;
    var parts = meta.split("·");
    if (parts.length >= 2) {
      type = parts[0].trim();
      year = parseInt(parts[1], 10);
    } else {
      parts = meta.split("-");
      if (parts.length >= 2) {
        type = parts[0].trim();
        year = parseInt(parts[1], 10);
      }
    }
    if (!type || !year) return null;

    for (var i = 0; i < window.SL_CATALOG.length; i++) {
      var it = window.SL_CATALOG[i];
      if (!it) continue;
      if (it.title === title && it.type === type && String(it.year) === String(year)) {
        return it.id;
      }
    }
    return null;
  }

  function hasNeighbors(curId) {
    if (!curId) return false;
    if (!window.SL_Graph || typeof window.SL_Graph.getNeighbors !== "function") return false;
    try {
      var n = window.SL_Graph.getNeighbors(curId);
      return Array.isArray(n) && n.length > 0;
    } catch (e) {
      return false;
    }
  }

  function update(btn) {
    var curId = getCurIdFromDOM();
    var enabled = hasNeighbors(curId);

    btn.classList.toggle("enabled", enabled);
    btn.classList.toggle("disabled", !enabled);
    btn.setAttribute("aria-disabled", enabled ? "false" : "true");

    // Keep UI minimal: tooltip only.
    // (If you later want “No jump” on disabled, we can do that.)
    btn.title = "Jump";

    if (DEBUG) dlog("[jumpui]", { curId: curId, enabled: enabled });
  }

  function boot() {
    var footer = findFooterContainer();
    if (!footer) {
      dlog("[jumpui] no footer container found (Home/Mode not found)");
      return;
    }

    var btn = ensureButton(footer);

    // initial + delayed (after render)
    update(btn);
    setTimeout(function(){ update(btn); }, 150);

    // Update after interactions that might swap center title
    document.addEventListener("click", function(){ setTimeout(function(){ update(btn); }, 0); }, true);
    document.addEventListener("keydown", function(){ setTimeout(function(){ update(btn); }, 0); }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
