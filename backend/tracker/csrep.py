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

def _request(method: str, path: str, params: dict | None = None,
             payload: dict | None = None) -> requests.Response:
    kwargs = {"headers": _headers(), "timeout": 20}
    if params:
        kwargs["params"] = params
    if payload is not None:
        kwargs["json"] = payload
    try:
        return requests.request(method, f"{BASE}{path}", **kwargs)
    except requests.exceptions.SSLError:
        # Same corporate-proxy escape hatch as the Steam and Leetify layers.
        if os.environ.get("STEAM_INSECURE", "").lower() not in ("1", "true", "yes"):
            raise
        import urllib3
        urllib3.disable_warnings()
        kwargs["verify"] = False
        return requests.request(method, f"{BASE}{path}", **kwargs)


def _fetch(path: str, params: dict | None = None, cache_key: str = "") -> dict:
    """A cached GET — the shape almost every read endpoint wants."""
    return _call("GET", path, params=params, cache_key=cache_key)


def _call(method: str, path: str, params: dict | None = None,
          payload: dict | None = None, cache_key: str = "",
          allow_empty: bool = False) -> dict:
    """One authenticated call, unwrapped from the {status, result} envelope.

    Returns {available: True, data: <result>} or {available: False, reason}.

    `allow_empty` covers endpoints that answer 200 with no envelope at all —
    /players/{id}/refresh is documented as "Player refresh was succesfully
    requested" and publishes no response schema, so demanding status == "OK"
    there would report a successful queue as a failure.
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
        r = _request(method, path, params=params, payload=payload)
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
    elif r.status_code not in (200, 201, 202):
        result = {"available": False, "reason": f"http{r.status_code}"}
    else:
        try:
            body = r.json()
        except ValueError:
            body = None
        if isinstance(body, dict) and body.get("status") == "OK":
            result = {"available": True, "data": body.get("result")}
        elif allow_empty:
            result = {"available": True, "data": body}
        else:
            result = {"available": False, "reason": "error_status"}

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
            "player_id": b.get("player_id"),
            "source": b.get("source"),
            "source_id": b.get("source_id"),
            "type": b.get("type"),
            "reason": b.get("reason"),
            "amount": b.get("amount"),
            "starts_at": b.get("starts_at"),
            "ends_at": b.get("ends_at"),
            "created_at": b.get("created_at"),
            "updated_at": b.get("updated_at"),
            "deleted_at": b.get("deleted_at"),
            # `player` is deliberately not expanded. The schema nests a FULL
            # PlayerEntity inside every ban, which recurses (that player has
            # bans, each carrying a player...) and would multiply the payload
            # for no gain: on a player's own profile it is the player we are
            # already looking at.
        }
        for b in (p.get("bans") or [])
        if b.get("type")
    ]


def _faceit_url(url: str | None) -> str | None:
    """FACEIT profile links arrive templated: ".../{lang}/players/<nick>".

    Rendered as-is the placeholder is literal and the link 404s. There is no
    per-locale content behind it worth preserving here, so it is filled with
    the neutral English locale.
    """
    if not isinstance(url, str) or not url:
        # Type-checked rather than truth-checked: the published schema says
        # string, but the schema has already been wrong about this API more
        # than once, and a non-string here would otherwise raise straight
        # through the shaper and turn one odd field into a 500 for the whole
        # profile.
        return None
    return url.replace("{lang}", "en")


def _faceit_levels(ranks: dict) -> dict | None:
    """FACEIT skill levels for the ELO figures CSRep reports.

    CSRep gives `ranks.faceit` as ELO (3632), never as the 1-10 level, so the
    level icon this site draws everywhere else has nothing to bind to. The
    conversion is FACEIT's published ladder, and this project already owns the
    canonical table in profiles.LEVEL_FLOORS — reused rather than copied, so
    the two can never drift apart.

    This is OUR derivation, not a CSRep signal: the ELO they sent stays
    displayed verbatim beside it, and the level is only ever additional. §4
    forbids rescaling their metrics; it does not forbid drawing the standard
    ladder icon next to an untouched number.
    """
    fac = (ranks or {}).get("faceit") or {}
    cur, peak = fac.get("current"), fac.get("peak")
    if cur is None and peak is None:
        return None

    from .profiles import _level_for
    return {
        "current": _level_for(int(cur)) if cur is not None else None,
        "peak": _level_for(int(peak)) if peak is not None else None,
    }


def _shape_user(p: dict) -> dict | None:
    """The CSRep account linked to this Steam profile, if the player has one.

    Declared required in the spec but absent from real responses, so it is
    optional here. It carries its own `redacted` flag — a linked account can
    be restricted independently of the player profile, and §4 applies to it
    just the same.
    """
    u = p.get("user")
    if not isinstance(u, dict):
        return None
    if u.get("redacted"):
        return {"redacted": True}
    return {
        "redacted": False,
        "id": u.get("id"),
        "steam_id": u.get("steam_id"),
        "handle": u.get("handle"),
        "name": u.get("name"),
        "avatar": u.get("avatar"),
        "roles": u.get("roles") or [],
        "cosmetics": u.get("cosmetics"),
        "created_at": u.get("created_at"),
    }


# Every field laid out explicitly below. Anything CSRep returns that is NOT in
# this set still reaches the UI, through `extra` — the published spec already
# lags the live API (it never mentions `cybershoke_registered_at`, and marks
# `user` and `faceit_latest_match_date` required when both can be absent), so
# treating this list as complete would mean quietly dropping new data the
# moment they ship it.
_EXPLICIT_FIELDS = {
    "id", "name", "avatar", "redacted", "anonymous", "privacy", "deleted_at",
    "reputation", "autoflag", "commendations", "bans", "ranks", "medals",
    "steam_status", "steam_active_game", "steam_level", "steam_vanity_url",
    "steam_privacy", "steam_created_at", "cs2_hours", "inventory_value",
    "faceit_id", "faceit_url", "faceit_latest_match_date",
    "gamersclub_id", "gamersclub_url", "cybershoke_registered_at",
    "refreshed_at", "created_at", "updated_at", "views", "user",
    "search_context",
}


def _extra(p: dict) -> dict:
    """Fields the API returned that this module does not lay out by hand.

    EVERYTHING unrecognised is forwarded, nested objects included. An earlier
    version kept only scalars, on the reasoning that an unknown object has no
    sensible generic rendering — and that silently ate `search_context`, a
    real field the search endpoint returns and the spec never mentions.

    Dropping data because the UI has no widget for it is the wrong trade: the
    renderer can ignore what it cannot draw, but a caller cannot use what
    never arrived. Presentation stays the UI's problem; this layer's job is
    not to lose anything.
    """
    return {
        k: v for k, v in p.items()
        if k not in _EXPLICIT_FIELDS and v is not None
    }


def _shape_player(p: dict, steamid: str) -> dict:
    """A CSRep player, or its restricted stand-in.

    `reputation`, `autoflag` and `commendations` are handed over untouched.
    Their internal shape is not published, and §4 forbids renaming or
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
        # Derived by us from the FACEIT ELO above — see _faceit_levels.
        "faceit_level": _faceit_levels(p.get("ranks")),

        # Steam account context. Overlaps signals trust.py already derives
        # itself — kept for display only, never merged into our own score.
        "steam_status": p.get("steam_status"),
        "steam_active_game": p.get("steam_active_game"),
        "steam_level": p.get("steam_level"),
        "steam_vanity_url": p.get("steam_vanity_url"),
        "steam_privacy": p.get("steam_privacy"),
        "steam_created_at": p.get("steam_created_at"),
        "cs2_hours": p.get("cs2_hours"),
        "inventory_value": p.get("inventory_value"),
        "medals": p.get("medals") or [],

        # Other platforms CSRep has linked to this account.
        "faceit_id": p.get("faceit_id"),
        "faceit_url": _faceit_url(p.get("faceit_url")),
        "faceit_latest_match_date": p.get("faceit_latest_match_date"),
        "gamersclub_id": p.get("gamersclub_id"),
        "gamersclub_url": p.get("gamersclub_url"),
        "cybershoke_registered_at": p.get("cybershoke_registered_at"),

        # Search results carry this; profile lookups do not. Undocumented, but
        # it is the field that makes a result interpretable: `in_scope` says
        # whether the player is someone the searching player has actually
        # crossed paths with, and `match_types` says WHY the row matched —
        # ["vanity"] means the query hit their Steam vanity URL, not their
        # name, which is why an unrelated account can answer a nickname search.
        "search_context": p.get("search_context"),

        "user": _shape_user(p),
        "views": p.get("views"),
        "refreshed_at": p.get("refreshed_at"),
        "created_at": p.get("created_at"),
        "updated_at": p.get("updated_at"),

        "extra": _extra(p),
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


