const crypto = require("crypto");
const { sbHeaders } = require("./_lib");

function same(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  if (!same(req.headers["x-admin-secret"], process.env.ADMIN_SECRET)) return res.status(401).end();
  const body = req.body || {};
  const floors = body.floors || {};
  const force = !!body.force;
  const newItems = Array.isArray(body.newItems) ? body.newItems : [];
  const SB = process.env.SUPABASE_URL;
  const result = { updated: 0, addedSlugs: [], rejected: [], unknown: [], failed: [] };

  const rows = newItems
    .filter((i) => i && /^[a-z0-9]{1,60}$/.test(i.slug || "") && typeof i.name === "string")
    .slice(0, 300)
    .map((i) => ({
      slug: i.slug,
      name: i.name.slice(0, 80),
      image: typeof i.image === "string" && i.image.startsWith("https://") ? i.image : null,
    }));
  if (rows.length) {
    const ir = await fetch(`${SB}/rest/v1/items?on_conflict=slug`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(rows),
    });
    if (ir.ok) result.addedSlugs = (await ir.json()).map((r) => r.slug);
  }

  const cur = await fetch(`${SB}/rest/v1/items?select=slug,floor_ton`, { headers: sbHeaders() });
  if (!cur.ok) return res.status(500).json({ error: "db" });
  const old = Object.fromEntries((await cur.json()).map((i) => [i.slug, i.floor_ton]));

  const jobs = [];
  for (const [slug, raw] of Object.entries(floors)) {
    const v = Number(raw);
    if (!(slug in old)) { result.unknown.push(slug); continue; }
    if (!(v > 0) || !isFinite(v)) { result.rejected.push(slug + ": bad value"); continue; }
    const prev = old[slug] == null ? null : Number(old[slug]);
    if (!force && prev && Math.abs(v - prev) / prev > 0.35) {
      result.rejected.push(`${slug}: ${prev} -> ${v}`);
      continue;
    }
    jobs.push([slug, v]);
  }

  const now = new Date().toISOString();
  for (let i = 0; i < jobs.length; i += 10) {
    await Promise.all(jobs.slice(i, i + 10).map(async ([slug, v]) => {
      try {
        const r = await fetch(`${SB}/rest/v1/items?slug=eq.${encodeURIComponent(slug)}`, {
          method: "PATCH",
          headers: { ...sbHeaders(), Prefer: "return=minimal" },
          body: JSON.stringify({ floor_ton: v, floor_updated_at: now }),
        });
        if (r.ok) result.updated++; else result.failed.push(slug);
      } catch (e) { result.failed.push(slug); }
    }));
  }
  res.json(result);
};
