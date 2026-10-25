const { sbHeaders } = require("./_lib");
const TG = () => `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;

module.exports = async (req, res) => {
  if (req.headers["x-telegram-bot-api-secret-token"] !== process.env.WEBHOOK_SECRET) {
    return res.status(401).end();
  }
  const u = req.body || {};

  if (u.callback_query) {
    const cq = u.callback_query;
    const jh = { "Content-Type": "application/json" };
    const answer = (t) => fetch(`${TG()}/answerCallbackQuery`, { method: "POST", headers: jh, body: JSON.stringify({ callback_query_id: cq.id, text: t }) });
    if (String(cq.from.id) !== String(process.env.ADMIN_TG_ID)) { await answer("Нет доступа"); return res.json({ ok: true }); }
    const m = /^wd:(paid|rej):(\d+)$/.exec(cq.data || "");
    if (!m) { await answer(""); return res.json({ ok: true }); }
    const id = Number(m[2]);
    const sb = process.env.SUPABASE_URL;
    const wr = await fetch(`${sb}/rest/v1/withdrawals?id=eq.${id}&select=tg_id,amount_nano,fee_nano`, { headers: sbHeaders() });
    const row = wr.ok ? (await wr.json())[0] : null;
    if (!row) { await answer("Заявка не найдена"); return res.json({ ok: true }); }
    const paid = m[1] === "paid";
    const rr = await fetch(`${sb}/rest/v1/rpc/${paid ? "mark_withdrawal_paid" : "reject_withdrawal"}`, {
      method: "POST", headers: sbHeaders(),
      body: JSON.stringify(paid ? { p_id: id, p_tx: "manual" } : { p_id: id }),
    });
    const ok = rr.ok && (await rr.json()) === true;
    if (!ok) { await answer("Уже обработана или ошибка"); return res.json({ ok: true }); }
    await answer(paid ? "Отмечено как выплачено" : "Отклонено, деньги возвращены");
    const mark = paid ? "\n\n✅ ВЫПЛАЧЕНО" : "\n\n❌ ОТКЛОНЕНО, деньги возвращены";
    await fetch(`${TG()}/editMessageText`, { method: "POST", headers: jh, body: JSON.stringify({ chat_id: cq.message.chat.id, message_id: cq.message.message_id, text: (cq.message.text || "") + mark }) });
    const net = ((Number(row.amount_nano) - Number(row.fee_nano)) / 1e9).toFixed(2);
    const back = (Number(row.amount_nano) / 1e9).toFixed(2);
    await fetch(`${TG()}/sendMessage`, { method: "POST", headers: jh, body: JSON.stringify({ chat_id: row.tg_id, text: paid ? `✅ Вывод #${id} выполнен: отправлено ${net} TON.` : `Вывод #${id} отклонён. ${back} TON возвращены на баланс.` }) });
    return res.json({ ok: true });
  }

  if (u.pre_checkout_query) {
    const q = u.pre_checkout_query;
    const ok = q.currency === "XTR" && /^topup:\d+:\d+$/.test(q.invoice_payload || "");
    await fetch(`${TG()}/answerPreCheckoutQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pre_checkout_query_id: q.id,
        ok,
        error_message: ok ? undefined : "Ошибка платежа",
      }),
    });
    return res.json({ ok: true });
  }

  const p = u.message && u.message.successful_payment;
  if (p) {
    const from = u.message.from;
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/credit_payment`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({
        p_charge_id: p.telegram_payment_charge_id,
        p_tg_id: from.id,
        p_amount: p.total_amount,
        p_name: from.first_name || "",
      }),
    });
    if (!r.ok) return res.status(500).end(); // Telegram повторит запрос
    await fetch(`${TG()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: from.id, text: `✅ Баланс пополнен на ${p.total_amount} ⭐` }),
    });
  }
  res.json({ ok: true });
};
