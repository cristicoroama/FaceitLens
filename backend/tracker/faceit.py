"""
Service that talks to the FACEIT Data API v4.
Docs: https://developers.faceit.com/docs/tools/data-api
"""
import os
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


def get_leaderboard(region, country=None, limit=20):
    """Top players globally or by country for CS2."""
    params = {"offset": 0, "limit": limit}
    if country:
        params["country"] = country
    data = _get(f"/rankings/games/{GAME}/regions/{region}", params=params)
    out = []
    for item in data.get("items", []):
        out.append({
            "position": item.get("position"),
            "nickname": item.get("nickname"),
            "player_id": item.get("player_id"),
            "elo": item.get("faceit_elo"),
            "level": item.get("game_skill_level"),
            "country": item.get("country"),
        })
    return out


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

    for team in rnd.get("teams", []):
        tstats = team.get("team_stats", {})
        players = []
        for p in team.get("players", []):
            ps = p.get("player_stats", {})
            players.append({
                "nickname": p.get("nickname"),
                "kills": ps.get("Kills"),
                "deaths": ps.get("Deaths"),
                "assists": ps.get("Assists"),
                "kd": ps.get("K/D Ratio"),
                "hs": ps.get("Headshots %"),
                "adr": ps.get("ADR") or ps.get("Average Damage per Round"),
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

    mates = [
        {
            "nickname": nick,
            "games": g,
            "wins": w,
            "win_rate": round(w / g * 100),
        }
        for nick, (g, w) in tally.items()
        if g >= min_games
    ]
    mates.sort(key=lambda x: (x["games"], x["win_rate"]), reverse=True)
    return mates[:top]


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
            "profile_url": None, "created": None, "persona": None}
    base = "https://api.steampowered.com"
    try:
        r = requests.get(f"{base}/ISteamUser/GetPlayerSummaries/v2/",
                         params={"key": key, "steamids": steam_id}, timeout=10)
        players = r.json().get("response", {}).get("players", [])
        if players:
            p = players[0]
            info["persona"] = p.get("personaname")
            info["profile_url"] = p.get("profileurl")
            info["created"] = p.get("timecreated")
    except (requests.RequestException, ValueError):
        pass
    try:
        r = requests.get(f"{base}/ISteamUser/GetPlayerBans/v1/",
                         params={"key": key, "steamids": steam_id}, timeout=10)
        arr = r.json().get("players", [])
        if arr:
            info["vac_banned"] = arr[0].get("VACBanned")
            info["vac_count"] = arr[0].get("NumberOfVACBans")
    except (requests.RequestException, ValueError):
        pass
    try:
        r = requests.get(f"{base}/IPlayerService/GetOwnedGames/v1/",
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
    stats = get_player_stats(player_id)
    lifetime = stats.get("lifetime", {})
    history = get_player_history(player_id, limit=30)
    match_items = get_match_stats(player_id, limit=50)
    current_elo = cs2.get("faceit_elo")
    region = cs2.get("region")
    elo_history = build_elo_history(player_id, current_elo, items=match_items)
    ranking = get_player_ranking(player_id, region)
    map_stats = extract_map_stats(stats)
    bans = get_player_bans(player_id)
    session_info = build_sessions_and_streak(player_id, items=match_items)
    form_trend = build_form_and_trend(match_items)
    best_teammates = build_best_teammates(history, player.get("nickname"))
    teammates_full = build_best_teammates(history, player.get("nickname"), top=25, min_games=2)
    hubs = get_player_hubs(player_id)
    steam_id = cs2.get("game_player_id")
    steam = get_steam_info(steam_id)
    nicknames = []
    recent_avg = build_recent_averages(match_items, n=30)
    hltv = build_hltv_stats(match_items, n=30)
    elo_extremes = build_elo_extremes(elo_history)
    activity = build_activity(get_recent_match_stats(player_id, total=250))
    multikills = build_multikills(match_items)
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

    result = {
        "player_id": player_id,
        "nickname": player.get("nickname"),
        "avatar": player.get("avatar"),
        "country": player.get("country"),
        "region": region,
        "elo": current_elo,
        "skill_level": cs2.get("skill_level"),
        "verified": player.get("verified", False),
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
