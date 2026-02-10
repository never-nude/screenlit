(function () {
  const catalog = window.ScreenLitCatalog || [];
  const storage = window.ScreenLitStorage;
  const UI = window.ScreenLitUI;

  const ratingsList = document.getElementById("ratingsList");
  const dispList = document.getElementById("dispList");
  const statsEl = document.getElementById("stats");

  const btnExport = document.getElementById("btnExport");
  const btnImport = document.getElementById("btnImport");
  const btnClear = document.getElementById("btnClear");
  const fileImport = document.getElementById("fileImport");

  const byId = {};
  catalog.forEach(it => { if (it && it.id) byId[it.id] = it; });

  function typeLabel(type) {
    return type === "tv" ? "TV" : (type === "film" ? "Film" : "Book");
  }

  function render() {
    if (!ratingsList || !dispList || !statsEl || !storage || !UI) return;

    const ratings = storage.getAllRatings();
    const dispositions = storage.getAllDispositions();

    const ratingEntries = Object.entries(ratings)
      .map(([id, v]) => ({ id, v: Number(v) }))
      .filter(x => isFinite(x.v) && x.v >= 1 && x.v <= 5)
      .map(x => ({ ...x, item: byId[x.id] }))
      .filter(x => !!x.item)
      .sort((a, b) => {
        const ta = a.item.type || "";
        const tb = b.item.type || "";
        if (ta !== tb) return ta.localeCompare(tb);
        return (a.item.title || "").localeCompare(b.item.title || "");
      });

    const dispEntries = Object.entries(dispositions)
      .map(([id, d]) => ({ id, d }))
      .filter(x => x.d === "no" || x.d === "unknown" || x.d === "add")
      .map(x => ({ ...x, item: byId[x.id] }))
      .filter(x => !!x.item)
      .sort((a, b) => {
        const ta = a.item.type || "";
        const tb = b.item.type || "";
        if (ta !== tb) return ta.localeCompare(tb);
        return (a.item.title || "").localeCompare(b.item.title || "");
      });

    ratingsList.innerHTML = "";
    dispList.innerHTML = "";

    const stats = storage.getStats(catalog);
    const ratedCount = ratingEntries.length;
    const dispCount = dispEntries.length;

    const avgText = (stats && stats.count)
      ? ` · Avg: ${Number(stats.globalAvg).toFixed(2)} ★`
      : "";

    statsEl.textContent = `Rated: ${ratedCount} · Dispositions: ${dispCount}${avgText}`;

    if (!ratingEntries.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No ratings yet.";
      ratingsList.appendChild(empty);
    } else {
      ratingEntries.forEach(e => {
        const item = e.item;

        const card = document.createElement("div");
        card.className = "entry";

        const top = document.createElement("div");
        top.className = "entryTop";

        const t = document.createElement("div");
        t.className = "entryTitle";
        t.textContent = item.title;

        const m = document.createElement("div");
        m.className = "entryMeta";
        m.textContent = `${typeLabel(item.type)} · ${item.year}`;

        top.appendChild(t);
        top.appendChild(m);

        const bottom = document.createElement("div");
        bottom.className = "entryBottom";

        const stars = UI.createStars(e.v, "explicit");
        bottom.appendChild(stars.root);

        const badge = document.createElement("div");
        badge.className = "badge";
        badge.textContent = `Rated: ${e.v} / 5`;
        bottom.appendChild(badge);

        card.appendChild(top);
        card.appendChild(bottom);
        ratingsList.appendChild(card);
      });
    }

    if (!dispEntries.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No dispositions yet.";
      dispList.appendChild(empty);
    } else {
      const label = { no: "No", unknown: "Don’t know", add: "Add" };

      dispEntries.forEach(e => {
        const item = e.item;

        const card = document.createElement("div");
        card.className = "entry";

        const top = document.createElement("div");
        top.className = "entryTop";

        const t = document.createElement("div");
        t.className = "entryTitle";
        t.textContent = item.title;

        const m = document.createElement("div");
        m.className = "entryMeta";
        m.textContent = `${typeLabel(item.type)} · ${item.year}`;

        top.appendChild(t);
        top.appendChild(m);

        const bottom = document.createElement("div");
        bottom.className = "entryBottom";

        const spacer = document.createElement("div");
        spacer.className = "muted";
        spacer.textContent = "Resolved by disposition";
        bottom.appendChild(spacer);

        const badge = document.createElement("div");
        badge.className = "badge";
        badge.textContent = `Disposition: ${label[e.d] || e.d}`;
        bottom.appendChild(badge);

        card.appendChild(top);
        card.appendChild(bottom);
        dispList.appendChild(card);
      });
    }
  }

  btnExport && (btnExport.onclick = () => {
    const st = storage.exportState();
    const blob = new Blob([JSON.stringify(st, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "screenlit_v2_export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 500);
  });

  btnImport && (btnImport.onclick = () => {
    if (!fileImport) return;
    fileImport.value = "";
    fileImport.click();
  });

  fileImport && (fileImport.onchange = async () => {
    const file = fileImport.files && fileImport.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      const ok = storage.importState(obj);
      if (!ok) alert("Import failed: not a ScreenLit_v2 export file.");
      render();
    } catch (_) {
      alert("Import failed: invalid JSON.");
    }
  });

  btnClear && (btnClear.onclick = () => {
    const ok = confirm("Clear all ScreenLit_v2 data on this browser? This cannot be undone.");
    if (!ok) return;
    storage.clearAll();
    render();
  });

  render();
})();
