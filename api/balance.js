const { checkInitData, sbHeaders } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const user = checkInitData((req.body || {}).initData, process.env.BOT_TOKEN);
  if (!user) return res.status(401).json({ error: "auth" });
  const r = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/users?tg_id=eq.${user.id}&select=balance,ton_balance`,
    { headers: sbHeaders() }
  );
  const rows = r.ok ? await r.json() : [];
  const row = rows[0] || {};
  res.json({ balance: Number(row.balance || 0), ton: Number(row.ton_balance || 0) / 1e9 });
};
