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
            r = requests.get(
                "https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/",
                params={"key": key, "steamid": steamid}, timeout=10,
            )
            lvl = r.json().get("response", {}).get("player_level")
            if lvl is not None:
                return int(lvl)
        except (requests.RequestException, ValueError, TypeError):
            pass
    # Fallback: scrape the public profile page.
    try:
        r = requests.get(f"https://steamcommunity.com/profiles/{steamid}/",
                         headers=_UA, timeout=12)
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


def get_inventory(steamid: str) -> dict:
    """
    Fetch + classify a player's CS2 inventory. Cached 30 min.
    Returns {available: bool, private?: bool, special, weapons, medals, counts}.
    """
    if not steamid:
        return {"available": False}
    cache_key = f"inv:{steamid}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    result: dict
    try:
        r = requests.get(
            f"https://steamcommunity.com/inventory/{steamid}/730/2",
            params={"l": "english", "count": 500}, headers=_UA, timeout=15,
        )
        if r.status_code == 403:
            result = {"available": False, "private": True}
        else:
            r.raise_for_status()
            data = r.json() or {}
            descriptions = data.get("descriptions") or []
            if not descriptions:
                result = {"available": False, "private": True}
            else:
                result = {"available": True, **_classify(descriptions)}
    except (requests.RequestException, ValueError):
        result = {"available": False}

    cache.set(cache_key, result, 30 * 60)
    return result


def get_collectibles(steamid: str) -> dict:
    """Level + inventory showcase in one call (what the profile tab needs)."""
    return {
        "steam_level": get_steam_level(steamid),
        "inventory": get_inventory(steamid),
    }
