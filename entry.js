/* entry.js — Mode selector (Guest vs Saved Profile)
   - Guest: SL_Storage session mode = guest, backend mode = guest
   - Saved: SL_Storage session mode = local, backend mode = saved + profile_id
*/
(function () {
  function qs(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  }

  function safeGetLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSetLS(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function safeDelLS(k) { try { localStorage.removeItem(k); } catch (e) {} }

  var API_BASE = safeGetLS("SL_API_BASE") || "http://127.0.0.1:8148";

  function returnTarget() {
    var r = (qs("return") || "").trim();
    if (!r) return "index.html";
    // allow only local html targets
    if (r.indexOf("discover") === 0) return "discover.html";
    if (r.indexOf("index") === 0) return "index.html";
    return "index.html";
  }

  function setStorageModeGuest() {
    try {
      if (window.SL_Storage && typeof SL_Storage.setSessionMode === "function") SL_Storage.setSessionMode("guest");
      if (window.SL_Storage && typeof SL_Storage.clearGuestSession === "function") SL_Storage.clearGuestSession();
    } catch (e) {}
  }

  function setStorageModeLocal() {
    try {
      if (window.SL_Storage && typeof SL_Storage.setSessionMode === "function") SL_Storage.setSessionMode("local");
    } catch (e) {}
  }

  async function createProfileId() {
    try {
      var r = await fetch(API_BASE + "/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      var j = await r.json();
      if (j && j.ok && j.profile_id) return j.profile_id;
    } catch (e) {}
    return "local_" + Math.random().toString(16).slice(2) + "_" + Date.now();
  }

  async function ensureProfileId() {
    var pid = safeGetLS("SL_PROFILE_ID");
    if (pid) return pid;
    pid = await createProfileId();
    safeSetLS("SL_PROFILE_ID", pid);
    return pid;
  }

  function renderStatus() {
    var mode = safeGetLS("SL_SESSION_MODE");
    var label = (mode === "saved") ? "Profile" : "Guest";
    var pid = safeGetLS("SL_PROFILE_ID");
    var el = document.getElementById("slModeStatus");
    if (!el) return;
    el.innerHTML = 'Current: <span class="slMono">' + label + '</span>' +
      (pid ? (' • <span class="slMono">' + pid + '</span>') : '') +
      ' • API: <span class="slMono">' + API_BASE + '</span>';
  }

  document.getElementById("slGuestBtn").addEventListener("click", function (e) {
    e.preventDefault();
    safeSetLS("SL_SESSION_MODE", "guest");
    safeDelLS("SL_PROFILE_ID");
    setStorageModeGuest();
    location.href = returnTarget();
  });

  document.getElementById("slSavedBtn").addEventListener("click", async function (e) {
    e.preventDefault();
    safeSetLS("SL_SESSION_MODE", "saved");
    setStorageModeLocal();
    await ensureProfileId();
    location.href = returnTarget();
  });

  // Default (first time): guest
  if (safeGetLS("SL_SESSION_MODE") !== "saved" && safeGetLS("SL_SESSION_MODE") !== "guest") {
    safeSetLS("SL_SESSION_MODE", "guest");
    setStorageModeGuest();
  }

  renderStatus();
})();
