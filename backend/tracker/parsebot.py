"""
HLTV.org data via a parse.bot scraper-as-API.

HLTV has no public API and blocks scraping (Cloudflare), so instead of scraping
it ourselves we hit a parse.bot scraper that exposes HLTV as clean JSON. This
powers the separate "HLTV" section of the app (pro scene: rankings, results,
upcoming matches, team/player stats) — distinct from the FACEIT player search.

The marketplace scraper we target: parse.bot "HLTV.org API" (9 endpoints). Note
it has NO transfers endpoint — transfers stay on the Liquipedia source.

Setup (via environment, nothing sensitive hardcoded):
  PARSE_API_KEY          - your parse.bot API key (sent as X-API-Key). REQUIRED.
  PARSE_HLTV_BASE        - scraper base URL, trailing slash. Defaults to the
                           public marketplace scraper below; override if yours
                           differs (the id changes per scraper).
  PARSE_SNAPSHOT_VERSION - (optional) pins the site-snapshot version so an HLTV
                           layout change can't silently break parsing.

Every endpoint is metered on paid plans, so results are cached hard. Without an
API key each call degrades to {available: False, reason: "not_configured"}.

Docs: https://parse.bot
"""
from __future__ import annotations

import os

import requests
from django.core.cache import cache

DEFAULT_BASE = "https://api.parse.bot/scraper/b3500f47-4f4d-4f28-b85d-7e73293b70d1/"
CACHE_TTL = int(os.environ.get("PARSE_CACHE_TTL", str(15 * 60)))

ATTRIBUTION = {"text": "Data via HLTV.org", "url": "https://www.hltv.org/"}


def _base() -> str:
    b = os.environ.get("PARSE_HLTV_BASE", DEFAULT_BASE)
    return b if b.endswith("/") else b + "/"


def _headers() -> dict:
    h = {"X-API-Key": os.environ.get("PARSE_API_KEY", "")}
    snap = os.environ.get("PARSE_SNAPSHOT_VERSION", "")
    if snap:
        h["API-Snapshot-Version"] = snap
    return h


def _clean(v):
    if isinstance(v, str):
        v = v.strip()
    if v in (None, "", "unknown", "TBD", "-", "N/A"):
        return None
    return v


def _pick(row: dict, *keys):
    for k in keys:
        val = _clean(row.get(k))
        if val is not None:
            return val
    return None


def _rows(payload, *named_keys) -> list:
    """Pull the list out of whatever wrapper the scraper returns."""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in (*named_keys, "data", "results", "items", "rows"):
            val = payload.get(key)
            if isinstance(val, list):
                return val
    return []


def _call(endpoint: str, params: dict | None = None, cache_suffix: str = "") -> dict:
    """
    Shared caller for every HLTV endpoint. Returns
    {available: True, raw: <json>} or {available: False, reason: ...}.
    Individual getters shape `raw` into the fields the frontend needs.
    """
    if not os.environ.get("PARSE_API_KEY", "") or not _base():
        return {"available": False, "reason": "not_configured"}

    cache_key = f"hltv:{endpoint}:{cache_suffix}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    url = f"{_base()}{endpoint}"
    try:
        r = requests.get(url, headers=_headers(), params=params or {}, timeout=30)
    except requests.exceptions.SSLError:
        if os.environ.get("STEAM_INSECURE", "").lower() not in ("1", "true", "yes"):
            return {"available": False, "reason": "ssl"}
        import urllib3
        urllib3.disable_warnings()
        try:
            r = requests.get(url, headers=_headers(), params=params or {},
                             timeout=30, verify=False)
        except requests.RequestException:
            return {"available": False, "reason": "network"}
    except requests.RequestException:
        return {"available": False, "reason": "network"}

    if r.status_code in (401, 403):
        result = {"available": False, "reason": "bad_api_key"}
    elif r.status_code == 404:
        result = {"available": False, "reason": "scraper_not_found"}
    elif r.status_code == 429:
        result = {"available": False, "reason": "ratelimited"}
    elif r.status_code != 200:
        result = {"available": False, "reason": f"http{r.status_code}"}
    else:
        try:
            result = {"available": True, "raw": r.json()}
        except ValueError:
            result = {"available": False, "reason": "badjson"}

    cache.set(cache_key, result, CACHE_TTL if result.get("available") else 120)
    return result


def _wrap(items, ok: dict) -> dict:
    """Attach items + attribution, or pass a failure dict straight through."""
    if not ok.get("available"):
        return {**ok, "attribution": ATTRIBUTION}
    return {"available": True, "items": items, "attribution": ATTRIBUTION}


