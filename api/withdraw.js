const { checkInitData, sbHeaders } = require("./_lib");

const ADDR = /^(EQ|UQ|kQ|0Q)[A-Za-z0-9_-]{46}$/;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const body = req.body || {};
  const user = checkInitData(body.initData, process.env.BOT_TOKEN);
  if (!user) return res.status(401).json({ error: "auth" });

  const amount = Number(body.amount);
  const address = String(body.address || "").trim();
  if (!(amount > 0) || amount > 100000) return res.status(400).json({ error: "amount" });
  if (!ADDR.test(address)) return res.status(400).json({ error: "address" });
  const nano = Math.round(amount * 1e9);

  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/request_withdrawal`, {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify({ p_tg: user.id, p_amount: nano, p_address: address }),
  });
  if (!r.ok) return res.status(500).json({ error: "db" });
  const out = await r.json();
  if (!out || out.error) return res.status(400).json({ error: (out && out.error) || "unknown" });

  const ton = (n) => (Number(n) / 1e9).toFixed(2);
  const text =
    `💸 Заявка на вывод #${out.id}\n` +
    `Пользователь: ${user.first_name || ""} ${user.username ? "@" + user.username : ""} (id ${user.id})\n` +
    `Списано с баланса: ${ton(nano)} TON\n` +
    `Комиссия: ${ton(out.fee)} TON\n` +
    `К отправке: ${ton(out.net)} TON\n` +
    `Адрес: ${address}`;
  try {
    await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: process.env.ADMIN_TG_ID, text, reply_markup: { inline_keyboard: [[{ text: "✅ Выплачено", callback_data: "wd:paid:" + out.id }, { text: "❌ Отклонить", callback_data: "wd:rej:" + out.id }]] } }),
    });
  } catch (e) {}

  res.json({ ok: true, id: out.id, fee: Number(out.fee) / 1e9, net: Number(out.net) / 1e9 });
};
