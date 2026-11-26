import json
import os
import re
from concurrent.futures import ThreadPoolExecutor

from django.core.cache import cache
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from . import faceit
from .profiles import _client_ip

STEAM64_BASE = 76561197960265728
MAX_LOBBY = 10
LOBBY_WORKERS = 5
LOBBY_TTL = 10 * 60
LOBBY_ERROR_TTL = 60
LOBBY_RATE_LIMIT = int(os.environ.get("LOBBY_RATE_LIMIT", "30"))
LOBBY_RATE_WINDOW = 60 * 60
INTEL_TTL = 10 * 60
INTEL_RATE_LIMIT = int(os.environ.get("INTEL_RATE_LIMIT", "60"))
INTEL_RATE_WINDOW = 60 * 60
CORE_TTL = 2 * 60
MAPSTATS_TTL = 30 * 60
RECENT_TTL = 20 * 60
RECENT_N = 50
SHRINK_K = 15
ELO_K = 50

DEFAULT_POOL = ["ancient", "anubis", "dust2", "inferno", "mirage", "nuke", "overpass", "train"]

_STEAM3_RE = re.compile(r"\[U:1:(\d+)\]")
_STEAM2_RE = re.compile(r"STEAM_[0-5]:([01]):(\d+)")
_STEAM64_RE = re.compile(r"(?<!\d)(7656119\d{10})(?!\d)")
_VANITY_RE = re.compile(r"steamcommunity\.com/id/([\w.\-]+)")


def parse_steam_ids(text, resolve_vanity=False):
    found = []
    for m in re.finditer(
        r"\[U:1:\d+\]|STEAM_[0-5]:[01]:\d+|(?<!\d)7656119\d{10}(?!\d)|steamcommunity\.com/id/[\w.\-]+",
        text or "",
    ):
        token = m.group(0)
        sid = None
        m3 = _STEAM3_RE.fullmatch(token)
        m2 = _STEAM2_RE.fullmatch(token)
        if m3:
            sid = str(STEAM64_BASE + int(m3.group(1)))
        elif m2:
            sid = str(STEAM64_BASE + int(m2.group(2)) * 2 + int(m2.group(1)))
        elif _STEAM64_RE.fullmatch(token):
            sid = token
        elif resolve_vanity:
            mv = _VANITY_RE.search(token)
            if mv:
                from . import steam
                sid = steam.resolve_steamid(token)
        if sid and sid not in found:
            found.append(sid)
    return found


def _over_limit(request, kind, limit, window):
    key = f"rl:{kind}:{_client_ip(request)}"
    try:
        used = cache.incr(key)
    except ValueError:
        cache.set(key, 1, window)
        used = 1
    if used > limit:
        return JsonResponse(
            {"error": "Too many requests from this address. Try again later."},
            status=429,
            headers={"Retry-After": str(window)},
        )
    return None


def _lifetime_matches(player_id):
    try:
        stats = faceit.get_player_stats(player_id)
    except faceit.FaceitError:
        return None
    try:
        return int((stats.get("lifetime") or {}).get("Matches"))
    except (TypeError, ValueError):
        return None


def _steam_extras(steamid):
    if not os.environ.get("STEAM_API_KEY", ""):
        return {}, None
    from . import steam
    info = faceit.get_steam_info(steamid) or {}
    try:
        level = steam.get_steam_level(steamid)
    except Exception:
        level = None
    return info, level


def _trust_for(info, level, matches, faceit_banned, verified):
    import time
    from . import trust
    created = info.get("created")
    signals = {
        "account_age_days": int((time.time() - created) / 86400) if created else None,
        "hours_cs2": info.get("hours_cs2"),
        "steam_level": level,
        "inventory_items": None,
        "faceit_matches": matches,
        "vac_banned": info.get("vac_banned"),
        "vac_count": info.get("vac_count"),
        "faceit_banned": faceit_banned,
        "private_inventory": False,
        "faceit_verified": verified,
    }
    t = trust.compute_trust(signals)
    return {
        "score": t["score"],
        "tier": t["tier"],
        "flags": [f for f in t["flags"] if not f["ok"]],
        "pillars": len(t["breakdown"]),
    }


