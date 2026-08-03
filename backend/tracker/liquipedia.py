"""
Liquipedia LPDB v3 API — pro-scene roster moves (player transfers) for CS2.

This powers the "Transfers" page: who joined / left / benched which org, with
dates and roles — the data HLTV shows but exposes NO public API for.

Why Liquipedia and not HLTV:
  - HLTV has no official API and blocks scraping (Cloudflare) — fragile + ToS.
  - Liquipedia maintains a structured `transfer` data type in its LPDB and
    offers a documented REST API for it.

Auth & limits (https://liquipedia.net/api-terms-of-use):
  - Needs an API key sent as `Authorization: Apikey <key>`. Keys are free for
    community / non-commercial open-source projects — request one via their
    contact form / Discord. Set it as LIQUIPEDIA_API_KEY.
  - Hard rate limit: 60 requests / hour. We cache aggressively (30 min) and
    the API must send a descriptive User-Agent with contact info.
  - Results are CC-BY-SA: the UI must credit Liquipedia and link back.

Without the key set, every call degrades gracefully to
{available: False, reason: "no_api_key"} so the rest of the app is unaffected.

Docs: https://liquipedia.net/api  |  Data type: transfer
"""
from __future__ import annotations

import os

import requests
from django.core.cache import cache

from . import useragent

BASE = "https://api.liquipedia.net/api/v3"
WIKI = "counterstrike"

# 60 req/h ceiling → cache hard. Successes 30 min, failures 2 min.
CACHE_TTL = int(os.environ.get("LIQUIPEDIA_CACHE_TTL", str(30 * 60)))

# Terms require a descriptive UA identifying the app + a contact address —
# which is now the shared default for every outbound call.
_UA = useragent.HEADERS

ATTRIBUTION = {
    "text": "Data provided by Liquipedia (CC-BY-SA 3.0)",
    "url": f"https://liquipedia.net/{WIKI}/Portal:Transfers",
}


def _headers() -> dict:
    key = os.environ.get("LIQUIPEDIA_API_KEY", "")
    h = dict(_UA)
    if key:
        h["Authorization"] = f"Apikey {key}"
    return h


def _clean(v):
    """Liquipedia stores 'unknown'/empty values as sentinel strings; hide them."""
    if v in (None, "", "unknown", "TBD", "-"):
        return None
    return v


def _shape(row: dict) -> dict:
    """Normalise one LPDB transfer row into a tidy, frontend-friendly dict.

    Field names follow the LPDB `transfer` data type. We read defensively
    (several aliases) so a schema tweak on their side doesn't blank the page.
    """
    def pick(*keys):
        for k in keys:
            val = _clean(row.get(k))
            if val is not None:
                return val
        return None

    from_team = pick("fromteam", "from_team", "fromTeam")
    to_team = pick("toteam", "to_team", "toTeam")

    return {
        "player": pick("player", "name"),
        "flag": pick("flag", "nationality"),
        "date": pick("date"),
        "from_team": from_team,
        "to_team": to_team,
        "role_from": pick("role1", "fromrole", "role_from"),
        "role_to": pick("role2", "torole", "role_to"),
        # A move with no destination org == leaving/benched; no source == joining.
        "kind": (
            "join" if not from_team and to_team
            else "leave" if from_team and not to_team
            else "move"
        ),
    }


def get_transfers(limit: int = 40) -> dict:
    """
    Most recent CS2 roster moves from Liquipedia's LPDB.
    Returns {available, items, attribution} or {available: False, reason}.
    Cached to respect the 60 req/hour ceiling.
    """
    limit = max(1, min(int(limit or 40), 100))

    if not os.environ.get("LIQUIPEDIA_API_KEY", ""):
        return {"available": False, "reason": "no_api_key",
                "attribution": ATTRIBUTION}

    cache_key = f"lp:transfers:{limit}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        r = requests.get(
            f"{BASE}/transfer",
            headers=_headers(),
            params={"wiki": WIKI, "limit": limit, "order": "date DESC"},
            timeout=15,
        )
    except requests.exceptions.SSLError:
        # Same corporate-proxy escape hatch as the Steam/Leetify layers.
        if os.environ.get("STEAM_INSECURE", "").lower() not in ("1", "true", "yes"):
            return {"available": False, "reason": "ssl", "attribution": ATTRIBUTION}
        import urllib3
        urllib3.disable_warnings()
        try:
            r = requests.get(
                f"{BASE}/transfer", headers=_headers(),
                params={"wiki": WIKI, "limit": limit, "order": "date DESC"},
                timeout=15, verify=False,
            )
        except requests.RequestException:
            return {"available": False, "reason": "network", "attribution": ATTRIBUTION}
    except requests.RequestException:
        return {"available": False, "reason": "network", "attribution": ATTRIBUTION}

    if r.status_code in (401, 403):
        result = {"available": False, "reason": "bad_api_key"}
    elif r.status_code == 429:
        result = {"available": False, "reason": "ratelimited"}
    elif r.status_code != 200:
        result = {"available": False, "reason": f"http{r.status_code}"}
    else:
        try:
            payload = r.json()
        except ValueError:
            result = {"available": False, "reason": "badjson"}
        else:
            # LPDB v3 returns the rows under "result" (some wrappers use "results").
            rows = payload.get("result") or payload.get("results") or []
            items = [_shape(row) for row in rows if isinstance(row, dict)]
            items = [it for it in items if it["player"]]
            result = {"available": True, "items": items}

    result["attribution"] = ATTRIBUTION
    cache.set(cache_key, result, CACHE_TTL if result.get("available") else 120)
    return result
