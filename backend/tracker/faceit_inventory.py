"""
CS2 inventory from FACEIT's Skin Vault data, replacing the Steam inventory
scrape and the paid steamwebapi.com proxy.

Undocumented: this is the endpoint FACEIT's own Skin Vault tab calls, under
their checkout service. It answers without auth, keyed on the FACEIT player id.
It can change or close without notice, so a failure or an empty answer is
always "unknown", never "no skins" — an empty list is indistinguishable from an
account FACEIT has not snapshotted, and scoring it as zero would penalise the
trust score for something we do not know.

Not in it: prices (its own value sort ranks a Contraband Howl below stock
rifles, so we never present its order as value), medals/coins, and freshness —
`updated_at` is a snapshot, usually weeks old.
"""
from __future__ import annotations

import requests
from django.core.cache import cache

from .useragent import HEADERS as _UA

URL = "https://www.faceit.com/api/integrated-checkout/v1/inventory-items"
PAGE = 100
MAX_PAGES = 5
TTL = 6 * 60 * 60
FAIL_TTL = 10 * 60

RARITY_GRADE = {
    "Stock": 0, "Consumer Grade": 1, "Industrial Grade": 2, "Mil-Spec Grade": 3,
    "Restricted": 4, "Classified": 5, "Covert": 6, "Extraordinary": 7, "Contraband": 8,
}
SPECIAL = {"knife", "gloves"}


def _page(player_id: str, offset: int) -> dict | None:
    params = {
        "user_id": player_id, "game": "cs2", "limit": PAGE,
        "sort_by": "SORT_FIELD_VALUE", "sort_direction": "SORT_DIRECTION_DESCENDING",
    }
    if offset:
        params["offset"] = offset
    try:
        r = requests.get(URL, params=params, headers=_UA, timeout=15)
    except requests.RequestException:
        return None
    if r.status_code != 200:
        return None
    try:
        body = r.json()
    except ValueError:
        return None
    return body if isinstance(body, dict) else None


def _category(raw: str | None) -> str:
    return (raw or "").replace("INVENTORY_ITEM_TYPE_", "").lower() or "other"


def _shape_item(it: dict) -> dict:
    rarity = it.get("rarity") or {}
    rname = rarity.get("name") or ""
    grade = rarity.get("grade")
    if grade is None:
        grade = RARITY_GRADE.get(rname, 0)

    wear = it.get("wear_rating") or {}
    tier = wear.get("tier") or {}
    meta = it.get("metadata") or {}
    name = meta.get("name") or ""

    def marks(key):
        return [
            {"name": (s.get("name") or "").split(": ", 1)[-1], "icon": s.get("icon_url")}
            for s in it.get(key) or [] if s.get("name")
        ]

    return {
        "id": it.get("id"),
        "name": name,
        "icon": meta.get("icon_url"),
        "category": _category(it.get("category")),
        "rarity": {"name": rname or None, "grade": grade, "color": rarity.get("color")},
        "wear": {
            "value": wear.get("value"),
            "tier": tier.get("name"),
            "color": tier.get("color"),
            "min": (tier.get("interval") or {}).get("minimum", 0),
            "max": (tier.get("interval") or {}).get("maximum"),
        } if wear.get("value") is not None else None,
        "pattern": it.get("pattern_template"),
        "stattrak_kills": it.get("stattrak_kills"),
        "souvenir": name.startswith("Souvenir "),
        "collection": it.get("collection"),
        "stickers": marks("stickers"),
        "charms": marks("charms"),
    }


def _sort_key(i: dict):
    w = (i["wear"] or {}).get("value")
    return (-(i["rarity"]["grade"] or 0), i["category"] not in SPECIAL, w if w is not None else 9)


def _highlights(items: list) -> dict:
    worn = [i for i in items if i["wear"]]
    tracked = [i for i in items if i["stattrak_kills"]]
    return {
        "rarest": items[0] if items else None,
        "lowest_float": min(worn, key=lambda i: i["wear"]["value"]) if worn else None,
        "top_stattrak": max(tracked, key=lambda i: i["stattrak_kills"]) if tracked else None,
    }


def get_inventory(player_id: str, force: bool = False) -> dict:
    if not player_id:
        return {"available": False, "reason": "no_player"}

    key = f"finv:{player_id}"
    if force:
        cache.delete(key)
    else:
        hit = cache.get(key)
        if hit is not None:
            return hit

    raw, totals, updated, truncated, seen = [], {}, None, False, set()
    for n in range(MAX_PAGES):
        body = _page(player_id, n * PAGE)
        if body is None:
            if n == 0:
                result = {"available": False, "reason": "unreachable"}
                cache.set(key, result, FAIL_TTL)
                return result
            truncated = True
            break
        batch = body.get("payload") or []
        fresh = [b for b in batch if b.get("id") not in seen]
        if n > 0 and not fresh:
            truncated = bool(body.get("has_more"))
            break
        seen.update(b.get("id") for b in fresh)
        raw.extend(fresh)
        totals = body.get("skin_rarity_totals") or totals
        updated = body.get("updated_at") or updated
        if not body.get("has_more"):
            break
    else:
        truncated = True

    if not raw:
        result = {"available": False, "reason": "no_data"}
        cache.set(key, result, TTL)
        return result

    items = sorted((_shape_item(r) for r in raw), key=_sort_key)
    total = sum(totals.values()) if totals else len(items)
    by_rarity = sorted(
        ({"name": k, "count": v, "grade": RARITY_GRADE.get(k, 0)} for k, v in totals.items()),
        key=lambda r: -r["grade"],
    )

    result = {
        "available": True,
        "source": "faceit",
        "updated_at": updated,
        "truncated": truncated,
        "counts": {"total": total, "shown": len(items)},
        "rarity_breakdown": by_rarity,
        "highlights": _highlights(items),
        "items": items,
    }
    cache.set(key, result, TTL)
    return result
