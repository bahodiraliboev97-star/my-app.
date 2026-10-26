const { checkInitData, sbHeaders } = require("./_lib");

function getMultiplier(cellsOpened, totalMines) {
  let n = 25, m = totalMines, p = 1;
  for (let i = 0; i < cellsOpened; i++) p = p * (n - m - i) / (n - i);
  return parseFloat((0.95 / p).toFixed(2));
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const { initData, sessionId, action, index } = req.body || {};
  const user = checkInitData(initData, process.env.BOT_TOKEN);
  if (!user) return res.status(401).json({ error: "auth" });

  const sb = process.env.SUPABASE_URL;
  const sRes = await fetch(`${sb}/rest/v1/mines_sessions?id=eq.${sessionId}&tg_id=eq.${user.id}`, { headers: sbHeaders() });
  const sList = sRes.ok ? (await sRes.json()) : null;
  const session = sList && sList[0];
  if (!session || !session.is_active) return res.status(400).json({ error: "session_not_found" });

  if (action === "click") {
    if (index < 0 || index > 24 || session.clicked_indexes.includes(index)) return res.status(400).json({ error: "invalid_index" });
    if (session.field[index] === 1) {
      await fetch(`${sb}/rest/v1/mines_sessions?id=eq.${sessionId}`, { method: "PATCH", headers: { ...sbHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ is_active: false }) });
      return res.json({ status: "game_over", mineField: session.field });
    }
    const newClicks = [...session.clicked_indexes, index];
    await fetch(`${sb}/rest/v1/mines_sessions?id=eq.${sessionId}`, { method: "PATCH", headers: { ...sbHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ clicked_indexes: newClicks }) });
    return res.json({ status: "keep_going", clickedIndexes: newClicks, multiplier: getMultiplier(newClicks.length, session.mines_count) });
  }

  if (action === "cashout") {
    if (session.clicked_indexes.length === 0) return res.status(400).json({ error: "no_clicks" });
    const finalMult = getMultiplier(session.clicked_indexes.length, session.mines_count);
    const winAmount = Math.floor(session.bet_amount * finalMult);
    await fetch(`${sb}/rest/v1/mines_sessions?id=eq.${sessionId}`, { method: "PATCH", headers: { ...sbHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ is_active: false }) });
    const pRes = await fetch(`${sb}/rest/v1/profiles?tg_id=eq.${user.id}&select=balance`, { headers: sbHeaders() });
    const pList = await pRes.json();
    const profile = pList && pList[0];
    await fetch(`${sb}/rest/v1/profiles?tg_id=eq.${user.id}`, { method: "PATCH", headers: { ...sbHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ balance: profile.balance + winAmount }) });
    return res.json({ status: "success_cashout", winAmount, multiplier: finalMult, mineField: session.field });
  }
  res.status(400).json({ error: "unknown_action" });
};