def lookup_steam(steamid):
    key = f"lobby:sid:v1:{steamid}"
    hit = cache.get(key)
    if hit is not None:
        return hit

    from . import privacy
    row = {"steam_id": steamid, "faceit": None, "hidden": False}
    ttl = LOBBY_TTL
    player = None
    try:
        player = faceit.get_player_by_steam(steamid)
    except faceit.FaceitNotFound:
        player = None
    except faceit.FaceitError:
        row["error"] = "FACEIT didn't answer for this player."
        ttl = LOBBY_ERROR_TTL

    pid = (player or {}).get("player_id")
    nick = (player or {}).get("nickname")
    if privacy.is_suppressed(pid, steamid, nick):
        out = {"steam_id": steamid, "faceit": None, "hidden": True}
        cache.set(key, out, ttl)
        return out

    info, level = _steam_extras(steamid)
    row["steam"] = {
        "available": bool(info),
        "persona": info.get("persona"),
        "avatar": info.get("avatar"),
        "vac_banned": info.get("vac_banned"),
        "vac_count": info.get("vac_count"),
        "game_ban_count": info.get("game_ban_count"),
        "hours_cs2": info.get("hours_cs2"),
        "profile_url": info.get("profile_url") or f"https://steamcommunity.com/profiles/{steamid}/",
    }

    matches = None
    bans = []
    verified = False
    if player:
        cs2 = (player.get("games") or {}).get(faceit.GAME) or {}
        matches = _lifetime_matches(pid)
        bans = faceit.get_player_bans(pid)
        verified = bool(player.get("verified"))
        row["faceit"] = {
            "player_id": pid,
            "nickname": nick,
            "avatar": player.get("avatar") or None,
            "country": player.get("country"),
            "level": cs2.get("skill_level"),
            "elo": cs2.get("faceit_elo"),
            "matches": matches,
            "verified": verified,
            "bans": bans,
            "banned": bool(bans),
        }

    row["trust"] = _trust_for(info, level, matches, bool(bans), verified)
    cache.set(key, row, ttl)
    return row


def check_lobby(steamids):
    ids = list(dict.fromkeys(steamids))[:MAX_LOBBY]
    if not ids:
        return []
    with ThreadPoolExecutor(max_workers=min(LOBBY_WORKERS, len(ids))) as pool:
        futs = [pool.submit(lookup_steam, sid) for sid in ids]
        rows = []
        for sid, fut in zip(ids, futs):
            try:
                rows.append(fut.result())
            except Exception:
                rows.append({"steam_id": sid, "faceit": None, "hidden": False,
                             "error": "Lookup failed."})
    return rows


