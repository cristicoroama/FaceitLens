"""
CSRep.gg public API — CS2 reputation signals, ban history and Overwatch
verdicts for a Steam account.

This is the one source that answers a question neither FACEIT, Steam nor
Leetify can: has this account been judged by a human Overwatch reviewer, and
what does a dedicated reputation platform think of it. It complements — and
never replaces — our own `trust.py` score.

Docs: https://csrep.gg/docs/api-reference   base: https://csrep.gg/api
Auth: X-API-Key header, carrying the SECRET. The Key ID that CSRep issues
alongside it identifies the account and is not sent on requests.

The base URL carries NO version segment, despite the docs offering a v1/v2
selector and the spec declaring `openapi: 3.0.0` with an empty `servers` list:
/api/v2/... and /api/v1/... both 404 ("Cannot GET /v2/players/..."), while
/api/players/... serves the v2 shapes. The version selector versions the
DOCUMENTATION, not the routes. Verified against a live response, which also
returned a `cybershoke_registered_at` field the published spec does not
mention — treat the spec as indicative and shape defensively.

Their Developer API Terms v2.0 constrain the integration in ways that are
baked into this module rather than left to the caller to remember:

  §4  Privacy Mode / Restricted Profile State must be honoured. A `redacted`
      or deleted player is NOT returned as an ordinary profile — see
      `_restricted`. Callers must not surface those in search or browse.
  §4  Reputation signals are probabilistic. We pass `reputation`, `autoflag`
      and verdicts through VERBATIM: no renaming, no rescaling, no folding
      into a score of our own, and always alongside DISCLAIMER.
  §8  Attribution: the CSRep logo must be visible wherever their data shows,
      linking to that player's csrep.gg profile. LOGO_URL / profile_url and
      the `attribution` block exist so a UI cannot forget.
  §9  Cache 24h maximum, no permanent storage. Everything here lives in the
      Django cache; nothing reaches models.py. CACHE_TTL is hard-capped.
  §6  No mirroring, no bulk archival, no feeding their data into model
      training. Keep CSRep fields out of the ai.py prompt.

Quota is 5,000 requests/month, so `get_players` (batch) is strongly preferred
over per-player calls: one FACEIT scoreboard costs 1 request, not 10.
"""
from __future__ import annotations

import os
import time

import requests
from django.core.cache import cache

from .useragent import HEADERS as _UA

BASE = "https://csrep.gg/api"
SITE = "https://csrep.gg"

# §8 attribution assets. The logo must LINK to the player's profile.
LOGO_URL = f"{SITE}/assets/logo.webp"

# §4: this text travels with every reputation signal we return. It is not
# decoration — stripping it is a terms violation, so it ships from the backend
# rather than being left to a frontend string that someone can "tidy up".
DISCLAIMER = (
    "Reputation signals from CSRep are probabilistic informational assessments, "
    "not definitive determinations of cheating or misconduct."
)

# §9 caps caching at 24h. The env var can only make this SHORTER, never longer;
# a typo in the environment must not turn into a terms violation.
_MAX_TTL = 24 * 60 * 60
CACHE_TTL = min(int(os.environ.get("CSREP_CACHE_TTL", str(6 * 60 * 60))), _MAX_TTL)
# Failures are cached briefly so an outage doesn't burn the monthly quota.
FAIL_TTL = 10 * 60

# §7 fair use. 5,000/month is roughly 166/day, which is little enough that an
# accidental loop would exhaust it in minutes. This counter is a guard rail,
# not an accountant: on LocMem it resets when the process does, and CSRep's
# own count is authoritative. It exists to turn a runaway into a soft failure.
MONTHLY_QUOTA = int(os.environ.get("CSREP_MONTHLY_QUOTA", "5000"))
# Stop short of the ceiling so manual debugging isn't locked out by a bot loop.
QUOTA_HEADROOM = int(os.environ.get("CSREP_QUOTA_HEADROOM", "100"))


def profile_url(steamid: str) -> str:
    """The csrep.gg profile the attribution logo must link to (§8)."""
    return f"{SITE}/player/{steamid}"


def attribution(steamid: str | None = None) -> dict:
    """Everything a UI needs to attribute correctly. Ship it with every payload."""
    return {
        "name": "CSRep",
        "logo_url": LOGO_URL,
        "href": profile_url(steamid) if steamid else SITE,
        "disclaimer": DISCLAIMER,
    }


def configured() -> bool:
    return bool(os.environ.get("CSREP_API_KEY", "").strip())


def _headers() -> dict:
    h = dict(_UA)
    h["Accept"] = "application/json"
    h["X-API-Key"] = os.environ.get("CSREP_API_KEY", "").strip()
    return h


# --- quota -----------------------------------------------------------------

def _quota_key() -> str:
    # UTC month. CSRep's reset day is unknown; a calendar month is the
    # conservative reading and errs toward under-spending.
    return "csrep:quota:" + time.strftime("%Y-%m", time.gmtime())


