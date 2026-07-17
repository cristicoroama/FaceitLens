"""
Steam profile extras that DON'T need a demo worker: Steam level, CS2 inventory
(skins), medals / coins / collectibles, stickers — the showcase data csrep.gg
and friends put on a profile.

Sources (all public, no Steam API key required):
  - level   : scraped from the public profile page
  - inventory: https://steamcommunity.com/inventory/<id>/730/2  (public JSON)

A STEAM_API_KEY, if present, is only used as a cleaner fallback for the level.
Everything degrades gracefully when the inventory is private.
"""
from __future__ import annotations

import os
import re

import requests
from django.core.cache import cache

STEAM_CDN = "https://community.cloudflare.steamstatic.com/economy/image/"
_UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}


def _insecure() -> bool:
    """
    True if STEAM_INSECURE is set — an escape hatch for machines behind an
    SSL-inspecting corporate proxy whose root CA isn't in Python's certifi
    bundle (there, requests raises SSLError while browsers/curl work fine).
    """
    return os.environ.get("STEAM_INSECURE", "").lower() in ("1", "true", "yes")


def _get(url: str, **kwargs) -> requests.Response:
    """GET Steam with browser-ish headers, retrying without TLS verification
    only when STEAM_INSECURE is explicitly enabled. Raises on network errors."""
    kwargs.setdefault("headers", _UA)
    kwargs.setdefault("timeout", 15)
    try:
        return requests.get(url, **kwargs)
    except requests.exceptions.SSLError:
        if not _insecure():
            raise
        import urllib3
        urllib3.disable_warnings()
        kwargs["verify"] = False
        return requests.get(url, **kwargs)


# --- Global rate-limit backoff -------------------------------------------- #
# Steam rate-limits the community endpoints hard, per-IP. When we get a 429 we
# stop hitting Steam for everyone for a while so the IP's limit can recover,
# instead of hammering and extending the block.
_COOLDOWN_KEY = "steam_cooldown"
_COOLDOWN_SECONDS = int(os.environ.get("STEAM_COOLDOWN", "600"))


def _cooldown_active() -> bool:
    return cache.get(_COOLDOWN_KEY) is not None


def _trip_cooldown() -> None:
    cache.set(_COOLDOWN_KEY, True, _COOLDOWN_SECONDS)

# CS2 skin rarity, best first — used to sort/highlight the inventory.
RARITY_ORDER = [
    "Contraband", "Covert", "Classified", "Restricted", "Mil-Spec Grade",
    "Industrial Grade", "Consumer Grade", "Extraordinary", "Remarkable",
    "Exotic", "High Grade", "Base Grade",
]
_RARITY_RANK = {r: i for i, r in enumerate(RARITY_ORDER)}

# Types we group as wearable weapon skins.
WEAPON_TYPES = {
    "Rifle", "Pistol", "SMG", "Sniper Rifle", "Machinegun", "Shotgun",
}


def _img(icon_url: str, size: str = "360fx360f") -> str | None:
    if not icon_url:
        return None
    return f"{STEAM_CDN}{icon_url}/{size}"


def clear_cooldown() -> None:
    cache.delete(_COOLDOWN_KEY)


def resolve_steamid(raw: str) -> str | None:
    """
    Turn any user input into a SteamID64: a bare 17-digit id, a /profiles/ URL,
    a /id/<vanity> URL, or a bare vanity name (vanity needs STEAM_API_KEY).
    """
    m = re.search(r"(7656\d{13})", raw or "")
    if m:
        return m.group(1)

    name = None
    m = re.search(r"steamcommunity\.com/id/([\w.\-]+)", raw or "")
    if m:
        name = m.group(1)
    elif raw and re.fullmatch(r"[\w.\-]{2,32}", raw.strip()):
        name = raw.strip()
    if not name:
        return None

    key = os.environ.get("STEAM_API_KEY", "")
    if not key:
        return None
    try:
        r = _get(
            "https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/",
            params={"key": key, "vanityurl": name}, timeout=10,
        )
        resp = r.json().get("response", {})
        if resp.get("success") == 1:
            return resp.get("steamid")
    except (requests.RequestException, ValueError):
        pass
    return None


def get_steam_level(steamid: str, force: bool = False) -> int | None:
    """Public Steam level. Tries the Web API (if key set) then scrapes the page."""
    key = os.environ.get("STEAM_API_KEY", "")
    if key:
        try:
            r = _get(
                "https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/",
                params={"key": key, "steamid": steamid}, timeout=10,
            )
            lvl = r.json().get("response", {}).get("player_level")
            if lvl is not None:
                return int(lvl)
        except (requests.RequestException, ValueError, TypeError):
            pass
    # Fallback: scrape the public profile page (skip during a Steam cooldown so
    # we don't add load to an already rate-limited IP, unless forced).
    if _cooldown_active() and not force:
        return None
    try:
        r = _get(f"https://steamcommunity.com/profiles/{steamid}/", timeout=12)
        if r.status_code == 429:
            _trip_cooldown()
            return None
        m = re.search(r'friendPlayerLevelNum">(\d+)', r.text)
        if m:
            return int(m.group(1))
    except requests.RequestException:
        pass
    return None