_MATCH_EXPLICIT_FIELDS = {
    "id", "type", "status", "date", "date_valid", "source", "source_id",
    "imported_by", "share_code", "demo_url", "visibility", "map", "score",
    "players", "winner", "analysis", "analysis_url", "analyzed_at",
    "created_at", "updated_at",
}


def _shape_match(m: dict) -> dict:
    """One CSRep match, with every field the API returned.

    §4: a match marked PRIVATE is suppressed the same way a restricted profile
    is — the caller gets availability, not contents.

    `analysis` is passed through verbatim. Its schema is published as an empty
    object (`MatchAnalysisSchema` declares no properties), which is exactly how
    `reputation` was published before a live call showed it carrying the trust
    score and its breakdown — so assume this holds real analysis data and
    forward it untouched rather than guessing at a shape.
    """
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
        "date_valid": m.get("date_valid"),
        "source": m.get("source"),
        "source_id": m.get("source_id"),
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

        # The behavioural analysis, verbatim (§4).
        "analysis": m.get("analysis"),
        "analysis_url": m.get("analysis_url"),
        "analyzed_at": m.get("analyzed_at"),

        # Provenance. `demo_url` is the source demo CSRep parsed — useful to
        # know it exists; downloading and re-hosting it would be the mirroring
        # §6.C prohibits, so it is surfaced as a link, never fetched here.
        "imported_by": m.get("imported_by"),
        "share_code": m.get("share_code"),
        "demo_url": m.get("demo_url"),
        "created_at": m.get("created_at"),
        "updated_at": m.get("updated_at"),

        # Same rule as the player shaper: forward everything unrecognised,
        # nested objects included, so an undocumented field cannot vanish
        # between their API and our caller.
        "extra": {
            k: v for k, v in m.items()
            if k not in _MATCH_EXPLICIT_FIELDS and v is not None
        },
        "attribution": attribution(),
    }


