// ScreenLit UI tweaks (runtime, minimal)
// - Gate labels: "Continue as guest" / "Continue with saved profile"
// - Mode placement: push Mode away from Home/Discover by flex + margin-left:auto

(function () {
  function norm(s) {
    return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function textIsMode(t) {
    return t === "mode" || t.indexOf("mode:") === 0 || t.indexOf("mode ") === 0;
  }

  function adjustGateLabels() {
    // Find the guest button/link by text containing "guest"
    var els = document.querySelectorAll("button, a");
    var guest = null;

    for (var i = 0; i < els.length; i++) {
      var t = norm(els[i].textContent);
      if (t && t.indexOf("guest") !== -1) {
        guest = els[i];
        break;
      }
    }
    if (!guest) return false;

    // Climb to find a small container that holds the two primary actions.
    var node = guest;
    for (var d = 0; d < 8 && node; d++) {
      var p = node.parentElement;
      if (!p) break;

      var controls = p.querySelectorAll("button, a");
      var actions = [];
      for (var j = 0; j < controls.length; j++) {
        var tx = norm(controls[j].textContent);
        if (!tx) continue;
        if (tx === "×" || tx === "x") continue;
        actions.push(controls[j]);
      }

      var hasGuest = false;
      for (var k = 0; k < actions.length; k++) {
        if (actions[k] === guest) { hasGuest = true; break; }
      }

      if (hasGuest && actions.length >= 2 && actions.length <= 4) {
        guest.textContent = "Continue as guest";

        // Pick the other primary action (first non-guest).
        var other = null;
        for (var m = 0; m < actions.length; m++) {
          if (actions[m] !== guest) { other = actions[m]; break; }
        }
        if (other) other.textContent = "Continue with saved profile";
        return true;
      }

      node = p;
    }

    // Fallback: at least normalize guest label
    guest.textContent = "Continue as guest";
    return true;
  }

  function findModeControl() {
    // Prefer IDs if they exist
    var byId =
      document.getElementById("modeLink") ||
      document.getElementById("modeBtn") ||
      document.getElementById("modeButton");
    if (byId) return byId;

    // Fallback: find by text
    var els = document.querySelectorAll("button, a");
    for (var i = 0; i < els.length; i++) {
      var t = norm(els[i].textContent);
      if (!t) continue;
      if (textIsMode(t)) return els[i];
    }
    return null;
  }

  function containerLooksLikeNav(p) {
    if (!p) return false;
    var els = p.querySelectorAll("button, a");
    if (els.length < 2 || els.length > 8) return false;

    var hasMode = false;
    var hasHomeOrDiscover = false;
    for (var i = 0; i < els.length; i++) {
      var t = norm(els[i].textContent);
      if (textIsMode(t)) hasMode = true;
      if (t === "home" || t === "discover") hasHomeOrDiscover = true;
    }
    return hasMode && hasHomeOrDiscover;
  }

  function adjustModePlacement() {
    var mode = findModeControl();
    if (!mode) return false;

    // Climb to find the nav row container (small cluster with Home/Discover + Mode)
    var node = mode;
    var nav = null;
    for (var d = 0; d < 10 && node; d++) {
      var p = node.parentElement;
      if (!p) break;
      if (containerLooksLikeNav(p)) { nav = p; break; }
      node = p;
    }
    if (!nav) return false;

    // Make mode a direct child so margin-left:auto works reliably
    if (mode.parentElement !== nav) {
      nav.appendChild(mode);
    }

    nav.style.display = "flex";
    nav.style.alignItems = "center";
    nav.style.width = "100%";

    mode.style.marginLeft = "auto";
    return true;
  }

  function apply() {
    adjustGateLabels();
    adjustModePlacement();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }

  // Retry briefly in case elements are created after load.
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var ok1 = adjustGateLabels();
    var ok2 = adjustModePlacement();
    if ((ok1 && ok2) || tries >= 40) clearInterval(timer);
  }, 100);
})();
