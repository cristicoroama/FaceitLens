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
import re

import requests
from django.core.cache import cache

# Our own fork of the canonical "hltv.org API" scraper — it carries the full
# endpoint set including get_player_details / get_team_details, which the shared
# canonical scraper (b3500f47…) doesn't have until revisions propagate upstream.
# Override via PARSE_HLTV_BASE if the scraper id ever changes.
DEFAULT_BASE = "https://api.parse.bot/scraper/a15961de-b6e8-4300-aacc-635fad2505af/"
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
    """Pull the list out of parse.bot's wrapper.

    parse.bot returns {"status": "success", "data": {"<key>": [...]}}, so we
    unwrap "data" first, then look for the endpoint's named list (rankings,
    results, players, ...). Also tolerates a bare list or a data-is-list shape.
    """
    if isinstance(payload, dict) and isinstance(payload.get("data"), (dict, list)):
        payload = payload["data"]
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in (*named_keys, "rankings", "results", "matches",
                    "players", "teams", "items", "rows"):
            val = payload.get(key)
            if isinstance(val, list):
                return val
    return []


def _num(v):
    """Extract the first number out of a noisy string like '(897 HLTV points)'."""
    if v is None:
        return None
    m = re.search(r"-?\d+(?:\.\d+)?", str(v))
    return m.group(0) if m else v


def _team_logo(row, prefix=""):
    """Best-effort logo/image URL for a team row.

    Reads defensively: the parse.bot scraper only returns a logo once it's been
    revised to extract the <img src>. `prefix` handles per-side keys in
    two-team rows, e.g. team1_logo / team2_logo. Returns None until then.
    """
    bases = ("logo", "logo_url", "image", "image_url", "img", "src")
    if prefix:
        # Per-side keys only — never fall back to a bare "logo" or we'd put the
        # same image on both teams. team1 -> team1_logo, logo_team1, logo1, ...
        keys = [f"{prefix}_{b}" for b in bases]
        keys += [f"{b}_{prefix}" for b in ("logo", "image")]
        keys += [f"{b}{prefix[-1]}" for b in ("logo", "image")]  # logo1 / image2
        return _pick(row, *keys)
    return _pick(row, *bases, "team_logo")


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
            "name": _pick(row, "team", "name"),
            "points": _num(_pick(row, "points", "point")),
            "change": _pick(row, "change", "delta"),
            "logo": _team_logo(row),
            "team_url": _pick(row, "team_url", "url", "link"),
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
            "team1_logo": _team_logo(row, "team1"),
            "team2_logo": _team_logo(row, "team2"),
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
            "team1_logo": _team_logo(row, "team1"),
            "team2_logo": _team_logo(row, "team2"),
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
            "logo": _team_logo(row),
            "team_url": _pick(row, "team_url", "url", "link"),
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
            "logo": _pick(row, "logo", "image", "img", "photo", "avatar",
                          "player_image", "picture", "src"),
            "team_logo": _team_logo(row, "team"),
            "player_url": _pick(row, "player_url", "url", "link"),
        })
    items = [it for it in items if it["name"]][:limit]
    return _wrap(items, ok)


def _obj(payload) -> dict:
    """Unwrap parse.bot's {status, data:{...}} to the inner object."""
    if isinstance(payload, dict):
        d = payload.get("data")
        if isinstance(d, dict):
            return d
        return payload
    return {}


def get_team_details(team_url: str | None = None, team_id: str | None = None) -> dict:
    """One team's page: name, logo, world ranking, and its player roster."""
    if not team_url and not team_id:
        return {"available": False, "reason": "no_team", "attribution": ATTRIBUTION}
    params = {}
    if team_url:
        params["team_url"] = team_url
    if team_id:
        params["team_id"] = team_id
    ok = _call("get_team_details", params=params,
               cache_suffix=team_url or str(team_id))
    if not ok.get("available"):
        return {**ok, "attribution": ATTRIBUTION}

    d = _obj(ok["raw"])
    roster = []
    for p in (d.get("roster") or d.get("players") or []):
        if not isinstance(p, dict):
            continue
        roster.append({
            "name": _pick(p, "name", "nickname"),
            "player_url": _pick(p, "player_url", "url", "link"),
            "player_id": _pick(p, "player_id", "id"),
            "photo": _pick(p, "photo", "image", "img", "picture", "src"),
            "country": _pick(p, "country", "nationality", "flag"),
        })
    roster = [p for p in roster if p["name"]]
    return {
        "available": True,
        "name": _pick(d, "name", "team"),
        "logo": _team_logo(d),
        "world_ranking": _num(_pick(d, "world_ranking", "ranking", "rank")),
        "roster": roster,
        "attribution": ATTRIBUTION,
    }


def get_player_details(player_url: str | None = None, player_id: str | None = None) -> dict:
    """One player's profile: photo, country, age, team, HLTV rating 2.0, etc."""
    if not player_url and not player_id:
        return {"available": False, "reason": "no_player", "attribution": ATTRIBUTION}
    params = {}
    if player_url:
        params["player_url"] = player_url
    if player_id:
        params["player_id"] = player_id
    ok = _call("get_player_details", params=params,
               cache_suffix=player_url or str(player_id))
    if not ok.get("available"):
        return {**ok, "attribution": ATTRIBUTION}

    d = _obj(ok["raw"])
    return {
        "available": True,
        "name": _pick(d, "name", "nickname"),
        "real_name": _pick(d, "real_name", "realname", "full_name"),
        "photo": _pick(d, "photo", "image", "img", "picture", "bodyshot", "src"),
        "country": _pick(d, "country", "nationality"),
        "flag": _pick(d, "flag", "country_flag"),
        "age": _pick(d, "age"),
        "team": _pick(d, "current_team", "team"),
        "team_logo": _team_logo(d, "team") or _pick(d, "team_logo"),
        "rating": _pick(d, "rating_2_0", "rating_2", "rating2_0", "rating"),
        "maps": _pick(d, "maps_played", "maps"),
        "kd": _pick(d, "kd", "kd_ratio"),
        "hs": _pick(d, "headshot_pct", "headshots", "hs"),
        "attribution": ATTRIBUTION,
    }