def quota_used() -> int:
    return int(cache.get(_quota_key()) or 0)


def _quota_available() -> bool:
    return quota_used() < max(MONTHLY_QUOTA - QUOTA_HEADROOM, 0)


def _quota_spend() -> None:
    key = _quota_key()
    # 40 days: comfortably past any month boundary, so the counter survives
    # the whole window it is meant to measure.
    cache.add(key, 0, 40 * 24 * 60 * 60)
    try:
        cache.incr(key)
    except ValueError:
        # The add() above raced with an eviction. Losing one tick of a soft
        # guard rail is not worth failing the request over.
        cache.set(key, 1, 40 * 24 * 60 * 60)


# --- transport -------------------------------------------------------------

def _get(path: str, params: dict | None = None) -> requests.Response:
    kwargs = {"headers": _headers(), "timeout": 15, "params": params or {}}
    try:
        return requests.get(f"{BASE}{path}", **kwargs)
    except requests.exceptions.SSLError:
        # Same corporate-proxy escape hatch as the Steam and Leetify layers.
        if os.environ.get("STEAM_INSECURE", "").lower() not in ("1", "true", "yes"):
            raise
        import urllib3
        urllib3.disable_warnings()
        kwargs["verify"] = False
        return requests.get(f"{BASE}{path}", **kwargs)


def _fetch(path: str, params: dict | None = None, cache_key: str = "") -> dict:
    """One authenticated GET, unwrapped from the {status, result} envelope.

    Returns {available: True, data: <result>} or {available: False, reason}.
    """
    if cache_key:
        hit = cache.get(cache_key)
        if hit is not None:
            return hit

    if not configured():
        return {"available": False, "reason": "not_configured"}
    if not _quota_available():
        return {"available": False, "reason": "quota_exhausted"}

    try:
        r = _get(path, params)
    except requests.exceptions.SSLError:
        return {"available": False, "reason": "ssl"}
    except requests.RequestException:
        return {"available": False, "reason": "network"}

    # Counted only once a response actually came back. A request that died in
    # the TLS handshake or never left the machine cost CSRep nothing, and
    # charging it against the monthly allowance would let a local proxy fault
    # burn a quota that was never spent.
    _quota_spend()

    if r.status_code in (401, 403):
        # Also what an unauthenticated call returns, so a missing or wrong key
        # lands here rather than looking like a missing player.
        result = {"available": False, "reason": "unauthorized"}
    elif r.status_code == 404:
        result = {"available": False, "reason": "not_found"}
    elif r.status_code == 429:
        result = {"available": False, "reason": "ratelimited"}
    elif r.status_code != 200:
        result = {"available": False, "reason": f"http{r.status_code}"}
    else:
        try:
            body = r.json()
        except ValueError:
            body = None
        if not isinstance(body, dict) or body.get("status") != "OK":
            result = {"available": False, "reason": "error_status"}
        else:
            result = {"available": True, "data": body.get("result")}

    if cache_key:
        cache.set(cache_key, result, CACHE_TTL if result.get("available") else FAIL_TTL)
    return result


# --- privacy (§4) ----------------------------------------------------------

def _restricted(p: dict) -> bool:
    """Is this player in Restricted Profile State / Privacy Mode?

    `redacted` and `deleted_at` are typed in the schema and are decisive.

    `privacy` and `anonymous` are declared as bare objects with no published
    properties, so no specific flag can be read out of them. On a verified
    ordinary profile `privacy` comes back as `{}` and `anonymous` is absent
    entirely, which says CSRep populates these only when something IS set —
    so any TRUTHY value inside them is read as a restriction.

    Testing the values rather than mere key presence matters: a future
    `{"mode": false}` would otherwise suppress every profile on the site. The
    residual risk is over-suppression if CSRep ever puts a benign truthy
    setting in there, and that is the direction to err in when the alternative
    is displaying data we were told to hide (§4).
    """
    if p.get("redacted") or p.get("deleted_at"):
        return True
    for field in ("privacy", "anonymous"):
        value = p.get(field)
        if isinstance(value, dict):
            if any(value.values()):
                return True
        elif value:
            return True
    return False


def _shape_restricted(p: dict, steamid: str) -> dict:
    """The most a restricted profile may show.

    §4 forbids presenting these as ordinary public profiles or surfacing them
    through browse/discovery, so identifying fields are dropped entirely and
    the caller gets an explicit flag to branch on.
    """
    return {
        "available": True,
        "restricted": True,
        "id": p.get("id"),
        "attribution": attribution(steamid),
    }


# --- shaping ---------------------------------------------------------------

