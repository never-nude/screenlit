/* globals.js — ScreenLit safety + flags
   Purpose: optional experiments must never crash core pages.
*/
(function(){
  window.SL = window.SL || {};
  window.SL_SYMBOLS = window.SL_SYMBOLS || {};
  window.SL_SYMBOLS.jump = "⌁"; // reserved for future on-screen jump control

  // Feature flags (safe defaults)
  window.SL_FLAGS = window.SL_FLAGS || {};
  

  // SL_FLAG_OVERRIDES_V1 (URL tuning without code edits)
  // ?bridge=0.25&cross=0.70&curve=0.12
  try {
    var sp = new URLSearchParams(location.search);

    function clamp01(x){
      x = parseFloat(x);
      if (isNaN(x)) return null;
      if (x < 0) x = 0;
      if (x > 1) x = 1;
      return x;
    }

    var b = clamp01(sp.get("bridge"));
    var c = clamp01(sp.get("cross"));
    var u = clamp01(sp.get("curve"));

    if (b !== null) window.SL_FLAGS.bridgeProb = b;
    if (c !== null) window.SL_FLAGS.crossBias  = c;
    if (u !== null) window.SL_FLAGS.curveballProb = u;
  } catch (e) {}

// Auto-bridge: probability of picking from graph neighbors when selecting next title.
  window.SL_FLAGS.bridgeProb = (typeof window.SL_FLAGS.bridgeProb === "number") ? window.SL_FLAGS.bridgeProb : 0.25;
  // Prefer cross-media neighbors (Book/Film/TV mismatch) with this probability.
  window.SL_FLAGS.crossBias  = (typeof window.SL_FLAGS.crossBias  === "number") ? window.SL_FLAGS.crossBias  : 0.70;
  // Curveball: when choosing among neighbors, chance to prefer lower inferred neighbor.
  window.SL_FLAGS.curveballProb = (typeof window.SL_FLAGS.curveballProb === "number") ? window.SL_FLAGS.curveballProb : 0.12;

  // Never allow missing optional globals to crash
  window.SL_GRAPH_MAGIC = window.SL_GRAPH_MAGIC || {};
})();
