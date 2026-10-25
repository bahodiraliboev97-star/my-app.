const { checkInitData, sbHeaders } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const user = checkInitData((req.body || {}).initData, process.env.BOT_TOKEN);
  if (!user) return res.status(401).json({ error: "auth" });

  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const dr = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/deposits?tg_id=eq.${user.id}&status=eq.pending&created_at=gte.${since}&select=comment`,
    { headers: sbHeaders() }
  );
  const pending = dr.ok ? await dr.json() : [];
  if (!pending.length) return res.json({ credited: 0 });
  const wanted = new Set(pending.map((d) => d.comment));

  const tr = await fetch(
    `https://toncenter.com/api/v3/transactions?account=${encodeURIComponent(process.env.TON_ADDRESS)}&limit=40&sort=desc`
  );
  if (!tr.ok) return res.status(502).json({ error: "ton api" });
  const data = await tr.json();

  let credited = 0;
  for (const tx of data.transactions || []) {
    const m = tx.in_msg;
    if (!m || !m.source) continue;
    if (tx.description && tx.description.aborted) continue;
    const dec = m.message_content && m.message_content.decoded;
    const comment = dec && dec.comment;
    if (!comment || !wanted.has(comment)) continue;
    const value = BigInt(m.value || "0");
    if (value < 50000000n) continue; // минимум 0.05 TON
    const rr = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/credit_ton`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({ p_comment: comment, p_tx_hash: tx.hash, p_amount: Number(value) }),
    });
    if (rr.ok && (await rr.json()) === true) credited++;
  }
  res.json({ credited });
};
