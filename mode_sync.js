/* mode_sync.js — keeps SL_Storage mode aligned with localStorage mode
   Also renames the Mode link to show the CURRENT mode: Guest / Profile.
*/
(function () {
  function safeGetLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSetLS(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var m = safeGetLS("SL_SESSION_MODE");
  if (m !== "saved" && m !== "guest") {
    m = "guest";
    safeSetLS("SL_SESSION_MODE", "guest");
  }

  // Map: guest -> storage guest, saved -> storage local
  try {
    if (window.SL_Storage && typeof SL_Storage.setSessionMode === "function") {
      SL_Storage.setSessionMode(m === "saved" ? "local" : "guest");
    }
  } catch (e) {}

  function updateLink() {
    var el = document.getElementById("slMode") || document.querySelector('a[href^="entry.html"]');
    if (!el) return;
    el.textContent = (m === "saved") ? "Profile" : "Guest";
    el.title = "Mode";
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", updateLink);
  else updateLink();
})();
