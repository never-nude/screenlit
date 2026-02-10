// wormhole_ui.js
// Adds a minimal centered portal glyph (↯) on Discover.
// Click ↯ = same as pressing W (wormhole jump).
// If no jump happens, refreshes Discover so it never feels dead.

(function () {
  function debugOn() {
    try { return new URLSearchParams(location.search).get('wormdebug') === '1'; }
    catch (_) { return false; }
  }

  function fireW() {
    try {
      var ev = new KeyboardEvent('keydown', {
        key: 'w',
        code: 'KeyW',
        keyCode: 87,
        which: 87,
        bubbles: true
      });
      document.dispatchEvent(ev);
      window.dispatchEvent(ev);
    } catch (_) {}
  }

  function refreshTS() {
    try {
      var sp = new URLSearchParams(location.search);
      sp.set('ts', String(Date.now()));
      location.search = '?' + sp.toString();
    } catch (_) {
      location.href = 'discover.html?ts=' + Date.now();
    }
  }

  function ensurePortal() {
    // Create a fixed bottom-center wrapper (no transform positioning).
    var wrap = document.getElementById('portalWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'portalWrap';
      wrap.className = 'portalWrapFixed';
      document.body.appendChild(wrap);
    }

    var portal = document.getElementById('portal');
    if (!portal) {
      portal = document.createElement('span');
      portal.id = 'portal';
      portal.className = 'portal';
      portal.textContent = '↯';
      wrap.appendChild(portal);
    } else if (portal.parentNode !== wrap) {
      wrap.appendChild(portal);
    }

    portal.addEventListener('click', function (e) {
      e.preventDefault();

      if (debugOn()) console.info('[portal] click -> W');

      var before = location.href;

      // Feedback pulse (even if wormhole can’t jump)
      portal.classList.remove('pulse');
      void portal.offsetWidth; // reflow to restart animation
      portal.classList.add('pulse');

      fireW();

      // If no navigation happened, refresh so click never feels dead.
      setTimeout(function () {
        if (location.href === before) {
          if (debugOn()) console.info('[portal] no jump detected -> refresh');
          refreshTS();
        }
      }, 250);
    }, true);

    if (debugOn()) console.info('[portal] installed (click ↯ or press W)');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensurePortal);
  } else {
    ensurePortal();
  }
})();
