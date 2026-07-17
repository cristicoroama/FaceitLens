"""
Leetify public API — demo-based CS2 stats WITHOUT running our own demo worker.

For players who use Leetify, this gives the csrep-style data the FACEIT API and
Steam can't: Premier / FACEIT / Wingman ranks, Leetify skill ratings (aim,
positioning, utility) and detailed aim/utility stats (preaim, reaction time,
spray, opening duels, clutch, flashbang). Players who don't use Leetify return
404 (available: False).

Docs: https://api-public-docs.cs-prod.leetify.com/   base: api-public.cs-prod.leetify.com
Endpoint: GET /v3/profile?steam64_id=<id>

Per Leetify's developer guidelines we:
  - do NOT store their data (short in-memory request cache only, never the DB),
  - display metrics exactly as returned (no rename / rescale — done in the UI),
  - require the caller to show "Data Provided by Leetify" + "View on Leetify".
An optional LEETIFY_API_KEY (from leetify.com/app/developer) raises rate limits.
"""
from __future__ import annotations

import os

import requests
from django.core.cache import cache

BASE = "https://api-public.cs-prod.leetify.com"
_UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
# Leetify rule 6: do not store their data — rely on live data per request. We
# keep only a very short in-memory coalescing window (never the DB) to avoid
# hammering their API. Set LEETIFY_CACHE_TTL=0 for strictly-live behaviour.
CACHE_TTL = int(os.environ.get("LEETIFY_CACHE_TTL", "60"))


def profile_url(steamid: str) -> str:
    return f"https://leetify.com/app/profile/{steamid}"


def _headers() -> dict:
    h = dict(_UA)
    key = os.environ.get("LEETIFY_API_KEY", "")
    if key:
        h["Authorization"] = key
    return h


def _get(url: str, **kwargs) -> requests.Response:
    kwargs.setdefault("headers", _headers())
    kwargs.setdefault("timeout", 15)
    try:
        return requests.get(url, **kwargs)
    except requests.exceptions.SSLError:
        # Same corporate-proxy escape hatch as the Steam layer.
        if os.environ.get("STEAM_INSECURE", "").lower() not in ("1", "true", "yes"):
            raise
        import urllib3
        urllib3.disable_warnings()
        kwargs["verify"] = False
        return requests.get(url, **kwargs)


# Detailed stats we surface. Leetify rule 5: DON'T rename or rescale metrics.
# Their API exposes no display names, so labels here are faithful humanisations
# of the raw field names (no reinterpretation), and values are passed through
# unchanged. Units marked with a trailing "*" are inherent to the metric
# (ms / degrees) — the aim/positioning/utility RATINGS get NO unit (rule 5).
STAT_FIELDS = [
    ("preaim", "Preaim", "°"),
    ("reaction_time_ms", "Reaction Time", "ms"),
    ("spray_accuracy", "Spray Accuracy", "%"),
    ("accuracy_head", "Accuracy (Head)", "%"),
    ("accuracy_enemy_spotted", "Accuracy (Enemy Spotted)", "%"),
    ("counter_strafing_good_shots_ratio", "Counter-Strafing Good Shots Ratio", "%"),
    ("ct_opening_duel_success_percentage", "CT Opening Duel Success Percentage", "%"),
    ("t_opening_duel_success_percentage", "T Opening Duel Success Percentage", "%"),
    ("trade_kills_success_percentage", "Trade Kills Success Percentage", "%"),
    ("traded_deaths_success_percentage", "Traded Deaths Success Percentage", "%"),
    ("flashbang_leading_to_kill", "Flashbang Leading To Kill", ""),
    ("he_foes_damage_avg", "HE Foes Damage (avg)", ""),
    ("utility_on_death_avg", "Utility On Death (avg)", ""),
]


def _shape(data: dict, steamid: str) -> dict:
    ranks = data.get("ranks") or {}
    rating = data.get("rating") or {}
    stats = data.get("stats") or {}

    cards = []
    for key, label, unit in STAT_FIELDS:
        v = stats.get(key)
        if v is None:
            continue
        cards.append({"key": key, "label": label, "value": v, "unit": unit})

    return {
        "available": True,
        "name": data.get("name"),
        "total_matches": data.get("total_matches"),
        "winrate": data.get("winrate"),
        "privacy_mode": data.get("privacy_mode"),
        "ranks": {
            "leetify": ranks.get("leetify"),
            "premier": ranks.get("premier"),
            "faceit": ranks.get("faceit"),
            "faceit_elo": ranks.get("faceit_elo"),
            "wingman": ranks.get("wingman"),
            "competitive": ranks.get("competitive") or [],
        },
        "rating": {
            "aim": rating.get("aim"),
            "positioning": rating.get("positioning"),
            "utility": rating.get("utility"),
        },
        "stats": cards,
        "profile_url": profile_url(steamid),
    }


def get_profile(steamid: str) -> dict:
    """Leetify demo-based profile for a SteamID64, or {available: False}."""
    if not steamid:
        return {"available": False, "reason": "no steamid"}
    cache_key = f"leetify:{steamid}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        r = _get(f"{BASE}/v3/profile", params={"steam64_id": steamid})
    except requests.exceptions.SSLError:
        return {"available": False, "reason": "ssl"}
    except requests.RequestException:
        return {"available": False, "reason": "network"}

    if r.status_code == 404:
        # Player has no Leetify profile.
        result = {"available": False, "reason": "not_on_leetify",
                  "profile_url": profile_url(steamid)}
    elif r.status_code == 429:
        result = {"available": False, "reason": "ratelimited"}
    elif r.status_code != 200:
        result = {"available": False, "reason": f"http{r.status_code}"}
    else:
        try:
            result = _shape(r.json(), steamid)
        except ValueError:
            result = {"available": False, "reason": "badjson"}

    # Cache failures briefly; successes for the short request-cache window.
    cache.set(cache_key, result, CACHE_TTL if result.get("available") else 60)
    return result
