// wormhole_ui.js
// Places a centered portal glyph (↯) inside the Discover nav row:
// Home (left) | ↯ (center) | Mode (right)
//
// Hover shows label: "Jump" (opacity-only, no layout shift).
// Click ↯ = same as pressing W (wormhole jump).
// If no jump happens, refreshes Discover so it never feels dead.

(function () {
  function debugOn() {
    try { return new URLSearchParams(location.search).get('wormdebug') === '1'; }
    catch (_) { return false; }
  }

  function fireW() {
    try {
      var ev = new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true });
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
    var nav = document.querySelector('.nav');
    var wrap = document.getElementById('portalWrap');
    var portal = document.getElementById('portal');
    var label = document.getElementById('portalLabel');

    if (nav) {
      nav.classList.add('navHasPortal');

      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'portalWrap';
        wrap.className = 'portalWrapNav';
        nav.appendChild(wrap);
      } else if (wrap.parentNode !== nav) {
        nav.appendChild(wrap);
      }

      if (!portal) {
        portal = document.createElement('span');
        portal.id = 'portal';
        portal.className = 'portal';
        portal.textContent = '↯';
        portal.setAttribute('role', 'button');
        portal.setAttribute('aria-label', 'Jump');
        wrap.appendChild(portal);
      } else if (portal.parentNode !== wrap) {
        wrap.appendChild(portal);
      }

      if (!label) {
        label = document.createElement('span');
        label.id = 'portalLabel';
        label.className = 'portalLabel';
        label.textContent = 'Jump';
        label.setAttribute('aria-hidden', 'true');
        wrap.appendChild(label);
      } else if (label.parentNode !== wrap) {
        wrap.appendChild(label);
      }
    } else {
      // Fallback: fixed bottom center if nav not found
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'portalWrap';
        wrap.className = 'portalWrapFixed';
        document.body.appendChild(wrap);
      }
      if (!portal) {
        portal = document.createElement('span');
        portal.id = 'portal';
        portal.className = 'portal';
        portal.textContent = '↯';
        portal.setAttribute('role', 'button');
        portal.setAttribute('aria-label', 'Jump');
        wrap.appendChild(portal);
      } else if (portal.parentNode !== wrap) {
        wrap.appendChild(portal);
      }
      if (!label) {
        label = document.createElement('span');
        label.id = 'portalLabel';
        label.className = 'portalLabel';
        label.textContent = 'Jump';
        label.setAttribute('aria-hidden', 'true');
        wrap.appendChild(label);
      } else if (label.parentNode !== wrap) {
        wrap.appendChild(label);
      }
    }

    if (portal.__slBound) return;
    portal.__slBound = true;

    portal.addEventListener('click', function (e) {
      e.preventDefault();

      if (debugOn()) console.info('[portal] click -> W');

      var before = location.href;

      // Opacity-only pulse
      portal.classList.remove('pulse');
      void portal.offsetWidth;
      portal.classList.add('pulse');

      fireW();

      setTimeout(function () {
        if (location.href === before) {
          if (debugOn()) console.info('[portal] no jump detected -> refresh');
          refreshTS();
        }
      }, 250);
    }, true);

    if (debugOn()) console.info('[portal] installed (hover shows Jump; click ↯ or press W)');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensurePortal);
  } else {
    ensurePortal();
  }
})();
