(function () {
  const tg = window.Telegram && Telegram.WebApp;
  if (!tg) return;
  const FEE = 0.05, MIN = 0.5; // только для подсказки, реальные цифры проверяет сервер

  async function post(url, body) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.json();
  }
  async function refresh() {
    try {
      const d = await post("/api/balance", { initData: tg.initData });
      const b = document.getElementById("userTon");
      if (b && typeof d.ton === "number") b.textContent = d.ton.toFixed(2);
    } catch (e) {}
  }

  window.openWithdraw = function () {
    if (document.getElementById("wdBox")) return;
    const box = document.createElement("div");
    box.id = "wdBox";
    box.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:9999";
    box.innerHTML = '<div style="background:#1b1b24;color:#fff;padding:20px;border-radius:16px;width:300px;font-family:inherit">'
      + '<div style="font-size:18px;margin-bottom:12px">Вывод TON</div>'
      + '<input id="wdAmt" type="number" step="0.01" inputmode="decimal" placeholder="Сумма в TON" style="width:100%;padding:10px;font-size:16px;box-sizing:border-box;margin-bottom:8px">'
      + '<input id="wdAddr" placeholder="Твой TON-адрес (UQ… или EQ…)" style="width:100%;padding:10px;font-size:14px;box-sizing:border-box">'
      + '<div id="wdInfo" style="margin-top:10px;font-size:13px;color:#aaa;min-height:36px">Минимум ' + MIN + ' TON. Комиссия ' + FEE + ' TON.</div>'
      + '<button id="wdGo" class="btn full" style="width:100%;margin-top:8px;padding:12px">Вывести</button>'
      + '<button id="wdX" style="width:100%;margin-top:8px;padding:10px;border:0;background:transparent;color:#aaa">Закрыть</button></div>';
    document.body.appendChild(box);
    const info = (t) => (document.getElementById("wdInfo").textContent = t);
    const close = () => box.remove();
    document.getElementById("wdX").onclick = close;
    document.getElementById("wdAmt").addEventListener("input", function () {
      const a = parseFloat(this.value);
      if (a >= MIN) info("Спишется " + a.toFixed(2) + " TON, к получению " + (a - FEE).toFixed(2) + " TON.");
      else info("Минимум " + MIN + " TON. Комиссия " + FEE + " TON.");
    });
    document.getElementById("wdGo").onclick = async function () {
      const amount = parseFloat(document.getElementById("wdAmt").value);
      const address = document.getElementById("wdAddr").value.trim();
      if (!(amount >= MIN)) return info("Минимальная сумма вывода " + MIN + " TON");
      if (!address) return info("Введи TON-адрес");
      this.disabled = true;
      try {
        const d = await post("/api/withdraw", { initData: tg.initData, amount, address });
        if (d.ok) {
          info("✅ Заявка #" + d.id + " принята. К получению " + d.net.toFixed(2) + " TON. Выплата вручную, обычно в течение суток.");
          refresh();
        } else {
          const m = { balance: "Недостаточно средств на балансе", min: "Сумма меньше минимальной", address: "Неверный TON-адрес", too_many: "Слишком много необработанных заявок, подожди выплаты", amount: "Неверная сумма", auth: "Откройте приложение через бота" };
          info(m[d.error] || "Ошибка, попробуй позже");
          this.disabled = false;
        }
      } catch (e) { info("Ошибка сети"); this.disabled = false; }
    };
  };
})();