def _body(request):
    try:
        return json.loads(request.body or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


@csrf_exempt
@require_POST
def lobby_check(request):
    body = _body(request)
    if body is None:
        return JsonResponse({"error": "Bad JSON."}, status=400)
    raw_ids = body.get("ids")
    if isinstance(raw_ids, list):
        text = " ".join(str(x) for x in raw_ids[:50])
    else:
        text = str(body.get("text") or "")[:20000]
    ids = parse_steam_ids(text, resolve_vanity=True)
    if not ids:
        return JsonResponse(
            {"error": "No Steam IDs found. Paste the output of `status` or Steam profile links."},
            status=400,
        )
    truncated = len(ids) > MAX_LOBBY
    ids = ids[:MAX_LOBBY]
    if not faceit.FACEIT_API_KEY:
        return JsonResponse({"error": "FACEIT lookups are not configured."}, status=503)
    if any(cache.get(f"lobby:sid:v1:{sid}") is None for sid in ids):
        limited = _over_limit(request, "lobby", LOBBY_RATE_LIMIT, LOBBY_RATE_WINDOW)
        if limited is not None:
            return limited
    return JsonResponse({
        "players": check_lobby(ids),
        "truncated": truncated,
        "steam_data": bool(os.environ.get("STEAM_API_KEY", "")),
    })


def _map_key(name):
    s = str(name or "").strip().lower()
    if s.startswith("de_") or s.startswith("cs_"):
        s = s[3:]
    return s.replace(" ", "").replace("_", "") or None


def _pool_from_meta(meta):
    ents = (((meta.get("voting") or {}).get("map") or {}).get("entities")) or []
    pool = []
    for e in ents:
        k = _map_key(e.get("game_map_id") or e.get("class_name") or e.get("guid") or e.get("name"))
        if k and k not in pool:
            pool.append(k)
    return pool


def _room_core(match_id):
    key = f"lobby:core:v1:{match_id}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    meta = faceit._get(f"/matches/{match_id}")
    teams_in = meta.get("teams") or {}
    rosters = {}
    for idx, faction in ((1, "faction1"), (2, "faction2")):
        f = teams_in.get(faction) or {}
        rosters[idx] = {
            "name": f.get("name") or faction,
            "win_probability": (f.get("stats") or {}).get("winProbability"),
            "players": [
                {
                    "player_id": r.get("player_id"),
                    "nickname": r.get("nickname"),
                    "level": r.get("game_skill_level"),
                    "steam_id": r.get("game_player_id") or None,
                }
                for r in (f.get("roster") or [])
                if r.get("player_id")
            ],
        }
    ids = [p["player_id"] for t in rosters.values() for p in t["players"]]
    elo = {}
    if ids:
        with ThreadPoolExecutor(max_workers=min(10, len(ids))) as pool:
            futs = {pid: pool.submit(faceit._player_elo_level, pid) for pid in ids}
            for pid, fut in futs.items():
                try:
                    elo[pid] = fut.result() or {}
                except Exception:
                    elo[pid] = {}
    for t in rosters.values():
        for p in t["players"]:
            info = elo.get(p["player_id"]) or {}
            p["elo"] = info.get("elo")
            p["level"] = info.get("level") or p["level"]
            p["steam_id"] = info.get("steam_id") or p["steam_id"]
        elos = [p["elo"] for p in t["players"] if p["elo"]]
        t["avg_elo"] = round(sum(elos) / len(elos)) if elos else None

    prob1, source = None, None
    wp = rosters[1]["win_probability"]
    if isinstance(wp, (int, float)) and 0 <= wp <= 1:
        prob1, source = wp, "faceit"
    elif rosters[1]["avg_elo"] and rosters[2]["avg_elo"]:
        prob1 = 1 / (1 + 10 ** ((rosters[2]["avg_elo"] - rosters[1]["avg_elo"]) / 400))
        source = "elo"

    out = {
        "match_id": match_id,
        "status": meta.get("status"),
        "pool": _pool_from_meta(meta),
        "teams": rosters,
        "prob1": prob1,
        "prob_source": source,
    }
    cache.set(key, out, CORE_TTL)
    return out


def _stakes(p_win):
    gain = max(1, min(ELO_K - 1, round(ELO_K * (1 - p_win))))
    return {"win": gain, "loss": ELO_K - gain}


def elo_stakes(match_id, player_id):
    core = _room_core(match_id)
    if core["prob1"] is None:
        return None
    side = None
    for idx, t in core["teams"].items():
        if any(p["player_id"] == player_id for p in t["players"]):
            side = idx
    if side is None:
        return None
    p = core["prob1"] if side == 1 else 1 - core["prob1"]
    return {
        "side": side,
        "win_probability": round(p * 100),
        "source": core["prob_source"],
        **_stakes(p),
    }


def _player_maps(player_id):
    key = f"lobby:maps:v1:{player_id}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    try:
        stats = faceit.get_player_stats(player_id)
    except faceit.FaceitError:
        return None
    try:
        matches = int((stats.get("lifetime") or {}).get("Matches"))
    except (TypeError, ValueError):
        matches = None
    rows = faceit.extract_map_stats(stats)
    out = {
        "matches": matches,
        "maps": {
            _map_key(m["map"]): {"label": m["map"], "matches": m["matches"],
                                 "win_rate": m["win_rate"], "kd": m["avg_kd"]}
            for m in rows if _map_key(m["map"])
        },
    }
    cache.set(key, out, MAPSTATS_TTL)
    return out


def _player_recent_items(player_id):
    key = f"lobby:recent:v1:{player_id}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    try:
        items = faceit.get_match_stats(player_id, limit=RECENT_N)
    except faceit.FaceitError:
        return None
    cache.set(key, items, RECENT_TTL)
    return items


def _f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _player_intel(p):
    from . import analysis, insights
    pid = p["player_id"]
    maps = _player_maps(pid) or {"matches": None, "maps": {}}
    items = _player_recent_items(pid) or []

    recent_maps = {}
    for it in items:
        s = it.get("stats") or {}
        k = _map_key(s.get("Map"))
        r = s.get("Result")
        if not k or r is None:
            continue
        row = recent_maps.setdefault(k, {"matches": 0, "wins": 0})
        row["matches"] += 1
        row["wins"] += 1 if str(r) == "1" else 0

    avg = faceit.build_recent_averages(items, n=30) if items else {}
    prof = analysis.profile(analysis._norm(items)) if items else None
    tilt = insights.tilt(insights.normalize(items)) if items else None
    sess = faceit.build_sessions_and_streak(pid, items=items) if items else {}
    last = sess.get("last_session") or {}
    streak = sess.get("streak") or {}

    best = sorted(
        [
            {"map": v["label"], "key": k, "matches": v["matches"], "win_rate": v["win_rate"]}
            for k, v in maps["maps"].items()
            if v["matches"] >= 10 and v["win_rate"] is not None
        ],
        key=lambda x: x["win_rate"],
        reverse=True,
    )

    kd = _f(avg.get("kd"))
    adr = _f(avg.get("adr"))
    lifetime = maps["matches"]
    smurf = []
    if lifetime is not None and lifetime < 150 and ((kd or 0) >= 1.3 or (adr or 0) >= 95):
        smurf.append(f"only {lifetime} FACEIT matches but {kd} K/D, {adr} ADR lately")
    if lifetime is not None and lifetime < 100 and (p.get("elo") or 0) >= 2000:
        smurf.append(f"{p.get('elo')} ELO after only {lifetime} matches")

    on_tilt = bool(last.get("tilt")) or (
        streak.get("type") == "L" and (streak.get("count") or 0) >= 3
    )

    return {
        "player_id": pid,
        "nickname": p.get("nickname"),
        "elo": p.get("elo"),
        "level": p.get("level"),
        "lifetime_matches": lifetime,
        "recent": {
            "matches": avg.get("matches"),
            "kd": kd,
            "adr": adr,
            "hs": avg.get("hs"),
            "win_rate": avg.get("win_rate"),
        },
        "role": (prof or {}).get("role", [None])[0] if prof else None,
        "sniper_pr": (prof or {}).get("sniper_pr"),
        "entry_share": (prof or {}).get("entry_share"),
        "tilt_profile": (tilt or {}).get("verdict"),
        "session": {
            "wins": last.get("wins"),
            "losses": last.get("losses"),
            "streak": streak or None,
        },
        "on_tilt": on_tilt,
        "smurf_signals": smurf,
        "best_maps": best[:3],
        "worst_maps": list(reversed(best[-2:])) if len(best) >= 4 else [],
        "_maps": maps["maps"],
        "_recent_maps": recent_maps,
    }


def _shrunk(wins, matches, k=SHRINK_K):
    return (wins + 0.5 * k) / (matches + k)


def _team_map(players, key):
    life_scores, life_m, life_w = [], 0, 0.0
    rec_m, rec_w = 0, 0
    with_data = 0
    for p in players:
        m = p["_maps"].get(key)
        if m and m["matches"] and m["win_rate"] is not None:
            w = m["matches"] * m["win_rate"] / 100
            life_m += m["matches"]
            life_w += w
            life_scores.append(_shrunk(w, m["matches"]))
            with_data += 1
        else:
            life_scores.append(0.5)
        r = p["_recent_maps"].get(key)
        if r:
            rec_m += r["matches"]
            rec_w += r["wins"]
    life_adj = sum(life_scores) / len(life_scores) if life_scores else 0.5
    rec_adj = _shrunk(rec_w, rec_m, k=SHRINK_K * 2)
    return {
        "matches": life_m,
        "win_rate": round(100 * life_w / life_m) if life_m else None,
        "recent_matches": rec_m,
        "recent_win_rate": round(100 * rec_w / rec_m) if rec_m else None,
        "players_with_data": with_data,
        "strength": round(100 * (0.7 * life_adj + 0.3 * rec_adj), 1),
    }


def map_veto(pool, team1, team2):
    keys = list(pool)
    if not keys:
        seen = {}
        for p in team1 + team2:
            for k, v in p["_maps"].items():
                seen[k] = seen.get(k, 0) + (v["matches"] or 0)
        keys = [k for k in DEFAULT_POOL if k in seen] or list(DEFAULT_POOL)
    rows = []
    for k in keys:
        a = _team_map(team1, k)
        b = _team_map(team2, k)
        thin = min(a["matches"], b["matches"])
        conf = "low" if thin < 40 or min(a["players_with_data"], b["players_with_data"]) < 3 \
            else "medium" if thin < 150 else "high"
        label = None
        for p in team1 + team2:
            if k in p["_maps"]:
                label = p["_maps"][k]["label"]
                break
        rows.append({
            "key": k,
            "map": label or k.title(),
            "team1": a,
            "team2": b,
            "delta": round(a["strength"] - b["strength"], 1),
            "confidence": conf,
        })
    rows.sort(key=lambda r: r["delta"], reverse=True)
    return rows


def room_intel(match_id):
    key = f"lobby:intel:v1:{match_id}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    core = _room_core(match_id)
    everyone = [p for t in core["teams"].values() for p in t["players"]]
    intel = {}
    if everyone:
        with ThreadPoolExecutor(max_workers=min(10, len(everyone))) as pool:
            futs = {p["player_id"]: pool.submit(_player_intel, p) for p in everyone}
            for pid, fut in futs.items():
                try:
                    intel[pid] = fut.result()
                except Exception:
                    intel[pid] = None
    teams = {}
    for idx, t in core["teams"].items():
        teams[idx] = [intel[p["player_id"]] for p in t["players"] if intel.get(p["player_id"])]
    veto = map_veto(core["pool"], teams[1], teams[2])

    def public(p):
        return {k: v for k, v in p.items() if not k.startswith("_")}

    out = {
        "match_id": match_id,
        "status": core["status"],
        "pool_source": "room" if core["pool"] else "default",
        "prob1": round(core["prob1"] * 100) if core["prob1"] is not None else None,
        "prob_source": core["prob_source"],
        "team1": {"name": core["teams"][1]["name"], "avg_elo": core["teams"][1]["avg_elo"],
                  "players": [public(p) for p in teams[1]]},
        "team2": {"name": core["teams"][2]["name"], "avg_elo": core["teams"][2]["avg_elo"],
                  "players": [public(p) for p in teams[2]]},
        "veto": veto,
    }
    cache.set(key, out, INTEL_TTL)
    return out


def _clean_id(raw):
    mid = faceit._extract_match_id(raw)
    return mid if mid and re.fullmatch(r"[0-9A-Za-z-]{6,80}", mid) else None


@require_GET
def match_intel(request, match_id):
    mid = _clean_id(match_id)
    if not mid:
        return JsonResponse({"error": "Bad match id."}, status=400)
    if cache.get(f"lobby:intel:v1:{mid}") is None:
        limited = _over_limit(request, "intel", INTEL_RATE_LIMIT, INTEL_RATE_WINDOW)
        if limited is not None:
            return limited
    try:
        return JsonResponse(room_intel(mid))
    except faceit.FaceitNotFound:
        return JsonResponse({"error": "Match not found."}, status=404)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)


@require_GET
def match_stakes(request, match_id):
    mid = _clean_id(match_id)
    pid = (request.GET.get("player") or "").strip()
    if not mid or not re.fullmatch(r"[0-9a-fA-F-]{8,64}", pid):
        return JsonResponse({"error": "Bad match or player id."}, status=400)
    try:
        return JsonResponse({"stakes": elo_stakes(mid, pid)})
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)


@csrf_exempt
@require_POST
def match_briefing(request, match_id):
    from . import ai
    from .views import _over_ai_rate_limit
    mid = _clean_id(match_id)
    if not mid:
        return JsonResponse({"error": "Bad match id."}, status=400)
    body = _body(request) or {}
    side = 2 if str(body.get("side")) == "2" else 1
    try:
        intel = room_intel(mid)
    except faceit.FaceitNotFound:
        return JsonResponse({"error": "Match not found."}, status=404)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)

    hit = ai.cached_briefing(mid, side)
    if hit is not None:
        return JsonResponse(hit)
    if ai.ANTHROPIC_API_KEY:
        limited = _over_ai_rate_limit(request)
        if limited is not None:
            return limited
    return JsonResponse(ai.brief_room(intel, side))
