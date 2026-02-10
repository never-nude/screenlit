(function(){
  // Wormhole: press W to jump the CENTER tile to a cross-media neighbor (if any).
  // Uses SL_Graph.getNeighbors(id), then reloads Discover with ?focus=<id>.

  function param(name){
    try { return new URLSearchParams(location.search).get(name); } catch(e){ return null; }
  }
  function debugOn(){ return param('wormdebug') === '1'; }


  // WORMHOLE_FALLBACK v1
  // If no graph neighbor exists, jump to a different-medium title chosen by inference.
  function byIdMap(){
    var m = {};
    var c = window.SL_CATALOG || [];
    for(var i=0;i<c.length;i++) m[c[i].id]=c[i];
    return m;
  }

  function infer(it){
    try {
      if(window.SL_Storage && window.SL_Storage.inferForTitle) {
        return window.SL_Storage.inferForTitle(it, window.SL_CATALOG || []);
      }
    } catch(e){}
    return 3.0;
  }

  function fallbackTarget(curId){
    var byId = byIdMap();
    var cur = byId[curId];
    if(!cur || !cur.type) return null;

    var candidates = [];
    var c = window.SL_CATALOG || [];
    for(var i=0;i<c.length;i++){
      var it = c[i];
      if(!it || !it.id) continue;
      if(it.type === cur.type) continue;
      candidates.push(it);
    }
    if(!candidates.length) return null;

    // pick the best of N random samples by inferred score (fun mode)
    var best = null;
    var bestScore = -1;
    var samples = Math.min(18, candidates.length);
    for(var k=0;k<samples;k++){
      var it2 = candidates[Math.floor(Math.random()*candidates.length)];
      var sc = infer(it2);
      if(typeof sc !== "number" || isNaN(sc)) sc = 3.0;
      if(sc > bestScore){
        bestScore = sc;
        best = it2;
      }
    }
    return best ? best.id : null;
  }
  function centerTile(){
    return document.querySelector('.slot.center .tile');
  }

  function parseTypeYear(metaText){
    // meta may look like: "Film · 2008" or "Film · 2008  ⋄ 12"
    var txt = (metaText || '').trim();
    // strip anything after the diamond count
    txt = txt.split('⋄')[0].trim();
    var m = txt.match(/^\s*([A-Za-z]+)\s*·\s*(\d{4})\s*$/);
    if(!m) return { type:null, year:null };
    return { type:m[1], year:parseInt(m[2],10) };
  }

  function centerSignature(){
    var tile = centerTile();
    if(!tile) return null;

    // Your Discover uses tileTitle/tileMeta
    var titleEl = tile.querySelector('.tileTitle');
    var metaEl  = tile.querySelector('.tileMeta');

    var title = titleEl ? (titleEl.textContent || '').trim() : '';
    var meta  = metaEl  ? (metaEl.textContent  || '').trim() : '';

    if(!title) return null;

    var tm = parseTypeYear(meta);
    return { title:title, type:tm.type, year:tm.year };
  }

  function findId(sig){
    if(!sig) return null;
    var c = window.SL_CATALOG || [];
    // strict: title + type + year
    if(sig.type && sig.year){
      for(var i=0;i<c.length;i++){
        var it=c[i];
        if(it.title===sig.title && it.type===sig.type && Number(it.year)===Number(sig.year)){
          return it.id;
        }
      }
    }
    // fallback: title-only if unique
    var hit=null;
    for(var j=0;j<c.length;j++){
      if(c[j].title===sig.title){
        if(hit) return null; // ambiguous
        hit=c[j].id;
      }
    }
    return hit;
  }

  function byIdMap(){
    var m = {};
    var c = window.SL_CATALOG || [];
    for(var i=0;i<c.length;i++) m[c[i].id]=c[i];
    return m;
  }

  function pickNeighbor(curId, neighbors){
    if(!neighbors || !neighbors.length) return null;
    var byId = byIdMap();
    var cur = byId[curId];
    // prefer different media type
    if(cur && cur.type){
      for(var i=0;i<neighbors.length;i++){
        var nid = (typeof neighbors[i]==="string") ? neighbors[i] : (neighbors[i] && neighbors[i].id);
        var it = byId[nid];
        if(it && it.type && it.type !== cur.type) return nid;
      }
    }
    // fallback: first neighbor
    var first = neighbors[0];
    return (typeof first==="string") ? first : (first && first.id) || null;
  }

  function wormhole(){
    var sig = centerSignature();
    var curId = findId(sig);

    if(debugOn()) console.info('[wormhole] sig=', sig, 'curId=', curId);

    if(!curId) {
      if(debugOn()) console.warn('[wormhole] missing curId (tile signature mismatch)');
      return;
    }
    if(!window.SL_Graph || typeof window.SL_Graph.getNeighbors !== "function"){
      if(debugOn()) console.warn('[wormhole] missing SL_Graph.getNeighbors (open with graphseed=1)');
      return;
    }

    var neigh = window.SL_Graph.getNeighbors(curId) || [];
    var target = pickNeighbor(curId, neigh);

    if(debugOn()) console.info('[wormhole] neighbors=', neigh, 'target=', target);

    if(!target){ target = fallbackTarget(curId); if(debugOn()) console.info('[wormhole] fallback target=', target); }
    if(!target) return;

    var url = new URL(location.href);
    url.searchParams.set('graphseed','1');
    url.searchParams.set('focus', target);
    url.searchParams.set('ts', String(Date.now()));
    location.href = url.toString();
  }

  
  // --- Jump button (↯) UI hook + state ---
  function updateJumpButton(){
    var el = document.getElementById('slJump');
    if(!el) return;

    // If graph isn't available, Jump is disabled (for now).
    if(!window.SL_Graph || typeof window.SL_Graph.getNeighbors !== "function"){
      el.disabled = true;
      el.title = 'Jump (unavailable)';
      return;
    }

    var sig = centerSignature();
    var curId = findId(sig);
    if(!curId){
      el.disabled = true;
      el.title = 'Jump (unavailable)';
      return;
    }

    var neigh = window.SL_Graph.getNeighbors(curId) || [];
    var target = pickNeighbor(curId, neigh);

    el.disabled = !target;
    el.title = target ? 'Jump' : 'No jump available';
  }

  function hookJumpButton(){
    var el = document.getElementById('slJump');
    if(!el) return;
    el.addEventListener('click', function(e){
      e.preventDefault();
      if(el.disabled) return;
      wormhole();
    }, true);
  }

  // Tiny “arrival” feedback: if focus=... exists, flash the Jump control once.
  function flashJump(){
    var el = document.getElementById('slJump');
    if(!el) return;
    el.classList.remove('slJumpFlash');
    void el.offsetWidth; // reflow to restart animation
    el.classList.add('slJumpFlash');
    setTimeout(function(){ el.classList.remove('slJumpFlash'); }, 420);
  }

  hookJumpButton();

  // Initial state (after Discover paints)
  setTimeout(updateJumpButton, 80);

  // Update after any click (ratings advance tiles)
  document.addEventListener('click', function(){
    setTimeout(updateJumpButton, 50);
  }, true);

  // Flash on arrival when we’ve just jumped (focus param present)
  try{
    var sp = new URLSearchParams(location.search);
    if(sp.get('focus')) setTimeout(flashJump, 120);
  }catch(e){}

window.addEventListener('keydown', function(e){
    if(e.defaultPrevented) return;
    if(e.metaKey || e.ctrlKey || e.altKey) return;
    if(e.key === 'w' || e.key === 'W'){
      e.preventDefault();
      wormhole();
    }
  }, true);

  if(debugOn()) console.info('[wormhole] installed (press W or click ↯)');

  // --- Bind on-page ↯ control (clickable + tooltip-only label) ---
  function bindJumpUI(){
    var el =
      document.querySelector('[data-sl-jump="1"], #sl_jump, #jump, #jumpLink, #wormhole, #wormholeLink');

    // Fallback: first simple element whose text looks like our glyph
    if(!el){
      var nodes = document.querySelectorAll('a,button,span');
      for(var i=0;i<nodes.length;i++){
        var t = (nodes[i].textContent || '').trim();
        if(t === '↯' || t === '↯Jump' || t === '↯ Jump'){
          el = nodes[i];
          break;
        }
      }
    }
    if(!el) return;

    // Enforce: glyph only; word shows only on hover (native tooltip)
    el.textContent = '↯';
    el.title = 'Jump';
    el.setAttribute('aria-label','Jump');
    el.style.cursor = 'pointer';

    // Bind once
    if(el.getAttribute('data-sl-jump-bound') === '1') return;
    el.setAttribute('data-sl-jump-bound','1');

    el.addEventListener('click', function(ev){
      ev.preventDefault();
      wormhole();
    }, false);

    if(debugOn()) console.info('[wormhole] bound ↯ UI control');
  }

  // Run after load (safe even if DOM is already ready)
  try { bindJumpUI(); } catch(e){}

})();
