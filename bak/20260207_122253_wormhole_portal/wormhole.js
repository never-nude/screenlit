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

  window.addEventListener('keydown', function(e){
    if(e.defaultPrevented) return;
    if(e.metaKey || e.ctrlKey || e.altKey) return;
    if(e.key === 'w' || e.key === 'W'){
      e.preventDefault();
      wormhole();
    }
  }, true);

  if(debugOn()) console.info('[wormhole] installed (press W)');
})();
