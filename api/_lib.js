const crypto = require("crypto");

function checkInitData(initData, botToken) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const data = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calc = crypto.createHmac("sha256", secret).update(data).digest("hex");
  const a = Buffer.from(calc), b = Buffer.from(hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const age = Date.now() / 1000 - Number(params.get("auth_date") || 0);
  if (age > 86400) return null;
  try { return JSON.parse(params.get("user")); } catch { return null; }
}

function sbHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    "Content-Type": "application/json",
  };
}

module.exports = { checkInitData, sbHeaders };
