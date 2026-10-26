const { checkInitData, sbHeaders } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const { initData, bet, minesCount } = req.body || {};
  const user = checkInitData(initData, process.env.BOT_TOKEN);
  if (!user) return res.status(401).json({ error: "auth" });
  if (!bet || bet <= 0 || !minesCount || minesCount < 1 || minesCount > 24) return res.status(400).json({ error: "invalid_params" });

  const field = Array(25).fill(0);
  let placedMines = 0;
  while (placedMines < minesCount) {
    const randIdx = Math.floor(Math.random() * 25);
    if (field[randIdx] === 0) { field[randIdx] = 1; placedMines++; }
  }

  const sb = process.env.SUPABASE_URL;
  const profileRes = await fetch(`${sb}/rest/v1/profiles?tg_id=eq.${user.id}&select=balance`, { headers: sbHeaders() });
  const profileList = profileRes.ok ? (await profileRes.json()) : null;
  const profile = profileList && profileList[0];
  if (!profile || profile.balance < bet) return res.status(400).json({ error: "insufficient_funds" });

  await fetch(`${sb}/rest/v1/profiles?tg_id=eq.${user.id}`, {
    method: "PATCH", headers: { ...sbHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ balance: profile.balance - bet })
  });

  const sessionRes = await fetch(`${sb}/rest/v1/mines_sessions`, {
    method: "POST", headers: { ...sbHeaders(), "Content-Type": "application/json", "Prefer": "return=representation" },
    body: JSON.stringify({ tg_id: user.id, bet_amount: bet, mines_count: minesCount, field: field, is_active: true })
  });

  if (!sessionRes.ok) return res.status(500).json({ error: "db_error" });
  const sessionList = await sessionRes.json();
  const session = sessionList && sessionList[0];
  res.json({ success: true, sessionId: session.id });
};
