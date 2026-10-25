const crypto = require("crypto");
const { checkInitData, sbHeaders } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const user = checkInitData((req.body || {}).initData, process.env.BOT_TOKEN);
  if (!user) return res.status(401).json({ error: "auth" });

  const since = new Date(Date.now() - 3600e3).toISOString();
  const c = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/deposits?tg_id=eq.${user.id}&status=eq.pending&created_at=gte.${since}&select=comment`,
    { headers: sbHeaders() }
  );
  const open = c.ok ? await c.json() : [];
  if (open.length >= 10) return res.status(429).json({ error: "too many" });

  const comment = "dep_" + crypto.randomBytes(6).toString("hex");
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/deposits`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({ comment, tg_id: user.id }),
  });
  if (!r.ok) return res.status(500).json({ error: "db" });
  res.json({ comment, address: process.env.TON_ADDRESS });
};
