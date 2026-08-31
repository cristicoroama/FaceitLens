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
import urllib.parse

import requests
from django.core.cache import cache

from .useragent import HEADERS as _UA

BASE = "https://api-public.cs-prod.leetify.com"
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
#
# Grouped so the UI can lay them out sensibly. The group name is ours (it's
# presentation, not a metric); every label is a faithful humanisation of the
# raw field name and every value is passed through untouched.
STAT_FIELDS = [
    # (key, label, unit, group)
    ("preaim", "Preaim", "°", "aim"),
    ("reaction_time_ms", "Reaction Time", "ms", "aim"),
    ("spray_accuracy", "Spray Accuracy", "%", "aim"),
    ("accuracy_head", "Accuracy (Head)", "%", "aim"),
    ("accuracy_enemy_spotted", "Accuracy (Enemy Spotted)", "%", "aim"),
    ("counter_strafing_good_shots_ratio", "Counter-Strafing Good Shots Ratio", "%", "aim"),

    ("ct_opening_duel_success_percentage", "CT Opening Duel Success Percentage", "%", "duels"),
    ("t_opening_duel_success_percentage", "T Opening Duel Success Percentage", "%", "duels"),
    ("ct_opening_aggression_success_rate", "CT Opening Aggression Success Rate", "%", "duels"),
    ("t_opening_aggression_success_rate", "T Opening Aggression Success Rate", "%", "duels"),

    ("trade_kills_success_percentage", "Trade Kills Success Percentage", "%", "trading"),
    ("traded_deaths_success_percentage", "Traded Deaths Success Percentage", "%", "trading"),
    ("trade_kill_opportunities_per_round", "Trade Kill Opportunities Per Round", "", "trading"),

    ("flashbang_thrown", "Flashbang Thrown", "", "utility"),
    ("flashbang_leading_to_kill", "Flashbang Leading To Kill", "", "utility"),
    ("flashbang_hit_foe_per_flashbang", "Flashbang Hit Foe Per Flashbang", "", "utility"),
    ("flashbang_hit_foe_avg_duration", "Flashbang Hit Foe Avg Duration", "s", "utility"),
    ("flashbang_hit_friend_per_flashbang", "Flashbang Hit Friend Per Flashbang", "", "utility"),
    ("he_foes_damage_avg", "HE Foes Damage (avg)", "", "utility"),
    ("he_friends_damage_avg", "HE Friends Damage (avg)", "", "utility"),
    ("utility_on_death_avg", "Utility On Death (avg)", "", "utility"),
]

STAT_GROUPS = [
    ("aim", "Aim"),
    ("duels", "Opening Duels"),
    ("trading", "Trading"),
    ("utility", "Utility"),
]

# All seven ratings Leetify exposes. The first three are 0-100 skill ratings;
# the last four are impact figures centred on zero. Passed through as-is.
RATING_FIELDS = [
    ("aim", "Aim"),
    ("positioning", "Positioning"),
    ("utility", "Utility"),
    ("clutch", "Clutch"),
    ("opening", "Opening"),
    ("ct_leetify", "CT Leetify"),
    ("t_leetify", "T Leetify"),
]


def _first(src: dict, *keys):
    """First key present with a non-null value, or None.

    For fields we know exist in the upstream product but whose exact name in
    the API we haven't confirmed. Guessing one name and getting it wrong fails
    silently; trying the plausible ones costs nothing and the wrong guesses
    simply never match.
    """
    for k in keys:
        v = (src or {}).get(k)
        if v is not None:
            return v
    return None