def _shape_bans(p: dict) -> list:
    """Ban history, passed through as returned.

    Richer than anything else we have: alongside VAC and GAME bans it carries
    CSRep's own OVERWATCH verdicts and AUTOFLAG entries, plus behavioural
    categories (SMURFING, BAN_EVASION, BOOSTING, GRIEFING...) that no other
    source in this project exposes.
    """
    return [
        {
            "id": b.get("id"),
            "source": b.get("source"),
            "type": b.get("type"),
            "reason": b.get("reason"),
            "starts_at": b.get("starts_at"),
            "ends_at": b.get("ends_at"),
            "created_at": b.get("created_at"),
        }
        for b in (p.get("bans") or [])
        if b.get("type")
    ]


def _shape_player(p: dict, steamid: str) -> dict:
    """A CSRep player, or its restricted stand-in.

    `reputation` and `autoflag` are handed over untouched. Their internal
    shape is not published in the v2 spec, and §4 forbids renaming or
    rescaling them anyway, so passing the raw object through is both the only
    thing we can do and the only thing we are allowed to do. They must never
    be fed into trust.compute_trust.
    """
    if _restricted(p):
        return _shape_restricted(p, steamid)

    return {
        "available": True,
        "restricted": False,
        "id": p.get("id"),
        "name": p.get("name"),
        "avatar": p.get("avatar"),

        # Verbatim reputation signals (§4).
        "reputation": p.get("reputation"),
        "autoflag": p.get("autoflag"),
        "commendations": p.get("commendations"),
        "bans": _shape_bans(p),

        # Ladders, as {current, peak} per ladder key.
        "ranks": p.get("ranks") or {},

        # Account context. Overlaps signals trust.py already derives from
        # Steam — kept for display only, never merged into our own score.
        "steam_level": p.get("steam_level"),
        "steam_created_at": p.get("steam_created_at"),
        "steam_privacy": p.get("steam_privacy"),
        "cs2_hours": p.get("cs2_hours"),
        "inventory_value": p.get("inventory_value"),
        "faceit_id": p.get("faceit_id"),
        "faceit_url": p.get("faceit_url"),
        "medals": p.get("medals") or [],

        "refreshed_at": p.get("refreshed_at"),
        "attribution": attribution(steamid),
    }


# --- public API ------------------------------------------------------------

def get_player(steamid: str) -> dict:
    """CSRep profile for one SteamID64, or {available: False, reason}."""
    if not steamid:
        return {"available": False, "reason": "no steamid"}

    res = _fetch(f"/players/{steamid}", cache_key=f"csrep:player:{steamid}")
    if not res.get("available"):
        return res
    data = res.get("data")
    if not isinstance(data, dict):
        return {"available": False, "reason": "badshape"}
    return _shape_player(data, steamid)


def get_players(steamids: list) -> dict:
    """Batch lookup — the quota-efficient path.

    A ten-player FACEIT scoreboard costs ONE request here against a monthly
    allowance of 5,000. Prefer this over looping get_player anywhere more than
    one player is on screen.
    """
    ids = [str(s) for s in (steamids or []) if s]
    if not ids:
        return {"available": False, "reason": "no steamids"}

    # Cache on the SET, order-independent, so the same scoreboard viewed twice
    # costs one request regardless of how the callers ordered it.
    key = "csrep:players:" + ",".join(sorted(ids))
    res = _fetch("/players", params={"ids": ids}, cache_key=key)
    if not res.get("available"):
        return res

    rows = res.get("data")
    if not isinstance(rows, list):
        return {"available": False, "reason": "badshape"}

    players = {}
    for p in rows:
        if not isinstance(p, dict):
            continue
        pid = str(p.get("id") or "")
        if pid:
            players[pid] = _shape_player(p, pid)

    return {"available": True, "players": players, "count": len(players),
            "attribution": attribution()}


def get_faceit_match(match_id: str) -> dict:
    """CSRep's record of a FACEIT match, by the FACEIT match id we already hold.

    §4: a match marked PRIVATE is suppressed the same way a restricted profile
    is — the caller gets availability, not contents.
    """
    if not match_id:
        return {"available": False, "reason": "no match id"}

    res = _fetch(f"/matches/faceit/{match_id}",
                 cache_key=f"csrep:match:faceit:{match_id}")
    if not res.get("available"):
        return res

    m = res.get("data")
    if not isinstance(m, dict):
        return {"available": False, "reason": "badshape"}
    if m.get("visibility") == "PRIVATE":
        return {"available": True, "restricted": True, "id": m.get("id"),
                "attribution": attribution()}

    return {
        "available": True,
        "restricted": False,
        "id": m.get("id"),
        "type": m.get("type"),
        "status": m.get("status"),
        "date": m.get("date"),
        "map": m.get("map"),
        "score": m.get("score") or [],
        "winner": m.get("winner"),
        "players": [
            {
                "id": pl.get("id"),
                "name": pl.get("name"),
                "team": pl.get("team"),
                "rank": pl.get("rank"),
                "rank_old": pl.get("rank_old"),
            }
            for pl in (m.get("players") or [])
            if pl.get("id")
        ],
        "analysis_url": m.get("analysis_url"),
        "analyzed_at": m.get("analyzed_at"),
        "attribution": attribution(),
    }
