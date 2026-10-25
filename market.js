(function () {
  let items = [], loaded = false;
  const $ = (id) => document.getElementById(id);

  function render() {
    const grid = $("marketGrid");
    if (!grid) return;
    const q = ($("marketSearch").value || "").trim().toLowerCase();
    const sort = $("marketSort").value;
    let list = items.filter((i) => i.name.toLowerCase().includes(q));
    list.sort((a, b) => sort === "desc" ? b.price_ton - a.price_ton : sort === "name" ? a.name.localeCompare(b.name) : a.price_ton - b.price_ton);
    grid.textContent = "";
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = loaded ? "Ничего не найдено. Цены могли устареть, попробуй позже." : "Загрузка…";
      grid.appendChild(p);
      return;
    }
    list.forEach((i) => {
      const card = document.createElement("div"); card.className = "card";
      const art = document.createElement("div"); art.className = "art";
      if (typeof i.image === "string" && i.image.startsWith("https://")) {
        const img = document.createElement("img");
        img.src = i.image; img.alt = ""; img.loading = "lazy";
        img.style.cssText = "max-width:80%;max-height:80%;object-fit:contain";
        art.appendChild(img);
      }
      const title = document.createElement("div"); title.className = "cardtitle"; title.textContent = i.name;
      const row = document.createElement("div"); row.className = "row";
      const price = document.createElement("span"); price.className = "price";
      price.textContent = i.price_ton.toLocaleString("ru-RU", { maximumFractionDigits: 2 }); const u = document.createElement("span"); u.className = "ton"; u.textContent = "TON"; price.appendChild(u);
      row.appendChild(price);
      card.append(art, title, row);
      grid.appendChild(card);
    });
  }

  async function load() {
    try {
      const r = await fetch("/api/items");
      const d = await r.json();
      items = Array.isArray(d.items) ? d.items : [];
    } catch (e) { items = []; }
    loaded = true;
    render();
  }

  window.loadMarket = load;
  document.addEventListener("input", (e) => { if (e.target && e.target.id === "marketSearch") render(); });
  document.addEventListener("change", (e) => { if (e.target && e.target.id === "marketSort") render(); });
})();