def _shape(data: dict, steamid: str) -> dict:
    ranks = data.get("ranks") or {}
    rating = data.get("rating") or {}
    stats = data.get("stats") or {}

    cards = []
    for key, label, unit, group in STAT_FIELDS:
        v = stats.get(key)
        if v is None:
            continue
        cards.append({"key": key, "label": label, "value": v,
                      "unit": unit, "group": group})

    ratings = [
        {"key": k, "label": label, "value": rating.get(k)}
        for k, label in RATING_FIELDS
        if rating.get(k) is not None
    ]

    # Cross-platform bans, with the nickname the player carried at the time.
    # A ban under a different name is the single strongest smurf signal we
    # can get anywhere, so it's worth surfacing prominently.
    bans = [
        {
            "platform": b.get("platform"),
            "nickname": b.get("platform_nickname"),
            "banned_since": b.get("banned_since"),
        }
        for b in (data.get("bans") or [])
        if b.get("platform")
    ]

    recent = [
        {
            "id": m.get("id"),
            "finished_at": m.get("finished_at"),
            "data_source": m.get("data_source"),
            "outcome": m.get("outcome"),
            "map_name": m.get("map_name"),
            "score": m.get("score") or [],
            "leetify_rating": m.get("leetify_rating"),
            "preaim": m.get("preaim"),
            "reaction_time_ms": m.get("reaction_time_ms"),
            "accuracy_head": m.get("accuracy_head"),
            "accuracy_enemy_spotted": m.get("accuracy_enemy_spotted"),
            "spray_accuracy": m.get("spray_accuracy"),
            "rank": m.get("rank"),
            "rank_type": m.get("rank_type"),
        }
        for m in (data.get("recent_matches") or [])
    ]

    teammates = sorted(
        (
            {
                "steam64_id": t.get("steam64_id"),
                "matches": t.get("recent_matches_count") or 0,
            }
            for t in (data.get("recent_teammates") or [])
            if t.get("steam64_id")
        ),
        key=lambda t: -t["matches"],
    )[:10]

    return {
        "available": True,
        "name": data.get("name"),
        "total_matches": data.get("total_matches"),
        "winrate": data.get("winrate"),
        "privacy_mode": data.get("privacy_mode"),
        "first_match_date": data.get("first_match_date"),
        "ranks": {
            "leetify": ranks.get("leetify"),
            "premier": ranks.get("premier"),
            "faceit": ranks.get("faceit"),
            "faceit_elo": ranks.get("faceit_elo"),
            "wingman": ranks.get("wingman"),
            "renown": ranks.get("renown"),
            "competitive": ranks.get("competitive") or [],
            # Peak values, for the BEST column beside CURRENT.
            #
            # Leetify's own profile shows both, so the figures exist on their
            # side; what is NOT confirmed is the key names, because we have
            # never looked at a raw response. Several plausible spellings are
            # tried and whichever answers wins. A peak we can't find renders as
            # an empty cell, which is honest — inventing one by taking the
            # current value would silently claim the player is at their best.
            "premier_best": _first(ranks, "premier_best", "best_premier", "premier_peak"),
            "faceit_best": _first(ranks, "faceit_best", "best_faceit", "faceit_peak"),
            "wingman_best": _first(ranks, "wingman_best", "best_wingman", "wingman_peak"),
        },
        # Kept for the existing UI, which reads rating.aim / .positioning / .utility.
        "rating": {
            "aim": rating.get("aim"),
            "positioning": rating.get("positioning"),
            "utility": rating.get("utility"),
        },
        "ratings": ratings,
        "stats": cards,
        "stat_groups": [{"key": k, "label": v} for k, v in STAT_GROUPS],
        "bans": bans,
        "recent_matches": recent,
        "recent_teammates": teammates,
        "profile_url": profile_url(steamid),
    }


# Per-player fields in a parsed match. Leetify has already done the demo work,
# so this is the data our own demoparser worker exists to produce — for any
# match they've processed we can skip that entirely.
MATCH_STAT_FIELDS = [
    ("leetify_rating", "Leetify Rating"),
    ("ct_leetify_rating", "CT Leetify Rating"),
    ("t_leetify_rating", "T Leetify Rating"),
    ("total_kills", "Total Kills"),
    ("total_deaths", "Total Deaths"),
    ("total_assists", "Total Assists"),
    ("kd_ratio", "K/D Ratio"),
    ("total_damage", "Total Damage"),
    ("dpr", "DPR"),
    ("total_hs_kills", "Total HS Kills"),
    ("mvps", "MVPs"),
    ("rounds_survived", "Rounds Survived"),
    ("rounds_survived_percentage", "Rounds Survived Percentage"),
    ("multi1k", "1K"), ("multi2k", "2K"), ("multi3k", "3K"),
    ("multi4k", "4K"), ("multi5k", "5K"),
    ("preaim", "Preaim"),
    ("reaction_time", "Reaction Time"),
    ("accuracy", "Accuracy"),
    ("accuracy_head", "Accuracy (Head)"),
    ("spray_accuracy", "Spray Accuracy"),
    ("flash_assist", "Flash Assist"),
    ("flashbang_thrown", "Flashbang Thrown"),
    ("he_thrown", "HE Thrown"),
    ("molotov_thrown", "Molotov Thrown"),
    ("smoke_thrown", "Smoke Thrown"),
    ("utility_on_death_avg", "Utility On Death (avg)"),
    ("trade_kills_success_percentage", "Trade Kills Success Percentage"),
    ("traded_deaths_success_percentage", "Traded Deaths Success Percentage"),
]