def roster_summary(p: dict) -> dict:
    """The compact form of a player, for a scoreboard row.

    A match room shows ten players at once; the full 31-field profile per row
    would be noise nobody reads. This keeps only what changes a decision about
    the person sitting in the lobby with you: their trust score, whether CSRep
    auto-flagged them, and the bans CSRep itself issued — Overwatch verdicts
    and behavioural categories like SMURFING or BAN_EVASION, which no other
    source in this project can see.

    Steam and FACEIT bans are dropped here on purpose: the site already shows
    those from their own sources, and repeating them under a CSRep logo would
    credit CSRep for data that is not theirs.
    """
    if p.get("restricted"):
        return {"restricted": True, "profile_url": profile_url(p.get("id") or "")}

    rep = p.get("reputation") or {}
    own_bans = [
        {"type": b.get("type"), "reason": b.get("reason")}
        for b in (p.get("bans") or [])
        if b.get("source") == "CSREP"
    ]
    return {
        "restricted": False,
        "trust_score": rep.get("trust_score"),
        "autoflag": bool(p.get("autoflag")),
        "bans": own_bans,
        "profile_url": profile_url(p.get("id") or ""),
    }


def annotate_roster(players: list) -> dict:
    """Attach CSRep reputation to a list of players, in ONE request.

    `players` is mutated in place: each entry carrying a `steam_id` gains a
    `csrep` key. Entries CSRep has never seen simply do not get one, so the
    caller renders them exactly as before.

    This is the whole reason the batch endpoint exists for us. A ten-player
    room costs a single call against a 5,000/month allowance; looping
    get_player would cost ten and exhaust the month in a fortnight of normal
    traffic.

    Never raises: a match room that already loaded must not fail because a
    third party is down, so every failure path returns availability info and
    leaves the roster untouched.
    """
    ids = [str(p["steam_id"]) for p in players if p.get("steam_id")]
    if not ids:
        return {"available": False, "reason": "no steamids"}

    try:
        res = get_players(ids)
    except Exception:
        return {"available": False, "reason": "error"}
    if not res.get("available"):
        return res

    found = res.get("players") or {}
    for p in players:
        row = found.get(str(p.get("steam_id") or ""))
        if row:
            p["csrep"] = roster_summary(row)

    return {"available": True, "count": len(found), "attribution": attribution()}


def get_faceit_match(match_id: str) -> dict:
    """CSRep's record of a FACEIT match, by the FACEIT match id we already hold.

    The highest-value read here: FaceitLens already stores FACEIT match ids, so
    this needs no new identifier to join on.
    """
    if not match_id:
        return {"available": False, "reason": "no match id"}
    res = _fetch(f"/matches/faceit/{match_id}",
                 cache_key=f"csrep:match:faceit:{match_id}")
    return _shape_match(res["data"]) if res.get("available") else res


