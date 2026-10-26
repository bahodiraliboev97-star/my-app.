const { checkInitData, sbHeaders } = require("./_lib");

const CASES_CONFIG = {
  1: {
    cost: 50,
    items: [
      { id: 101, name: "Обычный предмет", chance: 70 },
      { id: 102, name: "Редкий предмет", chance: 25 },
      { id: 103, name: "ДЖЕКПОТ", chance: 5 }
    ]
  }
};

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  
  const { initData, caseId } = req.body || {};
  const user = checkInitData(initData, process.env.BOT_TOKEN);
  if (!user) return res.status(401).json({ error: "auth" });

  const currentCase = CASES_CONFIG[caseId];
  if (!currentCase) return res.status(400).json({ error: "case_not_found" });

  const rand = Math.random() * 100;
  let cumulativeChance = 0;
  let winItem = null;

  for (const item of currentCase.items) {
    cumulativeChance += item.chance;
    if (rand <= cumulativeChance) {
      winItem = item;
      break;
    }
  }

  const sb = process.env.SUPABASE_URL;
  const rr = await fetch(`${sb}/rest/v1/rpc/secure_open_case`, {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify({
      p_tg_id: user.id,
      p_cost: currentCase.cost,
      p_item_id: winItem.id
    }),
  });

  try {
    const success = rr.ok && (await rr.json()) === true;
    if (!success) return res.status(400).json({ error: "insufficient_funds_or_error" });
    res.json({ success: true, winItem });
  } catch(e) {
    res.status(500).json({ error: "db_error" });
  }
};
