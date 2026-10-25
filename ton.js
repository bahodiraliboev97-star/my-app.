(function () {
  const tg = window.Telegram && Telegram.WebApp;
  if (!tg) return;
  const oldStars = window.openTopup;
  let tc = null;

  async function post(url, body) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.json();
  }
  function getTc() {
    if (!tc && window.TON_CONNECT_UI) {
      tc = new TON_CONNECT_UI.TonConnectUI({ manifestUrl: location.origin + "/tonconnect-manifest.json" });
    }
    return tc;
  }
  async function refresh() {
    try {
      const d = await post("/api/balance", { initData: tg.initData });
      const a = document.getElementById("userBal"), b = document.getElementById("userTon");
      if (a && typeof d.balance === "number") a.textContent = d.balance;
      if (b && typeof d.ton === "number") b.textContent = d.ton.toFixed(2);
    } catch (e) {}
  }
  function commentPayload(text) {
    const t = new TextEncoder().encode(text);
    const data = new Uint8Array(4 + t.length); data.set(t, 4);
    const cell = new Uint8Array(2 + data.length);
    cell[0] = 0; cell[1] = data.length * 2; cell.set(data, 2);
    const head = [0xb5, 0xee, 0x9c, 0x72, 1, 1, 1, 1, 0, cell.length, 0];
    const boc = new Uint8Array(head.length + cell.length);
    boc.set(head, 0); boc.set(cell, head.length);
    let s = ""; boc.forEach((x) => (s += String.fromCharCode(x)));
    return btoa(s);
  }
  function openTon() {
    if (document.getElementById("tonBox")) return;
    const box = document.createElement("div");
    box.id = "tonBox";
    box.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:9999";
    box.innerHTML = '<div style="background:#1b1b24;color:#fff;padding:20px;border-radius:16px;width:290px;font-family:sans-serif">'
      + '<div style="font-size:18px;margin-bottom:12px">Пополнение в TON</div>'
      + '<input id="tonAmt" type="number" step="0.01" min="0.1" inputmode="decimal" placeholder="Сумма в TON (от 0.1)" style="width:100%;padding:10px;border-radius:8px;border:0;font-size:16px;box-sizing:border-box">'
      + '<div id="tonSt" style="margin-top:10px;font-size:13px;color:#aaa;min-height:18px"></div>'
      + '<button id="tonGo" style="width:100%;margin-top:8px;padding:12px;border:0;border-radius:8px;font-size:16px;background:#f5a623;color:#000">Оплатить</button>'
      + '<button id="tonX" style="width:100%;margin-top:8px;padding:10px;border:0;border-radius:8px;background:transparent;color:#aaa">Закрыть</button></div>';
    document.body.appendChild(box);
    const st = (t) => (document.getElementById("tonSt").textContent = t);
    const close = () => box.remove();
    document.getElementById("tonX").onclick = close;
    document.getElementById("tonGo").onclick = async function () {
      const amount = parseFloat(document.getElementById("tonAmt").value);
      if (!(amount >= 0.1 && amount <= 1000)) return st("Введи сумму от 0.1 до 1000");
      const nano = BigInt(Math.round(amount * 1e9)).toString();
      const t = getTc();
      if (!t) return st("Не загрузился TON Connect, обнови страницу");
      try {
        this.disabled = true;
        if (!t.connected) {
          box.style.display = "none";
          t.openModal();
          await new Promise((resolve) => {
            let un1 = () => {}, un2 = () => {};
            const done = () => { un1(); un2(); resolve(); };
            un1 = t.onStatusChange((w) => { if (w) done(); });
            un2 = t.onModalStateChange((m) => { if (m && m.status === "closed") setTimeout(done, 400); });
          });
          box.style.display = "flex";
          if (!t.connected) { this.disabled = false; return st("Кошелёк не подключён. Нажми «Оплатить» ещё раз."); }
        }
        const dep = await post("/api/ton-deposit", { initData: tg.initData });
        if (!dep.comment) { this.disabled = false; return st("Не удалось создать платёж"); }
        st("Подтверди перевод в кошельке…");
        await t.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 600,
          messages: [{ address: dep.address, amount: nano, payload: commentPayload(dep.comment) }],
        });
        st("Ждём подтверждения в сети…");
        for (let i = 0; i < 36; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          const c = await post("/api/ton-check", { initData: tg.initData });
          if (c.credited > 0) { await refresh(); st("✅ Баланс пополнен"); return; }
        }
        st("Перевод пока не найден. Он зачислится при следующем открытии приложения.");
        this.disabled = false;
      } catch (e) { this.disabled = false; st("Платёж отменён или произошла ошибка"); }
    };
  }
  window.openTopup = function () {
    tg.showPopup({
      title: "Пополнение", message: "Выбери способ оплаты",
      buttons: [{ id: "stars", type: "default", text: "⭐ Telegram Stars" }, { id: "ton", type: "default", text: "💎 TON" }, { type: "cancel" }],
    }, function (id) {
      if (id === "stars" && oldStars) oldStars();
      if (id === "ton") openTon();
    });
  };
  post("/api/ton-check", { initData: tg.initData }).catch(() => {}).then(refresh);
})();