def get_gamersclub_match(match_id: str) -> dict:
    """CSRep's record of a Gamers Club match, by that platform's match id."""
    if not match_id:
        return {"available": False, "reason": "no match id"}
    res = _fetch(f"/matches/gamersclub/{match_id}",
                 cache_key=f"csrep:match:gc:{match_id}")
    return _shape_match(res["data"]) if res.get("available") else res


def get_match(match_id: str, for_player: str = "") -> dict:
    """A match by CSRep's own id.

    `for_player` is their optional `for` query parameter; it is passed straight
    through, and the cache key includes it so one player's view of a match is
    never served to another.
    """
    if not match_id:
        return {"available": False, "reason": "no match id"}
    params = {"for": for_player} if for_player else None
    res = _fetch(f"/matches/{match_id}", params=params,
                 cache_key=f"csrep:match:{match_id}:{for_player}")
    return _shape_match(res["data"]) if res.get("available") else res


def search_players(query: str, for_player: str) -> dict:
    """Search CSRep for players matching a query.

    Both parameters are required by the API — `forPlayer` scopes the search to
    a viewer, which is presumably how they rank or filter results.

    §4 forbids surfacing restricted profiles through discovery features, and a
    search box is exactly that, so restricted hits are dropped here rather than
    returned for a caller to remember to filter.
    """
    if not query or not for_player:
        return {"available": False, "reason": "missing_params"}

    res = _fetch("/players/search",
                 params={"query": query, "forPlayer": for_player},
                 cache_key=f"csrep:search:{for_player}:{query.lower()}")
    if not res.get("available"):
        return res

    rows = res.get("data")
    if not isinstance(rows, list):
        return {"available": False, "reason": "badshape"}

    players = []
    for p in rows:
        if not isinstance(p, dict) or _restricted(p):
            continue
        pid = str(p.get("id") or "")
        if pid:
            players.append(_shape_player(p, pid))

    return {"available": True, "players": players, "count": len(players),
            "attribution": attribution()}


# CSRep's own site config advertises a 300s manual refresh cooldown. Honouring
# it locally keeps us from spending quota on calls their backend would ignore.
REFRESH_COOLDOWN = int(os.environ.get("CSREP_REFRESH_COOLDOWN", "300"))


def refresh_player(steamid: str) -> dict:
    """Ask CSRep to re-scan a player's profile.

    A write, and a quota cost, so it is never called automatically — the
    cooldown below is the second line of defence after the view's per-IP rate
    limit.
    """
    if not steamid:
        return {"available": False, "reason": "no steamid"}

    cooldown_key = f"csrep:refresh:{steamid}"
    if cache.get(cooldown_key):
        return {"available": False, "reason": "cooldown",
                "retry_after": REFRESH_COOLDOWN}

    res = _call("POST", f"/players/{steamid}/refresh", allow_empty=True)
    if res.get("available"):
        cache.set(cooldown_key, 1, REFRESH_COOLDOWN)
        # The profile CSRep is about to rewrite is the one we have cached.
        cache.delete(f"csrep:player:{steamid}")
        return {"available": True, "queued": True,
                "cooldown": REFRESH_COOLDOWN,
                "attribution": attribution(steamid)}
    return res


def import_match(share_code: str = "", file_id: str = "") -> dict:
    """Submit a Valve share code (or an uploaded demo id) for CSRep to analyse.

    A write that hands CSRep new data rather than reading theirs, so it is
    deliberately not wired to a public HTTP endpoint — see the note in
    views.csrep_refresh. Exposed here so the capability exists for a
    server-side or admin-triggered flow.
    """
    if not share_code and not file_id:
        return {"available": False, "reason": "missing_params"}
    payload = {}
    if share_code:
        payload["share_code"] = share_code
    if file_id:
        payload["file_id"] = file_id

    res = _call("POST", "/matches/import", payload=payload)
    return _shape_match(res["data"]) if res.get("available") else res


def import_faceit_match(url: str = "", match_id: str = "", file_id: str = "") -> dict:
    """Submit a FACEIT match for CSRep to analyse.

    Takes either a signed demo URL, or a FACEIT match id paired with an
    uploaded demo file id. Same exposure caveat as `import_match`.
    """
    if not url and not match_id and not file_id:
        return {"available": False, "reason": "missing_params"}
    payload = {}
    if url:
        payload["url"] = url
    if match_id:
        payload["match_id"] = match_id
    if file_id:
        payload["file_id"] = file_id

    res = _call("POST", "/matches/import/faceit", payload=payload)
    return _shape_match(res["data"]) if res.get("available") else res
