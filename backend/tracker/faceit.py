"""
Service that talks to the FACEIT Data API v4.
Docs: https://developers.faceit.com/docs/tools/data-api
"""
import os
from concurrent.futures import ThreadPoolExecutor

import requests
from django.core.cache import cache

FACEIT_API_KEY = os.environ.get("FACEIT_API_KEY", "")
BASE_URL = "https://open.faceit.com/data/v4"
GAME = "cs2"

# How long (seconds) to keep a player summary cached.
CACHE_TTL = 180


class FaceitError(Exception):
    """Raised when the FACEIT API responds with a non-200 status."""


def _headers():
    if not FACEIT_API_KEY:
        raise FaceitError("FACEIT_API_KEY is not set in the environment.")
    return {"Authorization": f"Bearer {FACEIT_API_KEY}"}


def _get(path, params=None):
    resp = requests.get(f"{BASE_URL}{path}", headers=_headers(), params=params, timeout=10)
    if resp.status_code == 404:
        raise FaceitError("Resource not found (404).")
    if resp.status_code != 200:
        raise FaceitError(f"FACEIT API responded with {resp.status_code}: {resp.text[:200]}")
    return resp.json()


def get_player_by_nickname(nickname):
    """Return a player's basic details by nickname."""
    return _get("/players", params={"nickname": nickname})


def _extract_steam_id(text):
    """Pull a 17-digit SteamID64 out of a raw input or a Steam profile URL."""
    import re
    m = re.search(r"(7656\d{13})", text or "")
    return m.group(1) if m else None


def get_player_by_steam(steam_input):
    """
    Resolve a FACEIT player from a SteamID64 or a steamcommunity.com/profiles URL.
    Vanity URLs (steamcommunity.com/id/<name>) can't be resolved without a Steam
    API key, so those are rejected with a helpful message.
    """
    steam_id = _extract_steam_id(steam_input)
    if not steam_id:
        raise FaceitError(
            "Couldn't read a SteamID64. Paste a steamcommunity.com/profiles/ link "
            "or a 17-digit Steam ID (custom /id/ URLs aren't supported)."
        )
    return _get("/players", params={"game": GAME, "game_player_id": steam_id})


# The regions FACEIT actually ranks. Anything else 400s, so validate before
# spending a request.
REGIONS = {
    "EU": "Europe",
    "NA": "North America",
    "SA": "South America",
    "SEA": "Southeast Asia",
    "OCE": "Oceania",
}

# FACEIT caps a single rankings page at 100.
LEADERBOARD_PAGE = 100


def get_leaderboard(region, country=None, offset=0, limit=100):
    """A page of the CS2 ELO ranking for a region, optionally one country.

    This is the only leaderboard FACEIT publishes — there is no endpoint for
    "top players by K/D" and friends, so everything here is ELO order.
    Cached briefly: the ranking barely moves minute to minute, and without a
    cache a few people paging through would burn the API budget fast.
    """
    region = (region or "EU").upper()
    if region not in REGIONS:
        raise FaceitError(
            f"Unknown region '{region}'. Use one of: {', '.join(REGIONS)}."
        )

    offset = max(0, int(offset or 0))
    limit = max(1, min(int(limit or LEADERBOARD_PAGE), LEADERBOARD_PAGE))
    country = (country or "").strip().lower() or None

    cache_key = f"lb:{region}:{country or '-'}:{offset}:{limit}"
    hit = cache.get(cache_key)
    if hit is not None:
        return hit

    params = {"offset": offset, "limit": limit}
    if country:
        params["country"] = country

    data = _get(f"/rankings/games/{GAME}/regions/{region}", params=params)
    items = [
        {
            "position": it.get("position"),
            "nickname": it.get("nickname"),
            "player_id": it.get("player_id"),
            "elo": it.get("faceit_elo"),
            "level": it.get("game_skill_level"),
            "country": it.get("country"),
        }
        for it in (data.get("items") or [])
    ]

    result = {
        "items": items,
        "region": region,
        "region_label": REGIONS[region],
        "country": country,
        "offset": offset,
        "limit": limit,
        # FACEIT doesn't return a total, so "is there more" is simply whether
        # this page came back full.
        "has_more": len(items) == limit,
    }
    cache.set(cache_key, result, 5 * 60)
    return result


# Per-match multi-kill fields, if FACEIT exposes them in player_stats.
MULTIKILL_FIELDS = {
    "triple": "Triple Kills",
    "quadro": "Quadro Kills",
    "penta": "Penta Kills",
}


def build_multikills(items):
    """
    Aggregate multi-kills over recent matches IF the API exposes them.
    Returns totals + per-match averages, or None when unavailable.
    """
    if not items:
        return None
    found = False
    totals = {k: 0.0 for k in MULTIKILL_FIELDS}
    for it in items:
        s = it.get("stats", {})
        for key, field in MULTIKILL_FIELDS.items():
            v = s.get(field)
            if v is not None:
                found = True
                try:
                    totals[key] += float(v)
                except (TypeError, ValueError):
                    pass
    if not found:
        return None
    n = len(items)
    return {
        "matches": n,
        "triple_total": int(totals["triple"]),
        "quadro_total": int(totals["quadro"]),
        "penta_total": int(totals["penta"]),
        "triple_avg": round(totals["triple"] / n, 2),
        "quadro_avg": round(totals["quadro"] / n, 2),
        "penta_avg": round(totals["penta"] / n, 2),
    }


def get_player_stats(player_id):
    """Lifetime + per-map stats for CS2."""
    return _get(f"/players/{player_id}/stats/{GAME}")


def get_player_history(player_id, limit=10):
    """The player's most recent matches."""
    data = _get(f"/players/{player_id}/history", params={"game": GAME, "offset": 0, "limit": limit})
    return data.get("items", [])


# Approximate ELO gained/lost per match (FACEIT does not expose the real value).
ELO_PER_MATCH = 25


def get_match_stats(player_id, limit=30, offset=0):
    """Per-match stats (contain the win/loss result and the date)."""
    data = _get(
        f"/players/{player_id}/games/{GAME}/stats",
        params={"offset": offset, "limit": limit},
    )
    return data.get("items", [])


def get_recent_match_stats(player_id, total=200):
    """Fetch up to `total` recent matches, paginating 100 at a time."""
    items = []
    offset = 0
    while len(items) < total:
        batch = get_match_stats(player_id, limit=100, offset=offset)
        if not batch:
            break
        items.extend(batch)
        if len(batch) < 100:
            break
        offset += 100
    return items[:total]


