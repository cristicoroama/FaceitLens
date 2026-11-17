"""Hub and championship match lists, hub rules, championship standings,
clan/organizer search, and live detection through a player's hubs."""
import html
import re
from concurrent.futures import ThreadPoolExecutor

from django.core.cache import cache

from .faceit import GAME, FaceitError, _get, find_live_match, get_player_history

KINDS = ("ongoing", "upcoming", "past")
TTL = {"ongoing": 30, "upcoming": 300, "past": 300}
LIVE = {"ONGOING", "PAUSED"}
STARTING = {"READY", "CONFIGURING", "VOTING", "CAPTAIN_PICK", "CHECK_IN", "SUBSTITUTION"}
MAX_HUBS = 8
LIVE_TTL = 30


def _ts(v):
    try:
        v = int(v)
    except (TypeError, ValueError):
        return None
    return v // 1000 if v > 10 ** 11 else v


def _url(u):
    return (u or "").replace("{lang}", "en") or None


def _state(status):
    s = (status or "").upper()
    if s in LIVE:
        return "live"
    if s in STARTING:
        return "starting"
    if s == "FINISHED":
        return "finished"
    if s in ("CANCELLED", "ABORTED"):
        return "cancelled"
    return "upcoming"


def _faction(f, score, winner, key):
    f = f or {}
    roster = f.get("roster") or f.get("players") or []
    return {
        "name": f.get("name") or f.get("nickname") or "TBD",
        "avatar": f.get("avatar") or None,
        "score": score.get(key),
        "won": (winner == key) if winner else None,
        "roster": [
            {
                "player_id": p.get("player_id"),
                "nickname": p.get("nickname"),
                "avatar": p.get("avatar") or None,
                "level": p.get("game_skill_level") or p.get("skill_level"),
            }
            for p in roster if p.get("nickname")
        ],
    }


def match_card(m):
    teams = m.get("teams") or {}
    res = m.get("results") or {}
    score = res.get("score") or {}
    winner = res.get("winner")
    picks = ((m.get("voting") or {}).get("map") or {}).get("pick") or []
    return {
        "match_id": m.get("match_id"),
        "status": m.get("status"),
        "state": _state(m.get("status")),
        "map": picks[0] if picks else None,
        "competition": m.get("competition_name"),
        "best_of": m.get("best_of"),
        "round": m.get("round"),
        "group": m.get("group"),
        "started_at": _ts(m.get("started_at")),
        "scheduled_at": _ts(m.get("scheduled_at")),
        "finished_at": _ts(m.get("finished_at")),
        "faceit_url": _url(m.get("faceit_url")),
        "teams": [_faction(teams.get(k), score, winner, k) for k in ("faction1", "faction2")],
    }


def _matches(path, kind, limit=30):
    if kind not in KINDS:
        kind = "ongoing"
    key = f"cm:{path}:{kind}:{limit}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    d = _get(path, params={"type": kind, "offset": 0, "limit": limit})
    items = [match_card(m) for m in d.get("items") or [] if m.get("match_id")]
    if kind == "past":
        items.sort(key=lambda x: x["finished_at"] or 0, reverse=True)
    elif kind == "upcoming":
        items.sort(key=lambda x: x["scheduled_at"] or 0)
    else:
        items = [i for i in items if i["state"] in ("live", "starting")] or items
    out = {"type": kind, "items": items}
    cache.set(key, out, TTL[kind])
    return out


def hub_matches(hub_id, kind="ongoing"):
    return _matches(f"/hubs/{hub_id}/matches", kind)


def championship_matches(cid, kind="ongoing"):
    return _matches(f"/championships/{cid}/matches", kind)


def _plain(text):
    t = re.sub(r"<\s*br\s*/?>", "\n", text or "", flags=re.I)
    t = re.sub(r"</\s*(p|div|li|h\d)\s*>", "\n", t, flags=re.I)
    t = re.sub(r"<\s*li[^>]*>", "• ", t, flags=re.I)
    t = re.sub(r"<[^>]+>", "", t)
    t = html.unescape(t)
    return re.sub(r"\n{3,}", "\n\n", t).strip()


def hub_rules(hub_id):
    key = f"hubrules:{hub_id}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    try:
        d = _get(f"/hubs/{hub_id}/rules")
    except FaceitError:
        d = {}
    out = {"name": d.get("name") or None, "body": _plain(d.get("body"))[:20000]}
    cache.set(key, out, 6 * 60 * 60)
    return out


def _pct(v):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    return round(v * 100 if v <= 1 else v)


