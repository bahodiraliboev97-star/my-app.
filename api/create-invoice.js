const { checkInitData } = require("./_lib");
const MIN = 1, MAX = 10000;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const { initData, amount } = req.body || {};
  const user = checkInitData(initData, process.env.BOT_TOKEN);
  if (!user) return res.status(401).json({ error: "auth" });
  if (!Number.isInteger(amount) || amount < MIN || amount > MAX) return res.status(400).json({ error: "amount" });

  const r = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/createInvoiceLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Пополнение баланса",
      description: `Пополнение на ${amount} ⭐`,
      payload: `topup:${user.id}:${amount}`,
      currency: "XTR",
      prices: [{ label: "Пополнение", amount }],
    }),
  });
  const data = await r.json();
  if (!data.ok) return res.status(500).json({ error: "telegram" });
  res.json({ link: data.result });
};
