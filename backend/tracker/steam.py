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


def get_steam_level(steamid: str) -> int | None:
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
    # we don't add load to an already rate-limited IP).
    if _cooldown_active():
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


def get_inventory(steamid: str) -> dict:
    """
    Fetch + classify a player's CS2 inventory.
    Success is cached 30 min; failures only 60 s so transient Steam errors
    (rate limits, throttling) recover quickly instead of sticking.
    Returns {available: bool, private?, reason?, special, weapons, medals, counts}.
    """
    if not steamid:
        return {"available": False, "reason": "no steamid"}
    cache_key = f"inv:{steamid}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    # Global backoff: if Steam recently 429'd us, don't hit it again — just tell
    # the user to wait, so the per-IP limit can reset.
    if _cooldown_active():
        return {"available": False, "reason": "ratelimited"}

    result = _fetch_inventory(steamid)
    # Inventories rarely change, so cache success for hours; cache failures only
    # briefly (the global cooldown handles rate-limit backoff separately).
    ttl = 6 * 60 * 60 if result.get("available") else 60
    cache.set(cache_key, result, ttl)
    return result


def get_collectibles(steamid: str) -> dict:
    """Level + inventory showcase in one call (what the profile tab needs)."""
    return {
        "steam_level": get_steam_level(steamid),
        "inventory": get_inventory(steamid),
    }
