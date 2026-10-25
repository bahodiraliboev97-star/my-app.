const { sbHeaders } = require("./_lib");
const MAX_AGE_MS = 6 * 3600e3;

module.exports = async (req, res) => {
  const r = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/items?enabled=eq.true&floor_ton=not.is.null&select=slug,name,image,floor_ton,markup,floor_updated_at&order=name`,
    { headers: sbHeaders() }
  );
  if (!r.ok) return res.status(500).json({ error: "db" });
  const now = Date.now();
  const items = (await r.json())
    .filter((i) => i.floor_updated_at && now - new Date(i.floor_updated_at).getTime() < MAX_AGE_MS)
    .map((i) => ({
      slug: i.slug,
      name: i.name,
      image: i.image,
      price_ton: Math.ceil(Number(i.floor_ton) * (1 + Number(i.markup)) * 100) / 100,
    }));
  res.setHeader("Cache-Control", "s-maxage=60");
  res.json({ items });
};