def _classify(descriptions: list) -> dict:
    """
    Pure: turn raw inventory `descriptions` into a tidy showcase.
    Split into weapons / knife+gloves / medals / stickers / graffiti / other,
    each with image + rarity so the UI can render a csrep-style grid.
    """
    weapons, special, medals, stickers, graffiti, other = [], [], [], [], [], []

    for d in descriptions:
        tags = {t.get("category"): t.get("localized_tag_name") for t in d.get("tags", [])}
        typ = tags.get("Type") or ""
        rarity = tags.get("Rarity") or tags.get("Quality") or ""
        name = d.get("market_hash_name") or d.get("name") or ""
        item = {
            "name": name,
            "type": typ,
            "rarity": rarity,
            "color": ("#" + d["name_color"]) if d.get("name_color") else None,
            "image": _img(d.get("icon_url", "")),
            "marketable": bool(d.get("marketable")),
            "rank": _RARITY_RANK.get(rarity, 99),
        }
        # In CS2 every medal / coin / event pin / badge is type "Collectible".
        if typ == "Collectible":
            medals.append(item)
        elif typ in ("Knife", "Gloves") or name.startswith("★"):
            special.append(item)
        elif typ in WEAPON_TYPES:
            weapons.append(item)
        elif typ == "Sticker":
            stickers.append(item)
        elif typ == "Graffiti":
            graffiti.append(item)
        else:
            other.append(item)

    weapons.sort(key=lambda x: x["rank"])
    special.sort(key=lambda x: x["rank"])

    return {
        "special": special,          # knives + gloves (the flex items)
        "weapons": weapons,          # skins, best rarity first
        "medals": medals,            # service medals, event coins, pins
        "counts": {
            "total": len(descriptions),
            "weapons": len(weapons),
            "special": len(special),
            "medals": len(medals),
            "stickers": len(stickers),
            "graffiti": len(graffiti),
            "other": len(other),
        },
    }


def _fetch_inventory(steamid: str) -> dict:
    """One shot at the Steam inventory endpoint, with a diagnostic `reason`."""
    url = f"https://steamcommunity.com/inventory/{steamid}/730/2"
    headers = {**_UA, "Referer": f"https://steamcommunity.com/profiles/{steamid}/inventory/"}
    try:
        r = _get(url, params={"l": "english", "count": 500}, headers=headers)
    except requests.exceptions.SSLError:
        # Corporate SSL-inspecting proxy — set STEAM_INSECURE=1 to bypass.
        return {"available": False, "reason": "ssl"}
    except requests.RequestException:
        return {"available": False, "reason": "network"}

    if r.status_code == 403:
        return {"available": False, "private": True, "reason": "private"}
    if r.status_code == 429:
        _trip_cooldown()  # back off globally so we stop hammering Steam
        return {"available": False, "reason": "ratelimited"}
    if r.status_code != 200:
        return {"available": False, "reason": f"http{r.status_code}"}

    try:
        data = r.json()
    except ValueError:
        return {"available": False, "reason": "badjson"}
    if not data:  # Steam returns literal `null` when throttling
        return {"available": False, "reason": "throttled"}
    descriptions = data.get("descriptions") or []
    if not descriptions:
        # 200 with no items → empty or private-ish inventory
        return {"available": False, "private": True, "reason": "empty"}
    return {"available": True, **_classify(descriptions)}


# --- steamwebapi.com proxy (optional) -------------------------------------- #
# A paid buffering proxy for Steam data. When STEAMWEBAPI_KEY is set we prefer
# it for inventories: it dodges Steam's datacenter-IP rate limits (the thing
# that breaks inventory on Render) AND returns market prices, which powers the
# inventory value ($) display. Docs: https://www.steamwebapi.com/steam-inventory-api
_PROXY_URL = "https://www.steamwebapi.com/steam/api/inventory"


def _price_of(d: dict):
    for k in ("pricelatest", "pricereal", "priceavg", "pricemedian", "pricemin"):
        v = d.get(k)
        if isinstance(v, (int, float)) and v > 0:
            return float(v)
    return None


