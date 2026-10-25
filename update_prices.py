import os, re, sys
import requests
from TelegramGifts import TelegramGifts

URL = "https://my-app-beta-mocha.vercel.app/api/update-floors"
secret = os.environ.get("ADMIN_SECRET") or open(os.path.expanduser("~/.nft-admin-secret")).read().strip()

def slugify(n):
    return re.sub(r"[^a-z0-9]", "", n.replace("\u2019", "'").lower())

g = TelegramGifts(cache_mode="http", asset_mode="lazy")
best = {}
for it in g.get_upgraded_gifts():
    slug = slugify(it.full_name)
    v = getattr(it.prices, "floor_price_ton", None)
    cur = best.get(slug)
    if cur is None or (not cur["floor"] and v):
        best[slug] = {"name": it.full_name.replace("\u2019", "'"), "floor": v, "p": it.prices}

floors, new_items, skipped = {}, [], []
for slug, d in best.items():
    new_items.append({"slug": slug, "name": d["name"], "image": f"https://fragment.com/file/gifts/{slug}/thumb.webp"})
    v = d["floor"]
    if not v or v <= 0:
        skipped.append(d["name"] + " (нет цены)")
        continue
    p = d["p"]
    others = [x for x in (getattr(p, "getgems_price_ton", None), getattr(p, "tgmrkt_price_ton", None), getattr(p, "portal_price_ton", None)) if x and x > 0]
    if others and max(others) / min(others) > 1.4:
        skipped.append(d["name"] + " (рынки расходятся)")
        continue
    floors[slug] = v

body = {"floors": floors, "newItems": new_items, "force": "--force" in sys.argv}
r = requests.post(URL, json=body, headers={"x-admin-secret": secret}, timeout=120)
try:
    out = r.json()
except Exception:
    print("Ответ сервера:", r.text[:400]); sys.exit(1)
print("Цен отправлено:", len(floors), "| обновлено:", out.get("updated"))
print("Новые подарки (выключены):", out.get("addedSlugs"))
print("Отклонено:", out.get("rejected"), "| ошибки:", out.get("failed"))
print("Пропущено:", len(skipped))
for s in skipped:
    print("  -", s)
