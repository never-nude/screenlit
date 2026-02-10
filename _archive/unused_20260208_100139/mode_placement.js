// ScreenLit: separate Mode control from nav links (Index/Discover)
// No behavior changes. Layout only.

(function () {
  function findModeEl() {
    return (
      document.getElementById("modeLink") ||
      document.getElementById("modeBtn") ||
      document.getElementById("modeButton") ||
      document.querySelector("[data-sl-mode]")
    );
  }

  function isNavWord(el, word) {
    try {
      return (el.textContent || "").trim().toLowerCase() === word;
    } catch (e) {
      return false;
    }
  }

  function findNavContainer(modeEl) {
    var node = modeEl;
    for (var depth = 0; depth < 6 && node; depth++) {
      var parent = node.parentElement;
      if (!parent) break;

      // Look for a sibling-ish nav partner ("Discover" or "Home") in this container.
      var links = parent.querySelectorAll("a,button");
      var hasHomeOrDiscover = false;
      for (var i = 0; i < links.length; i++) {
        if (isNavWord(links[i], "discover") || isNavWord(links[i], "home")) {
          hasHomeOrDiscover = true;
          break;
        }
      }
      if (hasHomeOrDiscover && links.length >= 2) return parent;

      node = parent;
    }
    return null;
  }

  function apply() {
    var modeEl = findModeEl();
    if (!modeEl) return false;

    // If Mode has no id, mark it so CSS/JS can find it later.
    if (!modeEl.getAttribute("data-sl-mode")) modeEl.setAttribute("data-sl-mode", "1");

    var nav = findNavContainer(modeEl);
    if (!nav) return false;

    nav.style.display = "flex";
    nav.style.alignItems = "center";
    nav.style.justifyContent = "space-between";
    nav.style.width = "100%";

    // Push Mode to the far right within the row.
    modeEl.style.marginLeft = "auto";
    return true;
  }

  // Try immediately, then retry briefly (in case Mode is injected after load).
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var ok = apply();
    if (ok || tries >= 30) clearInterval(timer);
  }, 100);
})();

