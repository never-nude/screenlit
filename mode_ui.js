/* mode_ui.js — minimal mode indicator
   Turns the Mode link text into: Guest | Profile
   (Hover title stays "Mode" so meaning remains clean.)
*/
(function(){
  function getMode(){
    try {
      if (window.SL_Storage && typeof window.SL_Storage.getSessionMode === "function") {
        return window.SL_Storage.getSessionMode(); // "guest" | "local"
      }
    } catch(e) {}
    return "local";
  }

  function labelFor(mode){
    return (mode === "guest") ? "Guest" : "Profile";
  }

  function apply(){
    var a = document.getElementById("slMode");
    if (!a) {
      // fallback: find any entry.html link
      var links = Array.from(document.querySelectorAll("a"));
      a = links.find(function(x){
        var h = x.getAttribute("href") || "";
        return h.indexOf("entry.html") >= 0;
      }) || null;
    }
    if (!a) return;

    a.textContent = labelFor(getMode());
    a.title = "Mode";
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
})();
