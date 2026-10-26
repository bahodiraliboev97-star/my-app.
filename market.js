(function () {
  let items = [], loaded = false;
  const $ = (id) => document.getElementById(id);
  const tier = (p) => p >= 200 ? 3 : p >= 50 ? 2 : p >= 10 ? 1 : 0;

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
    list.forEach((i, idx) => {
      const card = document.createElement("div"); card.className = "card t" + tier(i.price_ton); card.style.setProperty("--i", Math.min(idx, 14));
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

// === НАЧАЛО НОВОГО КОДА ДЛЯ КЕЙСОВ И МИН ===
(function () {
  const getInitData = () => window.Telegram?.WebApp?.initData || "";
  let minesSessionId = null;

  // Логика открытия кейса
  async function openCase(caseId) {
    try {
      const response = await fetch('/api/open-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getInitData(), caseId })
      });
      const data = await response.json();
      if (data.error) {
        alert("Ошибка: " + data.error);
        return null;
      }
      return data.winItem; 
    } catch (e) {
      console.error("Ошибка открытия кейса:", e);
    }
  }

  // Начать игру в мины
  async function startMines(bet, minesCount) {
    try {
      const response = await fetch('/api/mines-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getInitData(), bet, minesCount })
      });
      const data = await response.json();
      if (data.error) {
        alert("Не удалось начать: " + data.error);
        return null;
      }
      minesSessionId = data.sessionId;
      return data.sessionId;
    } catch (e) {
      console.error("Ошибка старта мин:", e);
    }
  }

  // Клик по ячейке в минах
  async function clickMineCell(cellIndex) {
    if (!minesSessionId) return alert("Игра не начата!");
    try {
      const response = await fetch('/api/mines-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getInitData(), sessionId: minesSessionId, action: 'click', index: cellIndex })
      });
      const data = await response.json();
      if (data.status === 'game_over') {
        minesSessionId = null;
      }
      return data;
    } catch (e) {
      console.error("Ошибка клика:", e);
    }
  }

  // Забрать деньги (Кэшаут)
  async function cashoutMines() {
    if (!minesSessionId) return alert("Нет активной игры!");
    try {
      const response = await fetch('/api/mines-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getInitData(), sessionId: minesSessionId, action: 'cashout' })
      });
      const data = await response.json();
      minesSessionId = null;
      return data;
    } catch (e) {
      console.error("Ошибка кэшаута:", e);
    }
  }

  // Делаем функции доступными везде
  window.gameOpenCase = openCase;
  window.gameStartMines = startMines;
  window.gameClickMineCell = clickMineCell;
  window.gameCashoutMines = cashoutMines;
})();
