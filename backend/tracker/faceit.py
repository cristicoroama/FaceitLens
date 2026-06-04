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


def get_player_stats(player_id):
    """Lifetime + per-map stats for CS2."""
    return _get(f"/players/{player_id}/stats/{GAME}")


def get_player_history(player_id, limit=10):
    """The player's most recent matches."""
    data = _get(f"/players/{player_id}/history", params={"game": GAME, "offset": 0, "limit": limit})
    return data.get("items", [])


# Approximate ELO gained/lost per match (FACEIT does not expose the real value).
ELO_PER_MATCH = 25


def get_match_stats(player_id, limit=30):
    """Per-match stats (contain the win/loss result and the date)."""
    data = _get(
        f"/players/{player_id}/games/{GAME}/stats",
        params={"offset": 0, "limit": limit},
    )
    return data.get("items", [])


def _to_int(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def build_elo_history(player_id, current_elo, limit=30):
    """
    Reconstruct the ELO curve by walking backwards from the current ELO.
    Each match moves the ELO by ~ELO_PER_MATCH (approximate).
    Returns a chronological list: [{date, elo, result}].
    """
    if current_elo is None:
        return []

    items = get_match_stats(player_id, limit=limit)

    # Extract (date, result) for each match.
    matches = []
    for item in items:
        s = item.get("stats", {})
        date = _to_int(s.get("Match Finished At") or s.get("Updated At") or s.get("Created At"))
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


def get_match_detail(match_id):
    """
    Return a simplified scoreboard for a single match.
    Combines /matches/{id} (teams, score) with /matches/{id}/stats (player K/D).
    """
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
    detail["map"] = rnd.get("round_stats", {}).get("Map")
    for team in rnd.get("teams", []):
        players = []
        for p in team.get("players", []):
            ps = p.get("player_stats", {})
            players.append({
                "nickname": p.get("nickname"),
                "kills": ps.get("Kills"),
                "deaths": ps.get("Deaths"),
                "kd": ps.get("K/D Ratio"),
            })
        detail["teams"].append({
            "name": team.get("team_stats", {}).get("Team"),
            "win": team.get("team_stats", {}).get("Team Win") == "1",
            "players": players,
        })
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
    history = get_player_history(player_id)
    current_elo = cs2.get("faceit_elo")
    region = cs2.get("region")
    elo_history = build_elo_history(player_id, current_elo)
    ranking = get_player_ranking(player_id, region)
    map_stats = extract_map_stats(stats)
    bans = get_player_bans(player_id)

    # Remember this player for the daily ELO snapshot cron, and pull any
    # real snapshots we've already collected.
    elo_snapshots = []
    try:
        from .models import TrackedPlayer, EloSnapshot
        TrackedPlayer.objects.update_or_create(
            player_id=player_id,
            defaults={"nickname": player.get("nickname")},
        )
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
        "ranking": ranking,
        "bans": bans,
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
                "teams": {
                    side: {
                        "nickname": t.get("nickname"),
                        "players": [p.get("nickname") for p in t.get("players", [])],
                    }
                    for side, t in m.get("teams", {}).items()
                },
            }
            for m in history
        ],
    }

    cache.set(cache_key, result, CACHE_TTL)
    return result
