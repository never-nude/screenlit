// wormhole_ui.js
// Adds a minimal portal glyph (⟷) near "Mode" on Discover.
// Click ⟷ = same as pressing W (wormhole jump).
// If no jump happens, it refreshes Discover (so it never feels dead).

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
    } catch (_) {
      // If KeyboardEvent is blocked, do nothing; wormhole still works via keyboard.
    }
  }

  function bumpTSRefresh() {
    try {
      var sp = new URLSearchParams(location.search);
      sp.set('ts', String(Date.now()));
      location.search = '?' + sp.toString();
    } catch (_) {
      location.href = 'discover.html?ts=' + Date.now();
    }
  }

  function ensurePortal() {
    // Try to place it right before the "Mode" control (whatever element contains that text).
    var modeEl = null;
    var candidates = document.querySelectorAll('a, span, div, button');
    for (var i = 0; i < candidates.length; i++) {
      var t = (candidates[i].textContent || '').trim();
      if (t === 'Mode') { modeEl = candidates[i]; break; }
    }

    var portal = document.getElementById('portal');
    if (!portal) {
      portal = document.createElement('span');
      portal.id = 'portal';
      portal.className = 'portal';
      portal.textContent = '⟷';

      if (modeEl && modeEl.parentNode) {
        modeEl.parentNode.insertBefore(portal, modeEl);
      } else {
        // Fallback: fixed position, bottom-right.
        portal.classList.add('portalFixed');
        document.body.appendChild(portal);
      }
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

      // If no navigation happened, refresh Discover so the click never feels dead.
      setTimeout(function () {
        if (location.href === before) {
          if (debugOn()) console.info('[portal] no jump detected -> refresh');
          bumpTSRefresh();
        }
      }, 250);
    }, true);

    if (debugOn()) console.info('[portal] installed (click ⟷ or press W)');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensurePortal);
  } else {
    ensurePortal();
  }
})();