def _classify_proxy(items: list) -> dict:
    """
    Adapter: steamwebapi returns a flat item list (not Steam's descriptions
    format), with field names that vary by item kind — so classify defensively
    from whatever type/rarity fields exist, falling back to name patterns.
    Also sums market prices into a total inventory value.
    """
    weapons, special, medals, stickers, graffiti, other = [], [], [], [], [], []
    total_value = 0.0
    priced = 0

    for d in items:
        name = d.get("markethashname") or d.get("marketname") or d.get("itemname") or ""
        typ = (d.get("itemgroup") or d.get("itemtype") or d.get("type") or "").strip()
        rarity = (d.get("rarity") or d.get("rarityname") or "").strip().title()
        color = d.get("raritycolor") or d.get("color") or d.get("namecolor")
        if color and not str(color).startswith("#"):
            color = f"#{color}"
        price = _price_of(d)
        if price is not None:
            total_value += price
            priced += 1

        item = {
            "name": name,
            "type": typ,
            "rarity": rarity,
            "color": color,
            "image": d.get("image") or d.get("imageurl"),
            "marketable": bool(d.get("marketable", d.get("tradable"))),
            "rank": _RARITY_RANK.get(rarity, 99),
            "price": price,
        }

        low = name.lower()
        tl = typ.lower()
        if name.startswith("★") or tl in ("knife", "gloves"):
            special.append(item)
        elif low.startswith("sticker") or tl == "sticker":
            stickers.append(item)
        elif "graffiti" in low or tl == "graffiti":
            graffiti.append(item)
        elif tl == "collectible" or any(
            k in low for k in ("medal", " coin", "coin ", "badge", "trophy", "service medal", "years of service")
        ) or low.endswith("coin"):
            medals.append(item)
        elif low.startswith(("music kit", "patch", "charm")) or tl in ("music kit", "patch", "charm", "agent", "container", "key"):
            other.append(item)
        elif " | " in name or tl in ("rifle", "pistol", "smg", "sniper rifle", "machinegun", "shotgun", "weapon", "equipment"):
            weapons.append(item)
        else:
            other.append(item)

    weapons.sort(key=lambda x: (x["rank"], -(x["price"] or 0)))
    special.sort(key=lambda x: (x["rank"], -(x["price"] or 0)))

    return {
        "special": special,
        "weapons": weapons,
        "medals": medals,
        "value": {"total": round(total_value, 2), "priced_items": priced, "currency": "USD"},
        "counts": {
            "total": len(items),
            "weapons": len(weapons),
            "special": len(special),
            "medals": len(medals),
            "stickers": len(stickers),
            "graffiti": len(graffiti),
            "other": len(other),
        },
    }


def _fetch_inventory_proxy(steamid: str) -> dict:
    """One shot at the steamwebapi.com inventory proxy."""
    key = os.environ.get("STEAMWEBAPI_KEY", "")
    try:
        r = _get(_PROXY_URL, params={"key": key, "steam_id": steamid, "game": "cs2"},
                 timeout=30)
    except requests.RequestException:
        return {"available": False, "reason": "network"}
    if r.status_code in (401, 403):
        return {"available": False, "reason": "proxy_auth"}
    if r.status_code == 404:
        return {"available": False, "private": True, "reason": "private"}
    if r.status_code == 429:
        return {"available": False, "reason": "proxy_quota"}
    if r.status_code != 200:
        return {"available": False, "reason": f"proxyhttp{r.status_code}"}
    try:
        items = r.json()
    except ValueError:
        return {"available": False, "reason": "badjson"}
    if isinstance(items, dict):  # error payloads come back as objects
        items = items.get("items") or []
    if not isinstance(items, list) or not items:
        return {"available": False, "private": True, "reason": "empty"}
    return {"available": True, **_classify_proxy(items)}


def get_inventory(steamid: str, force: bool = False) -> dict:
    """
    Fetch + classify a player's CS2 inventory.
    Prefers the steamwebapi.com proxy when STEAMWEBAPI_KEY is set (reliable from
    datacenter IPs + market prices); falls back to Steam's community endpoint.
    Success is cached 6 h; failures only 60 s. `force=True` bypasses cache +
    cooldown for a manual retry.
    """
    if not steamid:
        return {"available": False, "reason": "no steamid"}
    cache_key = f"inv:{steamid}"

    if force:
        cache.delete(cache_key)
        clear_cooldown()
    else:
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

    result = None
    if os.environ.get("STEAMWEBAPI_KEY", ""):
        result = _fetch_inventory_proxy(steamid)
        if result.get("available") or result.get("private"):
            cache.set(cache_key, result, 6 * 60 * 60 if result.get("available") else 60)
            return result

    # Direct Steam community endpoint (respect the global 429 cooldown).
    if _cooldown_active() and not force:
        direct = {"available": False, "reason": "ratelimited"}
    else:
        direct = _fetch_inventory(steamid)

    # Prefer whichever attempt actually produced data.
    final = direct if (direct.get("available") or result is None) else result
    ttl = 6 * 60 * 60 if final.get("available") else 60
    cache.set(cache_key, final, ttl)
    return final


def get_collectibles(steamid: str, force: bool = False) -> dict:
    """Level + inventory showcase in one call (what the profile tab needs)."""
    return {
        "steam_level": get_steam_level(steamid, force=force),
        "inventory": get_inventory(steamid, force=force),
    }