def _shape_match(data: dict) -> dict:
    """One parsed match: scores plus every player's stat line."""
    players = []
    for p in data.get("stats") or []:
        row = {
            "steam64_id": p.get("steam64_id"),
            "name": p.get("name"),
            "team": p.get("initial_team_number"),
            "rounds_count": p.get("rounds_count"),
            "rounds_won": p.get("rounds_won"),
            "rounds_lost": p.get("rounds_lost"),
        }
        for key, label in MATCH_STAT_FIELDS:
            if p.get(key) is not None:
                row[key] = p[key]
        players.append(row)

    # Best rating first — that's the scoreboard order people expect.
    players.sort(key=lambda r: (r.get("leetify_rating") is None,
                                -(r.get("leetify_rating") or 0)))

    return {
        "available": True,
        "id": data.get("id"),
        "finished_at": data.get("finished_at"),
        "data_source": data.get("data_source"),
        "data_source_match_id": data.get("data_source_match_id"),
        "map_name": data.get("map_name"),
        "has_banned_player": data.get("has_banned_player"),
        "team_scores": data.get("team_scores") or [],
        "players": players,
        "fields": [{"key": k, "label": v} for k, v in MATCH_STAT_FIELDS],
    }


def _fetch(path: str, params: dict | None = None, cache_key: str = "") -> dict:
    """Shared request + error mapping for the JSON endpoints."""
    if cache_key:
        hit = cache.get(cache_key)
        if hit is not None:
            return hit

    try:
        r = _get(f"{BASE}{path}", params=params or {})
    except requests.exceptions.SSLError:
        return {"available": False, "reason": "ssl"}
    except requests.RequestException:
        return {"available": False, "reason": "network"}

    if r.status_code == 404:
        result = {"available": False, "reason": "not_found"}
    elif r.status_code == 429:
        result = {"available": False, "reason": "ratelimited"}
    elif r.status_code != 200:
        result = {"available": False, "reason": f"http{r.status_code}"}
    else:
        try:
            result = {"available": True, "data": r.json()}
        except ValueError:
            result = {"available": False, "reason": "badjson"}

    if cache_key:
        cache.set(cache_key, result, CACHE_TTL if result.get("available") else 60)
    return result


def get_match(data_source: str, data_source_id: str) -> dict:
    """Demo-parsed stats for a match, looked up by the platform's own match id.

    `data_source` is "faceit" or "matchmaking". This is the most valuable
    endpoint they expose: given a FACEIT match id we already have, it returns
    a full scoreboard with per-player ratings, multi-kills, opening duels and
    utility — data the FACEIT API doesn't provide and that would otherwise
    require downloading and parsing the demo ourselves.
    """
    if not data_source or not data_source_id:
        return {"available": False, "reason": "missing_id"}

    res = _fetch(
        f"/v2/matches/{urllib.parse.quote(data_source)}/{urllib.parse.quote(data_source_id)}",
        cache_key=f"leetify:match:{data_source}:{data_source_id}",
    )
    if not res.get("available"):
        return res
    try:
        return _shape_match(res["data"])
    except (AttributeError, TypeError):
        return {"available": False, "reason": "badshape"}


def get_player_matches(steamid: str, limit: int = 20) -> dict:
    """A player's recent matches, each with the full parsed scoreboard."""
    if not steamid:
        return {"available": False, "reason": "no steamid"}

    res = _fetch(
        "/v3/profile/matches",
        params={"steam64_id": steamid},
        cache_key=f"leetify:matches:{steamid}",
    )
    if not res.get("available"):
        return res

    rows = res["data"]
    if not isinstance(rows, list):
        return {"available": False, "reason": "badshape"}

    matches = []
    for m in rows[:limit]:
        try:
            shaped = _shape_match(m)
        except (AttributeError, TypeError):
            continue
        # Just this player's line, plus the match header — the full scoreboard
        # is a lot of payload and the caller can ask per match if they want it.
        me = next(
            (p for p in shaped["players"] if str(p.get("steam64_id")) == str(steamid)),
            None,
        )
        shaped["me"] = me
        shaped.pop("players", None)
        shaped.pop("fields", None)
        matches.append(shaped)

    return {"available": True, "matches": matches, "count": len(matches),
            "profile_url": profile_url(steamid)}


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
