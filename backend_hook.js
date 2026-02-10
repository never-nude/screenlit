// backend_hook.js
// Phase E: "saved profile" uses an anonymous profile_id stored in localStorage.
// Guest mode remains purely local (does not touch backend).
(function () {
  var API_BASE = localStorage.getItem("SL_API_BASE") || "http://127.0.0.1:8148";
  var DEBUG = new URLSearchParams(location.search).get("apidebug") === "1";

  function log() { if (DEBUG) try { console.log.apply(console, arguments); } catch (e) {} }

  function isSavedMode() {
    return localStorage.getItem("SL_SESSION_MODE") === "saved";
  }
  function getProfileId() {
    return localStorage.getItem("SL_PROFILE_ID");
  }
  function setProfileId(pid) {
    localStorage.setItem("SL_PROFILE_ID", pid);
  }

  async function createProfile() {
    try {
      var r = await fetch(API_BASE + "/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      var j = await r.json();
      if (j && j.ok && j.profile_id) return j.profile_id;
    } catch (e) {}
    // fallback: local-only UUID-ish
    return "local_" + Math.random().toString(16).slice(2) + "_" + Date.now();
  }

  async function ensureProfileId() {
    var pid = getProfileId();
    if (pid) return pid;
    pid = await createProfile();
    setProfileId(pid);
    return pid;
  }

  async function postRating(titleId) {
    if (!isSavedMode()) return;
    if (!window.SL_Storage || typeof window.SL_Storage.getRating !== "function") return;

    var pid = await ensureProfileId();

    var rating = null;
    var disposition = null;

    try { rating = window.SL_Storage.getRating(titleId); } catch (e) {}
    try { disposition = window.SL_Storage.getDisposition(titleId); } catch (e) {}

    // We only send if something is set (rating or disposition)
    if (rating == null && (disposition == null || disposition === "")) return;

    var payload = {
      profile_id: pid,
      title_id: titleId,
      rating: rating,
      disposition: disposition
    };

    try {
      log("[api] POST /api/rate", payload);
      await fetch(API_BASE + "/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      log("[api] rate failed", e);
    }
  }

  function wrapStorage() {
    if (!window.SL_Storage) return;

    // Wrap setRating
    if (typeof window.SL_Storage.setRating === "function" && !window.SL_Storage.__apiWrappedSetRating) {
      var origSetRating = window.SL_Storage.setRating.bind(window.SL_Storage);
      window.SL_Storage.setRating = function (id, rating) {
        var out = origSetRating(id, rating);
        postRating(id);
        return out;
      };
      window.SL_Storage.__apiWrappedSetRating = true;
    }

    // Wrap setDisposition
    if (typeof window.SL_Storage.setDisposition === "function" && !window.SL_Storage.__apiWrappedSetDisposition) {
      var origSetDisp = window.SL_Storage.setDisposition.bind(window.SL_Storage);
      window.SL_Storage.setDisposition = function (id, disp) {
        var out = origSetDisp(id, disp);
        postRating(id);
        return out;
      };
      window.SL_Storage.__apiWrappedSetDisposition = true;
    }
  }

  function isEntryPage() {
    return /entry\.html$/i.test(location.pathname) || location.pathname === "/" || /\/$/.test(location.pathname);
  }

  function bindEntryButtons() {
    // Find buttons by visible text (robust against markup changes)
    var btns = Array.from(document.querySelectorAll("button, a"));
    var guestBtn = null, savedBtn = null;

    btns.forEach(function (b) {
      var t = (b.textContent || "").trim().toLowerCase();
      if (!guestBtn && t.includes("guest")) guestBtn = b;
      if (!savedBtn && (t.includes("saved") || t.includes("profile"))) savedBtn = b;
    });

    if (!guestBtn || !savedBtn) {
      log("[entry] could not bind buttons", { guestBtn: !!guestBtn, savedBtn: !!savedBtn });
      return;
    }

    guestBtn.addEventListener("click", function (e) {
      e.preventDefault();
      localStorage.setItem("SL_SESSION_MODE", "guest");
      localStorage.removeItem("SL_PROFILE_ID");
      location.href = "index.html";
    });

    savedBtn.addEventListener("click", async function (e) {
      e.preventDefault();
      localStorage.setItem("SL_SESSION_MODE", "saved");
      await ensureProfileId();
      location.href = "index.html";
    });

    log("[entry] bound guest + saved buttons");
  }

  function boot() {
    wrapStorage();
    if (isEntryPage()) bindEntryButtons();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
