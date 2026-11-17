"""
Steam profile extras that don't need a demo worker: the Steam level, and
turning user input into a SteamID64.

The CS2 inventory used to live here, scraped from Steam and priced through the
paid steamwebapi.com proxy. It now comes from FACEIT — see faceit_inventory.

A STEAM_API_KEY, if present, is used for the level and for vanity URLs.
"""
from __future__ import annotations

import os
import re

import requests
from django.core.cache import cache

from .useragent import HEADERS as _UA

def _insecure() -> bool:
    """
    True if STEAM_INSECURE is set — an escape hatch for machines behind an
    SSL-inspecting corporate proxy whose root CA isn't in Python's certifi
    bundle (there, requests raises SSLError while browsers/curl work fine).
    """
    return os.environ.get("STEAM_INSECURE", "").lower() in ("1", "true", "yes")


def _get(url: str, **kwargs) -> requests.Response:
    """GET Steam identifying ourselves honestly, retrying without TLS
    verification only when STEAM_INSECURE is explicitly enabled. Raises on
    network errors."""
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