# --- Public getters -------------------------------------------------------- #

def get_team_rankings(limit: int = 30) -> dict:
    """HLTV world team ranking: rank, team, points."""
    limit = max(1, min(int(limit or 30), 50))
    ok = _call("get_team_rankings", cache_suffix="all")
    if not ok.get("available"):
        return _wrap(None, ok)
    items = []
    for row in _rows(ok["raw"], "rankings", "teams"):
        if not isinstance(row, dict):
            continue
        items.append({
            "rank": _pick(row, "rank", "position"),
            "name": _pick(row, "name", "team"),
            "points": _pick(row, "points", "point"),
            "change": _pick(row, "change", "delta"),
        })
    items = [it for it in items if it["name"]][:limit]
    return _wrap(items, ok)


def get_results(limit: int = 30) -> dict:
    """Recent match results."""
    limit = max(1, min(int(limit or 30), 100))
    ok = _call("get_results", params={"limit": limit}, cache_suffix=str(limit))
    if not ok.get("available"):
        return _wrap(None, ok)
    items = []
    for row in _rows(ok["raw"], "results", "matches"):
        if not isinstance(row, dict):
            continue
        items.append({
            "match_id": _pick(row, "match_id", "id"),
            "date": _pick(row, "date"),
            "team1": _pick(row, "team1", "team_1", "home"),
            "team2": _pick(row, "team2", "team_2", "away"),
            "score": _pick(row, "score", "result"),
            "event": _pick(row, "event", "tournament"),
            "url": _pick(row, "url", "link"),
        })
    items = [it for it in items if it["team1"] or it["team2"]][:limit]
    return _wrap(items, ok)


def get_upcoming(limit: int = 30, filter_cct: bool = False) -> dict:
    """Upcoming scheduled matches."""
    limit = max(1, min(int(limit or 30), 100))
    params = {"limit": limit}
    if filter_cct:
        params["filter_cct"] = "true"
    ok = _call("get_upcoming_matches", params=params,
               cache_suffix=f"{limit}:{filter_cct}")
    if not ok.get("available"):
        return _wrap(None, ok)
    items = []
    for row in _rows(ok["raw"], "matches", "upcoming"):
        if not isinstance(row, dict):
            continue
        items.append({
            "status": _pick(row, "status"),
            "date": _pick(row, "date"),
            "time": _pick(row, "time"),
            "team1": _pick(row, "team1", "team_1", "home"),
            "team2": _pick(row, "team2", "team_2", "away"),
            "event": _pick(row, "event", "tournament"),
            "url": _pick(row, "url", "link"),
        })
    return _wrap(items[:limit], ok)


def get_team_stats(days: int = 30, limit: int = 30) -> dict:
    """Team performance stats over a time window."""
    days = max(1, min(int(days or 30), 365))
    limit = max(1, min(int(limit or 30), 100))
    ok = _call("get_team_stats", params={"days": days, "limit": limit},
               cache_suffix=f"{days}:{limit}")
    if not ok.get("available"):
        return _wrap(None, ok)
    items = []
    for row in _rows(ok["raw"], "teams", "stats"):
        if not isinstance(row, dict):
            continue
        items.append({
            "team_id": _pick(row, "team_id", "id"),
            "name": _pick(row, "name", "team"),
            "maps": _pick(row, "maps"),
            "kd_diff": _pick(row, "kd_diff", "kddiff"),
            "kd": _pick(row, "kd"),
            "rating": _pick(row, "rating"),
        })
    items = [it for it in items if it["name"]][:limit]
    return _wrap(items, ok)


def get_player_stats(days: int = 30, limit: int = 30) -> dict:
    """Player performance stats over a time window (browse/search players)."""
    days = max(1, min(int(days or 30), 365))
    limit = max(1, min(int(limit or 30), 100))
    ok = _call("get_player_stats", params={"days": days, "limit": limit},
               cache_suffix=f"{days}:{limit}")
    if not ok.get("available"):
        return _wrap(None, ok)
    items = []
    for row in _rows(ok["raw"], "players", "stats"):
        if not isinstance(row, dict):
            continue
        items.append({
            "player_id": _pick(row, "player_id", "id"),
            "name": _pick(row, "name", "nickname"),
            "team": _pick(row, "team"),
            "maps": _pick(row, "maps"),
            "rounds": _pick(row, "rounds"),
            "kd_diff": _pick(row, "kd_diff", "kddiff"),
            "kd": _pick(row, "kd"),
            "rating": _pick(row, "rating"),
        })
    items = [it for it in items if it["name"]][:limit]
    return _wrap(items, ok)
