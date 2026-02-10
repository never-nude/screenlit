(function(){
  // ScreenLit Discover keyboard shortcuts
  // 1-5 = rate, - = no, 0/space = don't know, +/= = add, h = home

  function activeCenterTile(){
    return document.querySelector('.slot.center .tile');
  }

  function clickStar(n){
    var tile = activeCenterTile();
    if(!tile) return false;
    var btns = tile.querySelectorAll('.starBtn');
    if(btns && btns[n-1]) { btns[n-1].click(); return true; }
    return false;
  }

  function clickTriad(index){
    var tile = activeCenterTile();
    if(!tile) return false;
    var icons = tile.querySelectorAll('.triad .icon');
    if(icons && icons[index]) { icons[index].click(); return true; }
    return false;
  }

  function isTypingTarget(t){
    if(!t) return false;
    var tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable;
  }

  window.addEventListener('keydown', function(e){
    if(e.defaultPrevented) return;
    if(e.metaKey || e.ctrlKey || e.altKey) return;
    if(isTypingTarget(e.target)) return;

    var k = e.key;

    if(k >= '1' && k <= '5'){
      e.preventDefault();
      clickStar(parseInt(k,10));
      return;
    }

    if(k === '-' || k === '_'){
      e.preventDefault();
      clickTriad(0); // No
      return;
    }

    if(k === '0' || k === ' ' || k === '.'){
      e.preventDefault();
      clickTriad(1); // Don't know
      return;
    }

    if(k === '+' || k === '='){
      e.preventDefault();
      clickTriad(2); // Add
      return;
    }

    if(k === 'h' || k === 'H'){
      e.preventDefault();
      location.href = 'index.html?ts=' + Date.now();
      return;
    }
  }, true);

  try{
    var sp = new URLSearchParams(location.search);
    if(sp.get('keysdebug') === '1') console.info('[keys] installed');
  }catch(_){}
})();