def _to_int(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _ts_seconds(value):
    """
    Normalize a timestamp to seconds. FACEIT per-match stats give some
    timestamps in milliseconds (13 digits), which would overflow datetime.
    """
    ts = _to_int(value)
    if ts is None:
        return None
    if ts > 1_000_000_000_000:  # 13+ digits -> milliseconds
        ts //= 1000
    return ts


def build_elo_history(player_id, current_elo, limit=30, items=None):
    """
    Reconstruct the ELO curve by walking backwards from the current ELO.
    Each match moves the ELO by ~ELO_PER_MATCH (approximate).
    Returns a chronological list: [{date, elo, result}].
    """
    if current_elo is None:
        return []

    if items is None:
        items = get_match_stats(player_id, limit=limit)

    # Extract (date, result) for each match.
    matches = []
    for item in items:
        s = item.get("stats", {})
        date = _ts_seconds(s.get("Match Finished At") or s.get("Updated At") or s.get("Created At"))
        result = _to_int(s.get("Result"))  # 1 = win, 0 = loss
        if date is None or result is None:
            continue
        matches.append({"date": date, "result": result})

    if not matches:
        return []

    # The API returns newest-first; reorder chronologically.
    matches.sort(key=lambda m: m["date"])

    # Walk backwards from the current ELO to find the ELO before each match.
    deltas = [ELO_PER_MATCH if m["result"] == 1 else -ELO_PER_MATCH for m in matches]
    elo_before_first = current_elo - sum(deltas)

    history = []
    running = elo_before_first
    for m, delta in zip(matches, deltas):
        running += delta
        history.append({"date": m["date"], "elo": running, "result": m["result"]})

    return history


def get_player_ranking(player_id, region):
    """Player's global position in a region. Returns the position or None."""
    if not region:
        return None
    try:
        data = _get(f"/rankings/games/{GAME}/regions/{region}/players/{player_id}")
    except FaceitError:
        return None
    return data.get("position")


def extract_map_stats(stats):
    """
    Pull per-map win rates out of the 'segments' block of player stats.
    Returns a list sorted by matches played (desc).
    """
    maps = []
    for seg in stats.get("segments", []):
        if seg.get("type") != "Map":
            continue
        s = seg.get("stats", {})
        matches = _to_int(s.get("Matches")) or 0
        if matches == 0:
            continue
        label = seg.get("label", "")
        maps.append({
            "map": label.replace("de_", "").title(),
            "matches": matches,
            "win_rate": s.get("Win Rate %"),
            "avg_kd": s.get("Average K/D Ratio"),
        })
    maps.sort(key=lambda m: m["matches"], reverse=True)
    return maps


def get_player_bans(player_id):
    """Return a list of active bans/cooldowns for the player (may be empty)."""
    try:
        data = _get(f"/players/{player_id}/bans")
    except FaceitError:
        return []
    bans = []
    for b in data.get("items", []):
        bans.append({
            "reason": b.get("reason"),
            "type": b.get("type"),
            "starts_at": b.get("starts_at"),
            "ends_at": b.get("ends_at"),
        })
    return bans


def build_recent_averages(items, n=30, map_filter=None):
    """
    Average performance over the last `n` matches (FACEIT profile style):
    K/D, K/R, ADR, HS%, kills. Optionally filter by map (e.g. 'de_mirage').
    `items` are per-match stats already fetched.
    """
    if map_filter:
        items = [it for it in items if it.get("stats", {}).get("Map") == map_filter]
    items = items[:n]

    def mean(key_name, ndigits=2):
        vals = []
        for it in items:
            try:
                vals.append(float(it.get("stats", {}).get(key_name)))
            except (TypeError, ValueError):
                pass
        return round(sum(vals) / len(vals), ndigits) if vals else None

    return {
        "matches": len(items),
        "kd": mean("K/D Ratio"),
        "kr": mean("K/R Ratio"),
        "adr": mean("ADR", 0) or mean("Average Damage per Round", 0),
        "hs": mean("Headshots %", 0),
        "kills": mean("Kills", 1),
        "deaths": mean("Deaths", 1),
        "assists": mean("Assists", 1),
    }


def get_match_demo_url(match_id):
    """Return the first demo download URL for a FACEIT match, or None."""
    try:
        meta = _get(f"/matches/{match_id}")
    except FaceitError:
        return None
    urls = meta.get("demo_url")
    if isinstance(urls, list):
        return urls[0] if urls else None
    return urls or None


def get_match_detail(match_id):
    """
    Simplified scoreboard for a single match (per-player in-match stats).
    Cached 6h since a finished match never changes.
    """
    cache_key = f"match:{match_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    detail = {"match_id": match_id, "map": None, "score": None, "teams": []}

    try:
        meta = _get(f"/matches/{match_id}")
    except FaceitError:
        meta = {}
    results = meta.get("results", {})
    score = results.get("score", {})
    if score:
        detail["score"] = " - ".join(str(v) for v in score.values())

    try:
        stats = _get(f"/matches/{match_id}/stats")
    except FaceitError:
        return detail

    rounds = stats.get("rounds", [])
    if not rounds:
        return detail

    rnd = rounds[0]
    rstats = rnd.get("round_stats", {})
    detail["map"] = rstats.get("Map")
    detail["score"] = rstats.get("Score") or detail["score"]

    # Rounds played in this map (for the estimated rating). Prefer the explicit
    # field; otherwise derive it from the score, e.g. "13 - 7" -> 20.
    from . import performance as _perf
    map_rounds = _to_int(rstats.get("Rounds"))
    if not map_rounds:
        _parts = [
            _to_int(x)
            for x in str(rstats.get("Score") or detail["score"] or "")
            .replace("-", " ").replace("/", " ").replace(":", " ").split()
        ]
        _parts = [x for x in _parts if x is not None]
        map_rounds = sum(_parts[:2]) if len(_parts) >= 2 else None

    for team in rnd.get("teams", []):
        tstats = team.get("team_stats", {})
        players = []
        for p in team.get("players", []):
            ps = p.get("player_stats", {})
            perf = _perf.match_performance(ps, rounds=map_rounds)
            players.append({
                "nickname": p.get("nickname"),
                "kills": ps.get("Kills"),
                "deaths": ps.get("Deaths"),
                "assists": ps.get("Assists"),
                "kd": ps.get("K/D Ratio"),
                "hs": ps.get("Headshots %"),
                "adr": ps.get("ADR") or ps.get("Average Damage per Round"),
                "rating": perf["rating"] if perf else None,
                "firepower": perf["firepower"] if perf else None,
            })
        players.sort(key=lambda x: float(x["kd"] or 0), reverse=True)
        detail["teams"].append({
            "name": tstats.get("Team"),
            "score": tstats.get("Final Score"),
            "win": tstats.get("Team Win") == "1",
            "players": players,
        })

    cache.set(cache_key, detail, 6 * 60 * 60)
    return detail


def _extract_match_id(raw):
    """Pull a FACEIT match id out of a room URL or accept a bare id.
    Handles .../room/1-<uuid>, .../room/<uuid>, or the id pasted directly."""
    import re
    s = (raw or "").strip()
    # room links: /room/<id> (optionally with query/hash after)
    m = re.search(r"/room/([0-9A-Za-z-]+)", s)
    if m:
        return m.group(1)
    # a bare "1-<uuid>" style id
    m = re.search(r"\b(1-[0-9a-fA-F-]{30,})\b", s)
    if m:
        return m.group(1)
    # last resort: a lone token that looks like an id
    if re.fullmatch(r"[0-9A-Za-z-]{6,}", s):
        return s
    return None


def _player_elo_level(player_id):
    """Current CS2 ELO + skill level for one player (cached 5 min)."""
    ck = f"pel:{player_id}"
    hit = cache.get(ck)
    if hit is not None:
        return hit
    try:
        p = _get(f"/players/{player_id}")
    except FaceitError:
        return {"elo": None, "level": None, "country": None, "avatar": None}
    cs2 = (p.get("games", {}) or {}).get("cs2", {}) or {}
    out = {
        "elo": cs2.get("faceit_elo"),
        "level": cs2.get("skill_level"),
        "country": p.get("country"),
        "avatar": p.get("avatar") or None,
    }
    cache.set(ck, out, 300)
    return out


def get_match_room(raw):
    """
    Scout a FACEIT match room: both teams' rosters with current ELO/level, team
    averages and a simple ELO-based win probability. Works for upcoming, live or
    finished matches (anything the /matches/<id> endpoint returns).
    """
    match_id = _extract_match_id(raw)
    if not match_id:
        raise FaceitError("Couldn't read a match id. Paste a faceit.com room link.")

    meta = _get(f"/matches/{match_id}")
    teams_in = meta.get("teams", {}) or {}

    def build_team(faction):
        f = teams_in.get(faction, {}) or {}
        roster = f.get("roster", []) or []
        players = []
        for r in roster:
            pid = r.get("player_id")
            info = _player_elo_level(pid) if pid else {}
            players.append({
                "player_id": pid,
                "nickname": r.get("nickname"),
                "elo": info.get("elo"),
                "level": info.get("level") or r.get("game_skill_level"),
                "country": info.get("country"),
                "avatar": info.get("avatar") or r.get("avatar") or None,
            })
        players.sort(key=lambda x: (x["elo"] or 0), reverse=True)
        elos = [p["elo"] for p in players if p["elo"]]
        avg = round(sum(elos) / len(elos)) if elos else None
        return {
            "name": f.get("name") or faction,
            "players": players,
            "avg_elo": avg,
            "leader": f.get("leader"),
        }

    t1 = build_team("faction1")
    t2 = build_team("faction2")

    # ELO win probability (logistic on the average-ELO gap)
    prob1 = None
    if t1["avg_elo"] and t2["avg_elo"]:
        prob1 = round(1 / (1 + 10 ** ((t2["avg_elo"] - t1["avg_elo"]) / 400)) * 100)

    status = meta.get("status")
    voting = meta.get("voting", {}) or {}
    picked_map = None
    mp = (voting.get("map", {}) or {}).get("pick")
    if isinstance(mp, list) and mp:
        picked_map = mp[0]

    return {
        "match_id": match_id,
        "status": status,
        "competition": meta.get("competition_name"),
        "region": meta.get("region"),
        "map": picked_map,
        "faceit_url": (meta.get("faceit_url") or "").replace("{lang}", "en") or None,
        "team1": t1,
        "team2": t2,
        "prob1": prob1,
        "prob2": (100 - prob1) if prob1 is not None else None,
    }


def build_squad_stats(nicknames):
    """
    For a list of nicknames, find matches they played in together and the
    group's win rate. Heuristic: a shared match where every selected player
    has the same win/loss result is treated as 'played together'.
    """
    players = []
    # match_id -> result, per player
    per_player = []
    for nick in nicknames:
        try:
            p = get_player_by_nickname(nick)
        except FaceitError:
            continue
        pid = p["player_id"]
        cs2 = p.get("games", {}).get(GAME, {})
        players.append({
            "player_id": pid,
            "nickname": p.get("nickname"),
            "avatar": p.get("avatar"),
            "elo": cs2.get("faceit_elo"),
            "skill_level": cs2.get("skill_level"),
        })
        results = {}
        for item in get_match_stats(pid, limit=100):
            s = item.get("stats", {})
            mid = s.get("Match Id") or s.get("Match ID")
            res = _to_int(s.get("Result"))
            if mid is not None and res is not None:
                results[mid] = res
        per_player.append(results)

    together = 0
    wins = 0
    if len(per_player) >= 2:
        common = set(per_player[0])
        for r in per_player[1:]:
            common &= set(r)
        for mid in common:
            outcomes = {pp[mid] for pp in per_player}
            if len(outcomes) == 1:  # same result for everyone -> same team
                together += 1
                if outcomes.pop() == 1:
                    wins += 1

    win_rate = round(wins / together * 100) if together else None
    return {
        "players": players,
        "matches_together": together,
        "wins_together": wins,
        "win_rate_together": win_rate,
    }


def search_players(query, limit=6):
    """Autocomplete: return up to `limit` players matching a nickname prefix."""
    if not query:
        return []
    try:
        data = _get("/search/players", params={"nickname": query, "game": GAME, "limit": limit})
    except FaceitError:
        return []
    out = []
    for item in data.get("items", []):
        out.append({
            "nickname": item.get("nickname"),
            "avatar": item.get("avatar"),
            "country": item.get("country"),
        })
    return out


SESSION_GAP = 3 * 60 * 60  # 3h gap starts a new session


def build_sessions_and_streak(player_id, limit=50, items=None):
    """
    From recent matches compute:
      - current streak (e.g. 3 wins in a row),
      - the most recent play session (matches, W-L, approx ELO change, tilt).
    """
    if items is None:
        items = get_match_stats(player_id, limit=limit)
    matches = []
    for item in items:
        s = item.get("stats", {})
        date = _ts_seconds(s.get("Match Finished At") or s.get("Updated At") or s.get("Created At"))
        result = _to_int(s.get("Result"))
        if date is not None and result is not None:
            matches.append({"date": date, "result": result})
    if not matches:
        return {"streak": None, "last_session": None}

    matches.sort(key=lambda m: m["date"])  # chronological

    # Current streak = trailing run of identical results.
    last_result = matches[-1]["result"]
    streak_count = 0
    for m in reversed(matches):
        if m["result"] == last_result:
            streak_count += 1
        else:
            break
    streak = {"type": "W" if last_result == 1 else "L", "count": streak_count}

    # Split into sessions by time gap; take the most recent one.
    sessions = [[matches[0]]]
    for prev, cur in zip(matches, matches[1:]):
        if cur["date"] - prev["date"] > SESSION_GAP:
            sessions.append([cur])
        else:
            sessions[-1].append(cur)
    last = sessions[-1]
    wins = sum(1 for m in last if m["result"] == 1)
    losses = len(last) - wins

    # Tilt = 3+ losses in a row at the end of the session.
    tilt_run = 0
    for m in reversed(last):
        if m["result"] == 0:
            tilt_run += 1
        else:
            break

    last_session = {
        "matches": len(last),
        "wins": wins,
        "losses": losses,
        "elo_change": (wins - losses) * ELO_PER_MATCH,
        "tilt": tilt_run >= 3,
    }
    return {"streak": streak, "last_session": last_session}


def build_form_and_trend(items):
    """Recent form (last 10 W-L) and K/D trend (recent 10 vs previous 10)."""
    results, kds = [], []
    for item in items:
        s = item.get("stats", {})
        r = _to_int(s.get("Result"))
        if r is not None:
            results.append(r)
        try:
            kds.append(float(s.get("K/D Ratio")))
        except (TypeError, ValueError):
            pass

    last10 = results[:10]
    form = None
    if last10:
        w = sum(last10)
        form = f"{w}-{len(last10) - w}"

    trend = None
    if len(kds) >= 6:
        half = min(10, len(kds) // 2)
        recent = sum(kds[:half]) / half
        prev = sum(kds[half:half * 2]) / half
        if recent > prev + 0.03:
            trend = "up"
        elif recent < prev - 0.03:
            trend = "down"
        else:
            trend = "flat"
    return {"form": form, "kd_trend": trend}


def build_best_teammates(history_items, player_nickname, top=3, min_games=3):
    """
    From match history, find who the player wins with most often.
    Returns up to `top` teammates with >= `min_games` games together.
    """
    tally = {}  # nickname -> [games, wins]
    meta = {}   # nickname -> {avatar, player_id}
    for m in history_items:
        teams = m.get("teams", {})
        winner = (m.get("results", {}) or {}).get("winner")
        my_faction = None
        for side, t in teams.items():
            names = [p.get("nickname") for p in t.get("players", [])]
            if player_nickname in names:
                my_faction = side
                break
        if my_faction is None:
            continue
        won = winner == my_faction
        for p in teams[my_faction].get("players", []):
            nick = p.get("nickname")
            if not nick or nick == player_nickname:
                continue
            entry = tally.setdefault(nick, [0, 0])
            entry[0] += 1
            if won:
                entry[1] += 1
            # match-history player objects carry avatar + id; keep the first seen
            if nick not in meta:
                meta[nick] = {
                    "avatar": p.get("avatar") or None,
                    "player_id": p.get("player_id") or p.get("user_id"),
                }

    mates = [
        {
            "nickname": nick,
            "games": g,
            "wins": w,
            "win_rate": round(w / g * 100),
            "avatar": meta.get(nick, {}).get("avatar"),
            "player_id": meta.get(nick, {}).get("player_id"),
        }
        for nick, (g, w) in tally.items()
        if g >= min_games
    ]
    mates.sort(key=lambda x: (x["games"], x["win_rate"]), reverse=True)
    return mates[:top]


def build_nemeses(history_items, player_nickname, top=3, min_games=2):
    """
    The mirror of best teammates: opponents faced most often, and how the player
    fares against them. `win_rate` here is the PLAYER's win rate vs that rival —
    a low number means they own you. Sorted by games faced, then by how badly
    the player loses to them.
    """
    tally = {}  # nickname -> [games, player_wins]
    meta = {}
    for m in history_items:
        teams = m.get("teams", {})
        winner = (m.get("results", {}) or {}).get("winner")
        my_faction = None
        for side, t in teams.items():
            names = [p.get("nickname") for p in t.get("players", [])]
            if player_nickname in names:
                my_faction = side
                break
        if my_faction is None or not winner:
            continue
        i_won = winner == my_faction
        for side, t in teams.items():
            if side == my_faction:
                continue
            for p in t.get("players", []):
                nick = p.get("nickname")
                if not nick:
                    continue
                entry = tally.setdefault(nick, [0, 0])
                entry[0] += 1
                if i_won:
                    entry[1] += 1
                if nick not in meta:
                    meta[nick] = {
                        "avatar": p.get("avatar") or None,
                        "player_id": p.get("player_id") or p.get("user_id"),
                    }

    nemeses = [
        {
            "nickname": nick,
            "games": g,
            "wins": w,                       # player's wins vs them
            "win_rate": round(w / g * 100),  # player's win rate vs them
            "avatar": meta.get(nick, {}).get("avatar"),
            "player_id": meta.get(nick, {}).get("player_id"),
        }
        for nick, (g, w) in tally.items()
        if g >= min_games
    ]
    # most-faced first, then the ones you lose to most (lowest win rate)
    nemeses.sort(key=lambda x: (x["games"], -x["win_rate"]), reverse=True)
    return nemeses[:top]


def search_hubs(query, limit=8):
    """Search FACEIT hubs by name.

    These were written against `/search/clubs` and `/clubs/{id}`, which do not
    exist in the Data API — FACEIT's term is "hub". Every call 404'd and the
    error was swallowed, so the feature looked like it simply found nothing.
    Errors now propagate so a broken query says so instead of going quiet.
    """
    cache_key = f"hubsearch:{query.lower()}:{limit}"
    hit = cache.get(cache_key)
    if hit is not None:
        return hit

    data = _get(
        "/search/hubs",
        params={"name": query, "game": GAME, "offset": 0, "limit": limit},
    )
    out = []
    for it in data.get("items", []):
        out.append({
            # Search results identify a hub as `competition_id`, NOT `hub_id`
            # — the detail endpoint is the one that calls it hub_id.
            "hub_id": it.get("competition_id"),
            "name": it.get("name"),
            # Not in the documented schema, but take it if the API sends it
            # anyway; _fill_hub_avatars covers the case where it doesn't.
            "avatar": it.get("avatar") or it.get("logo") or None,
            "game": it.get("game"),
            "region": it.get("region"),
            "members": it.get("number_of_members") or it.get("players_joined"),
            "organizer": it.get("organizer_name") or None,
        })
    hubs = [h for h in out if h["hub_id"] and h["name"]][:limit]
    _fill_hub_avatars(hubs)
    cache.set(cache_key, hubs, 10 * 60)
    return hubs


def _fill_hub_avatars(hubs):
    """Backfill avatars that hub *search* doesn't return but hub *detail* does.

    Hubs do have artwork — it just isn't in the search payload, so results
    would otherwise be a wall of initials. One small detail call per result,
    in parallel, and each is cached on its own so repeat searches are free.
    """
    missing = [h for h in hubs if not h.get("avatar")]
    if not missing:
        return

    def one(h):
        ck = f"hubava:{h['hub_id']}"
        hit = cache.get(ck)
        if hit is None:
            try:
                data = _get(f"/hubs/{h['hub_id']}")
                hit = data.get("avatar") or ""
            except FaceitError:
                hit = ""          # cache the miss too; don't retry every search
            cache.set(ck, hit, 24 * 60 * 60)
        h["avatar"] = hit or None

    with ThreadPoolExecutor(max_workers=min(8, len(missing))) as pool:
        list(pool.map(one, missing))


# FACEIT has no "list all hubs" endpoint — /search/hubs requires a name. So a
# "popular" list has to be assembled from real searches. These seeds are broad
# terms that big public hubs tend to have in their names; results are merged,
# deduped and ranked by actual member count, so the ordering is real data even
# though the candidate pool is seeded by hand.
POPULAR_HUB_SEEDS = [
    "FACEIT", "ESEA", "CS2", "Premier", "Community",
    "League", "Europe", "Hub", "Elite", "Pro",
]


def popular_hubs(limit=10):
    """A browsable list of busy CS2 hubs, for when nobody has searched yet."""
    cache_key = f"hubspopular:{limit}"
    hit = cache.get(cache_key)
    if hit is not None:
        return hit

    found = {}

    def seed(term):
        try:
            return search_hubs(term, limit=8)
        except FaceitError:
            return []

    with ThreadPoolExecutor(max_workers=5) as pool:
        for batch in pool.map(seed, POPULAR_HUB_SEEDS):
            for h in batch:
                # Keep whichever copy reports the most members; different
                # searches can return the same hub with stale counts.
                cur = found.get(h["hub_id"])
                if cur is None or (h.get("members") or 0) > (cur.get("members") or 0):
                    found[h["hub_id"]] = h

    ranked = sorted(found.values(), key=lambda h: h.get("members") or 0, reverse=True)[:limit]
    _fill_hub_avatars(ranked)
    # Membership barely moves hour to hour, and this costs ~10 API calls.
    cache.set(cache_key, ranked, 6 * 60 * 60)
    return ranked


def get_hub(hub_id):
    """One hub's profile + members."""
    hub = _get(f"/hubs/{hub_id}")
    members = []
    try:
        mdata = _get(f"/hubs/{hub_id}/members", params={"offset": 0, "limit": 40})
        for m in mdata.get("items", []):
            members.append({
                "player_id": m.get("user_id") or m.get("player_id"),
                "nickname": m.get("nickname"),
                "avatar": m.get("avatar") or None,
            })
    except FaceitError:
        # Some hubs hide their member list; the profile is still worth showing.
        pass

    return {
        "hub_id": hub_id,
        "name": hub.get("name"),
        "description": hub.get("description") or "",
        "avatar": hub.get("avatar") or None,
        "cover": hub.get("cover_image") or None,
        "background": hub.get("background_image") or None,
        "game": hub.get("game_id"),
        "region": hub.get("region"),
        "organizer": (hub.get("organizer_data") or {}).get("name") or None,
        "players": hub.get("players_joined"),
        "faceit_url": (hub.get("faceit_url") or "").replace("{lang}", "en") or None,
        "min_level": hub.get("min_skill_level"),
        "max_level": hub.get("max_skill_level"),
        "member_count": len(members),
        "members": members,
    }


def search_teams(query, limit=10):
    """Search FACEIT teams by name.

    This is what people actually mean when they type "NAVI" or "FaZe" — those
    are teams, not hubs, and until now the site had nowhere to put them.
    Unlike hub search, this one does return an avatar.
    """
    cache_key = f"teamsearch:{query.lower()}:{limit}"
    hit = cache.get(cache_key)
    if hit is not None:
        return hit

    data = _get(
        "/search/teams",
        params={"nickname": query, "game": GAME, "offset": 0, "limit": limit},
    )
    out = []
    for it in data.get("items", []):
        out.append({
            "team_id": it.get("team_id"),
            "name": it.get("name"),
            "avatar": it.get("avatar") or None,
            "verified": bool(it.get("verified")),
            "game": it.get("game"),
        })
    out = [t for t in out if t["team_id"] and t["name"]][:limit]
    cache.set(cache_key, out, 10 * 60)
    return out


def get_team(team_id):
    """A team's profile, roster and CS2 stats."""
    cache_key = f"team:{team_id}"
    hit = cache.get(cache_key)
    if hit is not None:
        return hit

    team = _get(f"/teams/{team_id}")

    members = []
    for m in team.get("members") or []:
        members.append({
            "player_id": m.get("user_id") or m.get("player_id"),
            "nickname": m.get("nickname"),
            "avatar": m.get("avatar") or None,
        })

    # Stats are a separate call and many teams have never played a match, so a
    # miss here must not take the profile down with it.
    stats = None
    try:
        raw = _get(f"/teams/{team_id}/stats/{GAME}")
        life = raw.get("lifetime") or {}
        stats = {
            "matches": _to_int(life.get("Matches")),
            "wins": _to_int(life.get("Wins")),
            "win_rate": _to_int(life.get("Win Rate %")),
            "recent": (life.get("Recent Results") or [])[:5],
            "longest_streak": _to_int(life.get("Longest Win Streak")),
            "current_streak": _to_int(life.get("Current Win Streak")),
        }
        maps = []
        for seg in raw.get("segments") or []:
            if (seg.get("type") or "").lower() != "map":
                continue
            st = seg.get("stats") or {}
            maps.append({
                "map": seg.get("label"),
                "matches": _to_int(st.get("Matches")),
                "win_rate": _to_int(st.get("Win Rate %")),
            })
        maps.sort(key=lambda m: m["matches"] or 0, reverse=True)
        stats["maps"] = maps[:8]
    except FaceitError:
        pass

    result = {
        "team_id": team_id,
        "name": team.get("name"),
        "nickname": team.get("nickname"),
        "avatar": team.get("avatar") or None,
        "cover": team.get("cover_image") or None,
        "description": team.get("description") or "",
        "game": team.get("game"),
        "verified": bool(team.get("verified")),
        "faceit_url": (team.get("faceit_url") or "").replace("{lang}", "en") or None,
        "leader": team.get("leader"),
        "members": members,
        "stats": stats,
    }
    cache.set(cache_key, result, 15 * 60)
    return result


# --------------------------------------------------------------------------- #
#  Hub leaderboards
# --------------------------------------------------------------------------- #

def get_hub_leaderboards(hub_id):
    """The ladders a hub runs: an all-time one plus a season each."""
    try:
        data = _get("/leaderboards/hubs/" + hub_id, params={"offset": 0, "limit": 20})
    except FaceitError:
        return []
    out = []
    for it in data.get("items", []):
        out.append({
            "leaderboard_id": it.get("leaderboard_id"),
            "name": it.get("leaderboard_name"),
            "mode": it.get("leaderboard_mode"),
            "season": it.get("season"),
            "min_matches": it.get("min_matches"),
            "end_date": it.get("end_date"),
        })
    return [l for l in out if l["leaderboard_id"]]


def _rank_rows(data):
    """Shared row shape — every ranking endpoint returns the same object."""
    rows = []
    for it in data.get("items", []):
        pl = it.get("player") or {}
        rows.append({
            "position": it.get("position"),
            "nickname": pl.get("nickname"),
            "player_id": pl.get("player_id") or pl.get("user_id"),
            "avatar": pl.get("avatar") or None,
            "points": it.get("points"),
            "played": it.get("played"),
            "won": it.get("won"),
            "lost": it.get("lost"),
            "win_rate": it.get("win_rate"),
            "streak": it.get("current_streak"),
        })
    return rows


def get_hub_ranking(hub_id, season=None, offset=0, limit=50):
    """A hub's ranking - all-time by default, or one season."""
    limit = max(1, min(int(limit or 50), 100))
    offset = max(0, int(offset or 0))
    cache_key = "hubrank:%s:%s:%s:%s" % (hub_id, season or "general", offset, limit)
    hit = cache.get(cache_key)
    if hit is not None:
        return hit

    if season:
        path = "/leaderboards/hubs/%s/seasons/%s" % (hub_id, season)
    else:
        path = "/leaderboards/hubs/%s/general" % hub_id
    data = _get(path, params={"offset": offset, "limit": limit})
    result = {"items": _rank_rows(data), "offset": offset, "limit": limit}
    result["has_more"] = len(result["items"]) == limit
    cache.set(cache_key, result, 5 * 60)
    return result


# --------------------------------------------------------------------------- #
#  Leagues - a player's division and standing
# --------------------------------------------------------------------------- #

def get_player_league(player_id, league_id, season_id):
    """Where a player sits in one season of a league."""
    try:
        d = _get("/leagues/%s/seasons/%s/players/%s" % (league_id, season_id, player_id))
    except FaceitError:
        return None
    return {
        "division": d.get("division_name"),
        "tier": d.get("division_tier"),
        "type": d.get("division_type"),
        "position": d.get("position"),
        "points": d.get("points"),
        "leaderboard_id": d.get("leaderboard_id"),
    }


# --------------------------------------------------------------------------- #
#  Competitions - championships and tournaments share one search shape
# --------------------------------------------------------------------------- #

def _competition_rows(items):
    out = []
    for it in items:
        out.append({
            "id": it.get("competition_id") or it.get("championship_id") or it.get("tournament_id"),
            "name": it.get("name"),
            "kind": (it.get("competition_type") or "").lower() or None,
            "region": it.get("region"),
            "status": it.get("status"),
            "organizer": it.get("organizer_name") or None,
            "organizer_id": it.get("organizer_id"),
            "players": it.get("players_joined") or it.get("number_of_members"),
            "slots": it.get("slots"),
            "prize": it.get("total_prize") or None,
            "starts_at": it.get("started_at"),
        })
    return [c for c in out if c["id"] and c["name"]]


def browse_championships(limit=20, offset=0, ctype="all"):
    """List CS2 championships. Unlike hubs, this needs no search term - it is
    the only browsable competition endpoint FACEIT exposes."""
    limit = max(1, min(int(limit or 20), 50))
    offset = max(0, int(offset or 0))
    cache_key = "champs:%s:%s:%s" % (ctype, offset, limit)
    hit = cache.get(cache_key)
    if hit is not None:
        return hit

    data = _get("/championships", params={"game": GAME, "type": ctype,
                                          "offset": offset, "limit": limit})
    items = []
    for it in data.get("items", []):
        items.append({
            "id": it.get("championship_id") or it.get("id"),
            "name": it.get("name"),
            "kind": "championship",
            "avatar": it.get("avatar") or None,
            "cover": it.get("cover_image") or None,
            "description": (it.get("description") or "")[:200],
            "region": it.get("region"),
            "status": it.get("status"),
            "starts_at": it.get("championship_start"),
            "subscriptions": it.get("current_subscriptions"),
            "slots": it.get("total_slots") or it.get("slots"),
            "featured": bool(it.get("featured")),
            "faceit_url": (it.get("faceit_url") or "").replace("{lang}", "en") or None,
        })
    result = {"items": [c for c in items if c["id"] and c["name"]],
              "offset": offset, "limit": limit}
    result["has_more"] = len(result["items"]) == limit
    cache.set(cache_key, result, 10 * 60)
    return result


def search_competitions(query, limit=10):
    """Search championships and tournaments together - one box, both kinds."""
    cache_key = "compsearch:%s:%s" % (query.lower(), limit)
    hit = cache.get(cache_key)
    if hit is not None:
        return hit

    def one(path):
        try:
            d = _get(path, params={"name": query, "game": GAME,
                                   "offset": 0, "limit": limit})
            return _competition_rows(d.get("items", []))
        except FaceitError:
            return []

    with ThreadPoolExecutor(max_workers=2) as pool:
        champs, tours = list(pool.map(one, ("/search/championships", "/search/tournaments")))

    for c in champs:
        c["kind"] = c["kind"] or "championship"
    for t in tours:
        t["kind"] = t["kind"] or "tournament"

    merged = champs + tours
    cache.set(cache_key, merged, 10 * 60)
    return merged


def get_championship(cid):
    """One championship, with its final placements if it has any."""
    c = _get("/championships/" + cid)
    results = []
    try:
        r = _get("/championships/%s/results" % cid, params={"offset": 0, "limit": 30})
        for row in r.get("items", []):
            for place in (row.get("placements") or []):
                results.append({
                    "position": place.get("position"),
                    "name": (place.get("team") or {}).get("name") or place.get("nickname"),
                })
    except FaceitError:
        pass

    return {
        "id": cid,
        "kind": "championship",
        "name": c.get("name"),
        "description": c.get("description") or "",
        "avatar": c.get("avatar") or None,
        "cover": c.get("cover_image") or None,
        "region": c.get("region"),
        "status": c.get("status"),
        "starts_at": c.get("championship_start"),
        "subscriptions": c.get("current_subscriptions"),
        "slots": c.get("total_slots") or c.get("slots"),
        "organizer_id": c.get("organizer_id"),
        "faceit_url": (c.get("faceit_url") or "").replace("{lang}", "en") or None,
        "results": results[:16],
    }


def get_tournament(tid):
    """One tournament, plus its bracket if one has been drawn."""
    t = _get("/tournaments/" + tid)

    rounds = []
    try:
        b = _get("/tournaments/%s/brackets" % tid)
        for rnd in b.get("rounds") or []:
            matches = []
            for m in rnd.get("matches") or []:
                fac = m.get("factions") or {}
                score = (m.get("results") or {}).get("score") or {}

                def side(key):
                    f = fac.get(key) or {}
                    return {"name": f.get("name"), "score": score.get(key)}

                matches.append({
                    "a": side("faction1"),
                    "b": side("faction2"),
                    "status": m.get("status"),
                })
            rounds.append({"name": rnd.get("name") or rnd.get("label"), "matches": matches})
    except FaceitError:
        pass

    return {
        "id": tid,
        "kind": "tournament",
        "name": t.get("name"),
        "description": t.get("description") or "",
        "cover": t.get("cover_image") or t.get("featured_image") or None,
        "region": t.get("region"),
        "status": t.get("status"),
        "players": t.get("number_of_players"),
        "best_of": t.get("best_of"),
        "match_type": t.get("match_type"),
        "min_skill": t.get("min_skill"),
        "max_skill": t.get("max_skill"),
        "organizer_id": t.get("organizer_id"),
        "faceit_url": (t.get("faceit_url") or "").replace("{lang}", "en") or None,
        "rounds": rounds,
    }


def get_organizer(organizer_id):
    """An organizer plus everything they run."""
    o = _get("/organizers/" + organizer_id)

    def hubs_of():
        try:
            d = _get("/organizers/%s/hubs" % organizer_id, params={"offset": 0, "limit": 12})
            return [{"hub_id": h.get("hub_id"), "name": h.get("name"),
                     "avatar": h.get("avatar") or None,
                     "players": h.get("players_joined")}
                    for h in d.get("items", []) if h.get("hub_id")]
        except FaceitError:
            return []

    def comps_of(kind):
        try:
            d = _get("/organizers/%s/%s" % (organizer_id, kind),
                     params={"offset": 0, "limit": 12})
            return _competition_rows(d.get("items", []))
        except FaceitError:
            return []

    with ThreadPoolExecutor(max_workers=3) as pool:
        f_hubs = pool.submit(hubs_of)
        f_champs = pool.submit(comps_of, "championships")
        f_tours = pool.submit(comps_of, "tournaments")
        hubs, champs, tours = f_hubs.result(), f_champs.result(), f_tours.result()

    return {
        "organizer_id": organizer_id,
        "name": o.get("name"),
        "description": o.get("description") or "",
        "avatar": o.get("avatar") or None,
        "cover": o.get("cover") or None,
        "followers": o.get("followers_count"),
        "faceit_url": (o.get("faceit_url") or "").replace("{lang}", "en") or None,
        "links": dict((k, o.get(k)) for k in ("website", "twitch", "twitter", "youtube") if o.get(k)),
        "hubs": hubs,
        "championships": champs,
        "tournaments": tours,
    }


def get_player_hubs(player_id):
    """FACEIT hubs the player belongs to."""
    try:
        data = _get(f"/players/{player_id}/hubs", params={"offset": 0, "limit": 20})
    except Exception:
        return []
    out = []
    for h in data.get("items", []):
        out.append({
            "name": h.get("name"),
            "game": h.get("game_id"),
            "players": h.get("players_joined"),
        })
    return out


def build_have_we_met(nick1, nick2):
    """Matches two players share: together (same team) vs against (opposing)."""
    def results_map(nick):
        p = get_player_by_nickname(nick)
        pid = p["player_id"]
        res = {}
        for it in get_match_stats(pid, limit=100):
            s = it.get("stats", {})
            mid = s.get("Match Id") or s.get("Match ID")
            r = _to_int(s.get("Result"))
            if mid is not None and r is not None:
                res[mid] = r
        return p.get("nickname"), res

    n1, r1 = results_map(nick1)
    n2, r2 = results_map(nick2)
    common = set(r1) & set(r2)
    together = sum(1 for mid in common if r1[mid] == r2[mid])
    return {
        "p1": n1, "p2": n2,
        "encounters": len(common),
        "together": together,
        "against": len(common) - together,
    }


def get_steam_info(steam_id):
    """Steam context (CS2 hours, VAC, profile). Needs STEAM_API_KEY. Cached 1h."""
    key = os.environ.get("STEAM_API_KEY", "")
    if not key or not steam_id:
        return None
    cache_key = f"steam:{steam_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    info = {"hours_cs2": None, "vac_banned": None, "vac_count": None,
            "profile_url": None, "created": None, "persona": None,
            "avatar": None, "country": None}
    base = "https://api.steampowered.com"
    # Shares steam.py's GET helper so the STEAM_INSECURE corporate-proxy
    # escape hatch applies to these Web API calls too.
    from .steam import _get as steam_get
    try:
        r = steam_get(f"{base}/ISteamUser/GetPlayerSummaries/v2/",
                      params={"key": key, "steamids": steam_id}, timeout=10)
        players = r.json().get("response", {}).get("players", [])
        if players:
            p = players[0]
            info["persona"] = p.get("personaname")
            info["profile_url"] = p.get("profileurl")
            info["created"] = p.get("timecreated")
            info["avatar"] = p.get("avatarfull")
            info["country"] = p.get("loccountrycode")
    except (requests.RequestException, ValueError):
        pass
    try:
        r = steam_get(f"{base}/ISteamUser/GetPlayerBans/v1/",
                      params={"key": key, "steamids": steam_id}, timeout=10)
        arr = r.json().get("players", [])
        if arr:
            info["vac_banned"] = arr[0].get("VACBanned")
            info["vac_count"] = arr[0].get("NumberOfVACBans")
    except (requests.RequestException, ValueError):
        pass
    try:
        r = steam_get(f"{base}/IPlayerService/GetOwnedGames/v1/",
                      params={"key": key, "steamid": steam_id,
                              "include_played_free_games": 1,
                              "appids_filter[0]": 730}, timeout=10)
        games = r.json().get("response", {}).get("games", [])
        for g in games:
            if g.get("appid") == 730:
                info["hours_cs2"] = round(g.get("playtime_forever", 0) / 60)
                break
    except (requests.RequestException, ValueError):
        pass

    cache.set(cache_key, info, 3600)
    return info


def _player_won(match, player_nickname):
    """True if the player's faction won this history match, else False/None."""
    teams = match.get("teams", {})
    winner = (match.get("results", {}) or {}).get("winner")
    for side, t in teams.items():
        names = [p.get("nickname") for p in t.get("players", [])]
        if player_nickname in names:
            return winner == side if winner else None
    return None


def build_hltv_stats(items, n=30):
    """
    HLTV-style performance over the last `n` matches.
    NOTE: a true HLTV Rating 2.0 needs per-round data (KAST, impact) that the
    FACEIT API does not expose, so the rating here is an APPROXIMATION derived
    from per-match kills/deaths/assists/ADR. Labelled 'approx' in the UI.
    """
    items = items[:n]
    kpr_l, dpr_l, apr_l, adr_l, hs_l, kd_l = [], [], [], [], [], []

    for it in items:
        s = it.get("stats", {})
        try:
            kills = float(s.get("Kills"))
            deaths = float(s.get("Deaths"))
            kpr = float(s.get("K/R Ratio"))
        except (TypeError, ValueError):
            continue
        if kpr <= 0:
            continue
        rounds = kills / kpr
        if rounds <= 0:
            continue
        kpr_l.append(kpr)
        dpr_l.append(deaths / rounds)
        try:
            apr_l.append(float(s.get("Assists", 0)) / rounds)
        except (TypeError, ValueError):
            pass
        for key, lst in (("ADR", adr_l), ("Average Damage per Round", adr_l)):
            v = s.get(key)
            if v is not None:
                try:
                    lst.append(float(v)); break
                except (TypeError, ValueError):
                    pass
        try:
            hs_l.append(float(s.get("Headshots %")))
        except (TypeError, ValueError):
            pass
        try:
            kd_l.append(float(s.get("K/D Ratio")))
        except (TypeError, ValueError):
            pass

    if not kpr_l:
        return None

    def avg(lst):
        return sum(lst) / len(lst) if lst else 0.0

    kpr, dpr, apr, adr = avg(kpr_l), avg(dpr_l), avg(apr_l), avg(adr_l)
    hs, kd = avg(hs_l), avg(kd_l)

    # Estimate KAST (no round data) from kill output + survival.
    kast = max(0.0, min(100.0, (1 - dpr) * 100 * 0.55 + kpr * 100 * 0.45))
    impact = 2.13 * kpr + 0.42 * apr - 0.41
    rating = (
        0.0073 * kast + 0.3591 * kpr - 0.5329 * dpr
        + 0.2372 * impact + 0.0032 * adr + 0.1587
    )

    # faceitperf-style aggregate adds Firepower (round-weighted over the same n).
    from . import performance as _perf
    agg = _perf.aggregate_performance(items)

    return {
        "matches": len(kpr_l),
        "rating": round(max(0, rating), 2),
        "kpr": round(kpr, 2),
        "dpr": round(dpr, 2),
        "apr": round(apr, 2),
        "adr": round(adr, 0),
        "kast": round(kast, 0),
        "impact": round(max(0, impact), 2),
        "hs": round(hs, 0),
        "kd": round(kd, 2),
        "firepower": agg["firepower"] if agg else None,
    }


def build_elo_extremes(elo_history):
    """Highest / lowest / average ELO from the (approx) ELO history."""
    elos = [p["elo"] for p in elo_history if p.get("elo") is not None]
    if not elos:
        return None
    return {
        "high": max(elos),
        "low": min(elos),
        "avg": round(sum(elos) / len(elos)),
    }


def build_activity(items, days=90):
    """Matches-per-day for the last `days` days (for a contribution heatmap)."""
    from datetime import datetime, timezone, timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    counts = {}
    for it in items:
        s = it.get("stats", {})
        ts = _ts_seconds(s.get("Match Finished At") or s.get("Updated At") or s.get("Created At"))
        if ts is None:
            continue
        d = datetime.fromtimestamp(ts, tz=timezone.utc)
        if d < cutoff:
            continue
        key = d.strftime("%Y-%m-%d")
        counts[key] = counts.get(key, 0) + 1
    return [{"date": k, "count": v} for k, v in sorted(counts.items())]


def build_player_summary(nickname):
    """
    Aggregate everything the frontend needs into a single dict:
    profile + lifetime stats + match history + ELO history + maps + ranking + bans.
    Result is cached for CACHE_TTL seconds.
    """
    cache_key = f"summary:{nickname.lower()}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    player = get_player_by_nickname(nickname)
    player_id = player["player_id"]

    cs2 = player.get("games", {}).get(GAME, {})
    current_elo = cs2.get("faceit_elo")
    region = cs2.get("region")
    steam_id = cs2.get("game_player_id")

    # Everything below needs only player_id / region / steam_id, so fetch it in
    # parallel instead of paying ~10 round-trips back to back. None of these
    # touch the ORM, so no per-thread DB connections are opened. A failing call
    # still raises out of .result(), same as when these ran sequentially.
    with ThreadPoolExecutor(max_workers=7) as pool:
        f_stats = pool.submit(get_player_stats, player_id)
        f_history = pool.submit(get_player_history, player_id, limit=30)
        f_recent = pool.submit(get_recent_match_stats, player_id, total=250)
        f_ranking = pool.submit(get_player_ranking, player_id, region)
        f_bans = pool.submit(get_player_bans, player_id)
        f_hubs = pool.submit(get_player_hubs, player_id)
        f_steam = pool.submit(get_steam_info, steam_id)

        stats = f_stats.result()
        history = f_history.result()
        recent_all = f_recent.result()
        ranking = f_ranking.result()
        bans = f_bans.result()
        hubs = f_hubs.result()
        steam = f_steam.result()

    # The first page of recent_all is the same data a separate
    # get_match_stats(limit=50) would return, so slice it instead of re-asking.
    match_items = recent_all[:50]

    lifetime = stats.get("lifetime", {})
    map_stats = extract_map_stats(stats)
    elo_history = build_elo_history(player_id, current_elo, items=match_items)
    session_info = build_sessions_and_streak(player_id, items=match_items)
    form_trend = build_form_and_trend(match_items)
    best_teammates = build_best_teammates(history, player.get("nickname"))
    teammates_full = build_best_teammates(history, player.get("nickname"), top=25, min_games=2)
    nemeses = build_nemeses(history, player.get("nickname"))
    nicknames = []
    recent_avg = build_recent_averages(match_items, n=30)
    hltv = build_hltv_stats(match_items, n=30)
    elo_extremes = build_elo_extremes(elo_history)
    activity = build_activity(recent_all)
    multikills = build_multikills(match_items)
    # Per-match estimated rating, keyed by match id, so the collapsed match list
    # can show a rating without expanding each row.
    from . import performance as _perf
    perf_by_match = {}
    for _it in match_items:
        _s = _it.get("stats", {})
        _mid = _s.get("Match Id") or _it.get("match_id")
        if _mid:
            _p = _perf.match_performance(_s)
            if _p:
                perf_by_match[_mid] = _p["rating"]
    # distinct maps in recent matches (for the filter dropdown)
    maps_played = sorted({
        it.get("stats", {}).get("Map")
        for it in match_items
        if it.get("stats", {}).get("Map")
    })

    # Remember this player for the daily ELO snapshot cron, and pull any
    # real snapshots we've already collected.
    elo_snapshots = []
    try:
        from django.utils import timezone
        from .models import TrackedPlayer, EloSnapshot, NicknameHistory
        TrackedPlayer.objects.update_or_create(
            player_id=player_id,
            defaults={"nickname": player.get("nickname"), "last_searched": timezone.now()},
        )
        if player.get("nickname"):
            NicknameHistory.objects.get_or_create(
                player_id=player_id, nickname=player.get("nickname")
            )
        nicknames = [
            {"nickname": n.nickname, "first_seen": n.first_seen.isoformat()}
            for n in NicknameHistory.objects.filter(player_id=player_id).order_by("first_seen")
        ]
        elo_snapshots = [
            {"date": s.date.isoformat(), "elo": s.elo}
            for s in EloSnapshot.objects.filter(player_id=player_id).order_by("date")
        ]
    except Exception:
        # DB not migrated yet or unavailable - degrade gracefully.
        pass

    from . import allstar as _allstar
    result = {
        "player_id": player_id,
        "nickname": player.get("nickname"),
        "allstar_enabled": _allstar.is_configured(),
        "avatar": player.get("avatar"),
        # FACEIT lets players set a profile banner. The Data API exposes it as
        # cover_image, with cover_featured_image as the (rarer) editorial one.
        # Both are often "" rather than absent, so normalise to None.
        "cover": player.get("cover_featured_image") or player.get("cover_image") or None,
        # The API hands back faceit_url with a literal "{lang}" placeholder,
        # so it 404s if passed through untouched.
        "faceit_url": (player.get("faceit_url") or "").replace("{lang}", "en") or None,
        "country": player.get("country"),
        "region": region,
        "elo": current_elo,
        "skill_level": cs2.get("skill_level"),
        "verified": player.get("verified", False),
        "steam_id": steam_id,
        "memberships": player.get("memberships", []),
        "ranking": ranking,
        "bans": bans,
        "streak": session_info["streak"],
        "last_session": session_info["last_session"],
        "form": form_trend["form"],
        "kd_trend": form_trend["kd_trend"],
        "recent_avg": recent_avg,
        "hltv": hltv,
        "elo_extremes": elo_extremes,
        "activity": activity,
        "multikills": multikills,
        "maps_played": maps_played,
        "best_teammates": best_teammates,
        "teammates_full": teammates_full,
        "nemeses": nemeses,
        "hubs": hubs,
        "steam": steam,
        "nicknames": nicknames,
        "elo_history": elo_history,
        "elo_snapshots": elo_snapshots,
        "map_stats": map_stats,
        "stats": {
            "matches": lifetime.get("Matches"),
            "win_rate": lifetime.get("Win Rate %"),
            "avg_kd": lifetime.get("Average K/D Ratio"),
            "avg_hs": lifetime.get("Average Headshots %"),
            "longest_win_streak": lifetime.get("Longest Win Streak"),
            "current_win_streak": lifetime.get("Current Win Streak"),
        },
        "recent_matches": [
            {
                "match_id": m.get("match_id"),
                "started_at": m.get("started_at"),
                "finished_at": m.get("finished_at"),
                "competition": m.get("competition_name"),
                "won": _player_won(m, player.get("nickname")),
                "rating": perf_by_match.get(m.get("match_id")),
                "teams": {
                    side: {
                        "nickname": t.get("nickname"),
                        "players": [p.get("nickname") for p in t.get("players", [])],
                    }
                    for side, t in m.get("teams", {}).items()
                },
            }
            for m in history[:10]
        ],
    }

    cache.set(cache_key, result, CACHE_TTL)
    return result