def championship_standings(cid):
    key = f"champstand:{cid}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    try:
        d = _get(f"/leaderboards/championships/{cid}", params={"offset": 0, "limit": 20})
    except FaceitError:
        cache.set(key, {"groups": []}, 5 * 60)
        return {"groups": []}

    boards = [b for b in d.get("items") or [] if b.get("leaderboard_id")][:8]

    def one(b):
        try:
            r = _get(f"/leaderboards/{b['leaderboard_id']}", params={"offset": 0, "limit": 20})
        except FaceitError:
            return None
        rows = []
        for it in r.get("items") or []:
            p = it.get("player") or it.get("team") or {}
            rows.append({
                "position": it.get("position"),
                "name": p.get("nickname") or p.get("name"),
                "player_id": p.get("user_id") or p.get("player_id"),
                "avatar": p.get("avatar") or None,
                "points": it.get("points"),
                "played": it.get("played"),
                "won": it.get("won"),
                "lost": it.get("lost"),
                "draw": it.get("draw"),
                "win_rate": _pct(it.get("win_rate")),
            })
        rows = [x for x in rows if x["name"]]
        rows.sort(key=lambda x: x["position"] or 9999)
        g = b.get("group")
        return {
            "name": b.get("leaderboard_name") or (f"Group {g}" if g else "Standings"),
            "group": g,
            "rows": rows,
        }

    with ThreadPoolExecutor(max_workers=4) as pool:
        groups = [g for g in pool.map(one, boards) if g and g["rows"]]
    groups.sort(key=lambda g: (g["group"] is None, g["group"] or 0))
    out = {"groups": groups}
    cache.set(key, out, 5 * 60)
    return out


def search_clans(query, limit=10):
    key = f"clansearch:{query.lower()}:{limit}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    try:
        d = _get("/search/clans", params={"name": query, "game": GAME, "offset": 0, "limit": limit})
    except FaceitError:
        d = {}
    out = []
    for it in d.get("items") or []:
        cid = it.get("clan_id") or it.get("guid") or it.get("id")
        if not cid or not it.get("name"):
            continue
        out.append({
            "id": cid,
            "name": it.get("name"),
            "avatar": it.get("avatar") or None,
            "region": it.get("region") or None,
            "members": it.get("members_count") or it.get("member_count"),
            "verified": bool(it.get("verified")),
            "faceit_url": _url(it.get("faceit_url")),
        })
    cache.set(key, out, 10 * 60)
    return out


def search_organizers(query, limit=8):
    key = f"orgsearch:{query.lower()}:{limit}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    try:
        d = _get("/search/organizers", params={"name": query, "offset": 0, "limit": limit})
    except FaceitError:
        d = {}
    out = []
    for it in d.get("items") or []:
        oid = it.get("organizer_id") or it.get("id")
        if not oid or not it.get("name"):
            continue
        games = it.get("games") or []
        if games and GAME not in games and "csgo" not in games:
            continue
        out.append({
            "id": oid,
            "kind": "organizer",
            "name": it.get("name"),
            "avatar": it.get("avatar") or None,
            "partner": bool(it.get("partner")),
            "region": ", ".join((it.get("regions") or [])[:3]) or None,
        })
    cache.set(key, out, 10 * 60)
    return out


def _player_hub_ids(player_id):
    key = f"phubids:{player_id}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    try:
        d = _get(f"/players/{player_id}/hubs", params={"offset": 0, "limit": 50})
    except FaceitError:
        return []
    ids = [h["hub_id"] for h in d.get("items") or []
           if h.get("hub_id") and (h.get("game_id") or GAME) == GAME][:MAX_HUBS]
    cache.set(key, ids, 60 * 60)
    return ids


def _live_from(card, player_id):
    for t in card["teams"]:
        if any(p["player_id"] == player_id for p in t["roster"]):
            return {
                "match_id": card["match_id"],
                "state": "live" if card["state"] == "live" else "starting",
                "map": card["map"],
                "competition": card["competition"],
                "teams": [x["name"] for x in card["teams"]],
                "started_at": card["started_at"],
                "faceit_url": card["faceit_url"],
            }
    return None


def find_hub_live(player_id):
    hubs = _player_hub_ids(player_id)
    if not hubs:
        return None, False

    def scan(hid):
        try:
            return hub_matches(hid, "ongoing")["items"]
        except FaceitError:
            return []

    with ThreadPoolExecutor(max_workers=4) as pool:
        for items in pool.map(scan, hubs):
            for card in items:
                if card["state"] not in ("live", "starting"):
                    continue
                hit = _live_from(card, player_id)
                if hit:
                    return hit, True
    return None, True


def get_live_status(player_id):
    if not player_id:
        return {"live": None, "ok": False, "watch": False}
    key = f"live2:{player_id}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    try:
        live, watch = find_hub_live(player_id)
        if not live:
            live = find_live_match(get_player_history(player_id, limit=3))
    except FaceitError:
        out = {"live": None, "ok": False, "watch": True}
        cache.set(key, out, 5)
        return out
    out = {"live": live, "ok": True, "watch": watch}
    cache.set(key, out, LIVE_TTL)
    return out
