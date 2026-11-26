from __future__ import annotations

import json
import logging
import time
from datetime import date, datetime, timedelta, timezone as dt_timezone

from django.core.cache import cache
from django.db.models import Count, Max
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from . import faceit, privacy
from .profiles import LEVEL_FLOORS, _level_for

log = logging.getLogger(__name__)

SCOPE_LABEL = "Players tracked by FaceitLens"
LIST_TTL = 10 * 60
SYNERGY_TTL = 30 * 60
STATS_TTL = 10 * 60
DISTRIBUTION_WINDOW = 30
MAX_GOALS = 10
SYNERGY_MIN_GAMES = 3

GOAL_LIMITS = {
    "elo": (100, 5000),
    "kd": (0.1, 5),
    "hs": (1, 100),
    "adr": (10, 250),
    "winrate": (1, 100),
}


def _region_arg(request):
    return (request.GET.get("region") or "").strip().upper()[:16]


def _int_arg(request, name, default, lo, hi):
    try:
        v = int(request.GET.get(name, default))
    except (TypeError, ValueError):
        v = default
    return max(lo, min(hi, v))


def _private_member_ids(ids=None):
    from .models import UserProfile

    qs = UserProfile.objects.filter(is_public=False).exclude(faceit_player_id="")
    if ids is not None:
        qs = qs.filter(faceit_player_id__in=list(ids))
    return set(qs.values_list("faceit_player_id", flat=True))


def visible_players(ids):
    from .models import PlayerMeta, TrackedPlayer, UserProfile

    ids = set(ids)
    if not ids:
        return {}
    names = {}
    for pid, nick in TrackedPlayer.objects.filter(player_id__in=list(ids)).values_list("player_id", "nickname"):
        names[pid] = nick
    for pid, nick in (
        UserProfile.objects.filter(is_public=True, faceit_player_id__in=list(ids))
        .exclude(faceit_nickname="")
        .values_list("faceit_player_id", "faceit_nickname")
    ):
        names.setdefault(pid, nick)
    for pid, nick in PlayerMeta.objects.filter(player_id__in=list(names)).exclude(nickname="").values_list("player_id", "nickname"):
        names[pid] = nick
    hidden = _private_member_ids(names)
    return {
        pid: nick
        for pid, nick in names.items()
        if nick and pid not in hidden and not privacy.is_suppressed(pid, None, nick)
    }


def _latest_elos(days=DISTRIBUTION_WINDOW):
    from .models import EloSnapshot

    since = date.today() - timedelta(days=days)
    latest = {}
    for pid, elo in EloSnapshot.objects.filter(date__gte=since).order_by("date").values_list("player_id", "elo"):
        latest[pid] = elo
    return latest


def _regions_for(ids):
    from .models import PlayerMeta

    return dict(PlayerMeta.objects.filter(player_id__in=list(ids)).values_list("player_id", "region"))


def build_climbers(days=7, region="", limit=20):
    from .models import EloSnapshot

    since = date.today() - timedelta(days=days)
    first, last = {}, {}
    rows = (
        EloSnapshot.objects.filter(date__gte=since)
        .order_by("player_id", "date")
        .values_list("player_id", "date", "elo")
    )
    for pid, d, elo in rows:
        first.setdefault(pid, (d, elo))
        last[pid] = (d, elo)
    names = visible_players(last)
    regions = _regions_for(names)
    out = []
    for pid, nick in names.items():
        (d0, e0), (d1, e1) = first[pid], last[pid]
        if d1 <= d0:
            continue
        reg = (regions.get(pid) or "").upper()
        if region and reg != region:
            continue
        gain = e1 - e0
        if gain <= 0:
            continue
        out.append({
            "nickname": nick,
            "player_id": pid,
            "elo": e1,
            "start_elo": e0,
            "gain": gain,
            "level": _level_for(e1),
            "start_level": _level_for(e0),
            "region": reg or None,
            "since": d0.isoformat(),
            "until": d1.isoformat(),
        })
    out.sort(key=lambda r: (r["gain"], r["elo"]), reverse=True)
    return out[:limit]


@require_GET
def climbers(request):
    days = 30 if request.GET.get("days") == "30" else 7
    region = _region_arg(request)
    limit = _int_arg(request, "limit", 20, 1, 50)
    key = f"community:climbers:{days}:{region}:{limit}"
    data = cache.get(key)
    if data is None:
        data = {
            "days": days,
            "region": region or None,
            "scope": SCOPE_LABEL,
            "items": build_climbers(days, region, limit),
        }
        cache.set(key, data, LIST_TTL)
    return JsonResponse(data)


def build_renamed(limit=12):
    from .models import NicknameHistory

    groups = (
        NicknameHistory.objects.values("player_id")
        .annotate(n=Count("id"), last=Max("first_seen"))
        .filter(n__gt=1)
        .order_by("-last")[: limit * 4]
    )
    groups = list(groups)
    names = visible_players([g["player_id"] for g in groups])
    out = []
    for g in groups:
        pid = g["player_id"]
        if pid not in names:
            continue
        history = list(
            NicknameHistory.objects.filter(player_id=pid)
            .order_by("first_seen")
            .values_list("nickname", "first_seen")
        )
        if len(history) < 2:
            continue
        if any(privacy.is_suppressed(None, None, n) for n, _ in history):
            continue
        (prev, _), (current, at) = history[-2], history[-1]
        out.append({
            "nickname": current,
            "previous": prev,
            "names": len(history),
            "renamed_at": at.isoformat(),
        })
        if len(out) >= limit:
            break
    return out


@require_GET
def renamed(request):
    key = "community:renamed"
    data = cache.get(key)
    if data is None:
        data = {"scope": SCOPE_LABEL, "items": build_renamed()}
        cache.set(key, data, LIST_TTL)
    return JsonResponse(data)


def build_searched(limit=12):
    from .models import TrackedPlayer

    since = timezone.now() - timedelta(hours=24)
    rows = list(
        TrackedPlayer.objects.filter(last_searched__gte=since)
        .order_by("-last_searched")
        .values_list("player_id", "nickname", "last_searched")[: limit * 3]
    )
    names = visible_players([r[0] for r in rows])
    elos = _latest_elos(7)
    out = []
    for pid, nick, at in rows:
        if pid not in names:
            continue
        elo = elos.get(pid)
        out.append({
            "nickname": names[pid],
            "searched_at": at.isoformat(),
            "elo": elo,
            "level": _level_for(elo) if elo else None,
        })
        if len(out) >= limit:
            break
    return out


@require_GET
def searched(request):
    key = "community:searched"
    data = cache.get(key)
    if data is None:
        data = {"scope": SCOPE_LABEL, "window_hours": 24, "items": build_searched()}
        cache.set(key, data, 5 * 60)
    return JsonResponse(data)


def _pool(region):
    key = f"community:pool:{region}"
    pool = cache.get(key)
    if pool is not None:
        return pool
    latest = _latest_elos()
    hidden = _private_member_ids(latest)
    regions = _regions_for(latest)
    region_counts = {}
    values = []
    for pid, elo in latest.items():
        if pid in hidden or privacy.is_suppressed(pid):
            continue
        reg = (regions.get(pid) or "").upper()
        if reg:
            region_counts[reg] = region_counts.get(reg, 0) + 1
        if region and reg != region:
            continue
        values.append(elo)
    values.sort()
    pool = {"values": values, "regions": region_counts}
    cache.set(key, pool, LIST_TTL)
    return pool


def build_distribution(region=""):
    pool = _pool(region)
    values = pool["values"]
    n = len(values)
    levels = [0] * 10
    for elo in values:
        levels[_level_for(elo) - 1] += 1
    floors = LEVEL_FLOORS + [None]
    level_rows = [
        {
            "level": i + 1,
            "min_elo": LEVEL_FLOORS[i] if i else 0,
            "max_elo": (floors[i + 1] - 1) if floors[i + 1] else None,
            "count": c,
            "pct": round(c / n * 100, 1) if n else 0,
        }
        for i, c in enumerate(levels)
    ]
    step = 100
    top = 3500
    buckets = {}
    for elo in values:
        b = min(top, (elo // step) * step)
        buckets[b] = buckets.get(b, 0) + 1
    bucket_rows = [
        {"from": b, "to": None if b >= top else b + step - 1, "count": buckets[b]}
        for b in sorted(buckets)
    ]
    return {
        "scope": SCOPE_LABEL,
        "window_days": DISTRIBUTION_WINDOW,
        "region": region or None,
        "population": n,
        "median": values[n // 2] if n else None,
        "mean": round(sum(values) / n) if n else None,
        "levels": level_rows,
        "elo_buckets": bucket_rows,
        "regions": sorted(
            ({"region": r, "count": c} for r, c in pool["regions"].items()),
            key=lambda x: -x["count"],
        ),
    }


def _elo_for_nickname(nickname):
    from .models import EloSnapshot, PlayerMeta, TrackedPlayer

    pid = (
        PlayerMeta.objects.filter(nickname__iexact=nickname).values_list("player_id", flat=True).first()
        or TrackedPlayer.objects.filter(nickname__iexact=nickname).values_list("player_id", flat=True).first()
    )
    if not pid or privacy.is_suppressed(pid, None, nickname):
        return None
    row = EloSnapshot.objects.filter(player_id=pid).order_by("-date").values_list("elo", flat=True).first()
    return row


def _placement(values, elo):
    import bisect

    above = len(values) - bisect.bisect_right(values, elo)
    present = bisect.bisect_left(values, elo) < len(values) and values[bisect.bisect_left(values, elo)] == elo
    population = len(values) + (0 if present else 1)
    return faceit.build_percentile(above + 1, population)


@require_GET
def distribution(request):
    region = _region_arg(request)
    key = f"community:distribution:{region}"
    data = cache.get(key)
    if data is None:
        data = build_distribution(region)
        cache.set(key, data, LIST_TTL)
    data = dict(data)
    nickname = (request.GET.get("nickname") or "").strip()[:100]
    elo = None
    try:
        elo = int(request.GET.get("elo")) if request.GET.get("elo") else None
    except ValueError:
        elo = None
    if nickname and privacy.is_suppressed(None, None, nickname):
        nickname = ""
    if elo is None and nickname:
        elo = _elo_for_nickname(nickname)
    if elo is not None and data["population"]:
        values = _pool(region)["values"]
        data["you"] = {
            "nickname": nickname or None,
            "elo": elo,
            "level": _level_for(elo),
            "percentile": _placement(values, elo),
        }
    return JsonResponse(data)


def _stat_float(item, *keys):
    s = item.get("stats") or {}
    for k in keys:
        try:
            return float(s.get(k))
        except (TypeError, ValueError):
            continue
    return None


def _match_rating(item):
    try:
        res = faceit.build_hltv_stats([item], n=1)
    except Exception:
        return None
    return res["rating"] if res else None


def build_synergy(player_id, nickname, matches=100, min_games=SYNERGY_MIN_GAMES):
    history = faceit.get_recent_history(player_id, total=matches)
    stat_items = faceit.get_recent_match_stats(player_id, total=matches)
    by_match = {}
    for it in stat_items:
        s = it.get("stats") or {}
        mid = s.get("Match Id") or s.get("Match ID") or it.get("match_id")
        if mid:
            by_match[mid] = it

    total = wins = 0
    ratings = []
    mates = {}
    for m in history:
        me, side = faceit._find_self(m, player_id, nickname)
        if side is None:
            continue
        winner = (m.get("results") or {}).get("winner")
        if not winner:
            continue
        won = winner == side
        item = by_match.get(m.get("match_id"))
        rating = _match_rating(item) if item else None
        total += 1
        wins += 1 if won else 0
        if rating is not None:
            ratings.append(rating)
        for p in (m.get("teams") or {}).get(side, {}).get("players") or []:
            pid = p.get("player_id") or p.get("user_id")
            if not pid or pid == player_id:
                continue
            e = mates.setdefault(pid, {
                "player_id": pid,
                "nickname": p.get("nickname"),
                "avatar": p.get("avatar") or None,
                "games": 0,
                "wins": 0,
                "ratings": [],
            })
            e["games"] += 1
            e["wins"] += 1 if won else 0
            if rating is not None:
                e["ratings"].append(rating)

    base_wr = round(wins / total * 100, 1) if total else None
    base_rating = round(sum(ratings) / len(ratings), 2) if ratings else None
    rows = []
    for e in mates.values():
        g = e["games"]
        if g < min_games:
            continue
        wr = round(e["wins"] / g * 100, 1)
        avg_r = round(sum(e["ratings"]) / len(e["ratings"]), 2) if e["ratings"] else None
        d_wr = round(wr - base_wr, 1) if base_wr is not None else None
        d_r = round(avg_r - base_rating, 2) if (avg_r is not None and base_rating is not None) else None
        weight = g / (g + 5)
        score = ((d_wr or 0) + (d_r or 0) * 100) * weight
        rows.append({
            "player_id": e["player_id"],
            "nickname": e["nickname"],
            "avatar": e["avatar"],
            "games": g,
            "wins": e["wins"],
            "win_rate": wr,
            "rating": avg_r,
            "win_rate_delta": d_wr,
            "rating_delta": d_r,
            "synergy": round(score, 1),
        })
    rows.sort(key=lambda r: r["synergy"], reverse=True)
    return {
        "matches": total,
        "min_games": min_games,
        "overall": {"win_rate": base_wr, "rating": base_rating},
        "teammates": rows,
        "rating_note": "approx",
    }


@require_GET
def synergy(request, nickname):
    try:
        privacy.check(nickname=nickname)
        player = faceit.get_player_by_nickname(nickname)
        pid = player["player_id"]
        cs2 = (player.get("games") or {}).get(faceit.GAME, {})
        privacy.check(player_id=pid, steamid=cs2.get("game_player_id"), nickname=player.get("nickname"))
    except privacy.Suppressed as exc:
        return JsonResponse({"error": str(exc)}, status=404)
    except faceit.FaceitNotFound:
        return JsonResponse({"error": "Player not found."}, status=404)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)
    key = f"community:synergy:{pid}"
    data = cache.get(key)
    if data is None:
        try:
            data = build_synergy(pid, player.get("nickname"))
        except faceit.FaceitError as exc:
            return JsonResponse({"error": str(exc)}, status=502)
        data["nickname"] = player.get("nickname")
        cache.set(key, data, SYNERGY_TTL)
    return JsonResponse(data)


def _parse_iso(value):
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if timezone.is_naive(dt):
        dt = dt.replace(tzinfo=dt_timezone.utc)
    return dt


def _from_ts(value):
    ts = faceit._ts_seconds(value)
    if not ts:
        return None
    return datetime.fromtimestamp(ts, tz=dt_timezone.utc)


def collect_encounters(owner_id, owner_nick, matches=50):
    history = faceit.get_player_history(owner_id, limit=min(100, matches))
    seen = {}
    for m in history:
        me, side = faceit._find_self(m, owner_id, owner_nick)
        if side is None:
            continue
        played = _from_ts(m.get("finished_at") or m.get("started_at"))
        url = (m.get("faceit_url") or "").replace("{lang}", "en")
        for fac, team in (m.get("teams") or {}).items():
            for p in team.get("players") or []:
                pid = p.get("player_id") or p.get("user_id")
                if not pid or pid == owner_id or pid in seen:
                    continue
                seen[pid] = {
                    "player_id": pid,
                    "nickname": p.get("nickname") or "",
                    "avatar": p.get("avatar") or "",
                    "relation": "teammate" if fac == side else "opponent",
                    "match_id": m.get("match_id") or "",
                    "match_url": url[:300],
                    "played_at": played,
                }
    return list(seen.values())


def _ban_state(enc, recheck_days, sleep, budget):
    from .models import BanCheckState

    state = BanCheckState.objects.filter(player_id=enc["player_id"]).first()
    fresh_cutoff = timezone.now() - timedelta(days=recheck_days)
    if state and (state.banned or state.checked_at >= fresh_cutoff):
        return state, False
    if budget["left"] <= 0:
        return state, False
    budget["left"] -= 1
    bans = faceit.get_player_bans(enc["player_id"])
    if sleep:
        time.sleep(sleep)
    ban = bans[0] if bans else None
    defaults = {
        "nickname": enc["nickname"][:100],
        "banned": bool(ban),
        "ban_type": ((ban or {}).get("reason") or (ban or {}).get("type") or "")[:64],
        "ban_started": _parse_iso((ban or {}).get("starts_at")),
        "checked_at": timezone.now(),
    }
    state, _ = BanCheckState.objects.update_or_create(player_id=enc["player_id"], defaults=defaults)
    return state, True


def scan_encounter_bans(profile, matches=50, recheck_days=3, sleep=0.3, budget=None):
    from . import notifications
    from .models import EncounterBan

    budget = budget if budget is not None else {"left": 200}
    owner_id = profile.faceit_player_id
    encounters = collect_encounters(owner_id, profile.faceit_nickname, matches)
    found = notified = calls = 0
    for enc in encounters:
        state, called = _ban_state(enc, recheck_days, sleep, budget)
        calls += 1 if called else 0
        if not state or not state.banned:
            continue
        if state.ban_started and enc["played_at"] and state.ban_started < enc["played_at"]:
            continue
        row, created = EncounterBan.objects.get_or_create(
            owner_player_id=owner_id,
            player_id=enc["player_id"],
            ban_type=state.ban_type or "ban",
            defaults={
                "nickname": enc["nickname"][:100],
                "avatar": enc["avatar"][:200],
                "relation": enc["relation"],
                "match_id": enc["match_id"][:64],
                "match_url": enc["match_url"],
                "played_at": enc["played_at"],
                "ban_started": state.ban_started,
            },
        )
        if not created:
            continue
        found += 1
        if privacy.is_suppressed(enc["player_id"], None, enc["nickname"]):
            continue
        label = notifications._humanise_ban(row.ban_type)
        who = "teammate" if row.relation == "teammate" else "opponent"
        notified += notifications.deliver(
            [profile.user_id],
            "opponent_banned",
            f"A former {who} was banned: {row.nickname}",
            f"{label}. You played together on {row.played_at.date().isoformat() if row.played_at else 'a recent match'}.",
            f"/player/{profile.faceit_nickname}",
            f"opponent_banned:{row.player_id}:{row.ban_type.lower()}",
        )
    return {"encounters": len(encounters), "found": found, "notified": notified, "calls": calls}


def _resolve_player_id(nickname):
    from .models import PlayerMeta, TrackedPlayer, UserProfile

    pid = (
        PlayerMeta.objects.filter(nickname__iexact=nickname).values_list("player_id", flat=True).first()
        or TrackedPlayer.objects.filter(nickname__iexact=nickname).values_list("player_id", flat=True).first()
        or UserProfile.objects.filter(faceit_nickname__iexact=nickname).exclude(faceit_player_id="")
        .values_list("faceit_player_id", flat=True).first()
    )
    if pid:
        return pid
    return faceit.get_player_by_nickname(nickname)["player_id"]


@require_GET
def banned_opponents(request, nickname):
    from .models import EncounterBan, UserProfile

    try:
        privacy.check(nickname=nickname)
        pid = _resolve_player_id(nickname)
        privacy.check(player_id=pid)
    except privacy.Suppressed as exc:
        return JsonResponse({"error": str(exc)}, status=404)
    except faceit.FaceitNotFound:
        return JsonResponse({"error": "Player not found."}, status=404)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)

    key = f"community:banned_opponents:{pid}"
    data = cache.get(key)
    if data is None:
        member = UserProfile.objects.filter(faceit_player_id=pid).first()
        if member and not member.is_public and not (
            request.user.is_authenticated and member.user_id == request.user.id
        ):
            return JsonResponse({"tracking": False, "items": []})
        rows = EncounterBan.objects.filter(owner_player_id=pid).order_by("-detected_at")[:50]
        data = {
            "tracking": member is not None,
            "items": [
                {
                    "nickname": r.nickname,
                    "player_id": r.player_id,
                    "avatar": r.avatar or None,
                    "relation": r.relation,
                    "ban_type": r.ban_type,
                    "match_id": r.match_id or None,
                    "match_url": r.match_url or None,
                    "played_at": r.played_at.isoformat() if r.played_at else None,
                    "ban_started": r.ban_started.isoformat() if r.ban_started else None,
                    "detected_at": r.detected_at.isoformat(),
                }
                for r in rows
                if not privacy.is_suppressed(r.player_id, None, r.nickname)
            ],
        }
        cache.set(key, data, LIST_TTL)
    return JsonResponse(data)


def current_stats(player_id):
    from .models import EloSnapshot

    if not player_id:
        return None
    key = f"community:stats:{player_id}"
    data = cache.get(key)
    if data is not None:
        return data
    data = {"elo": None, "kd": None, "hs": None, "adr": None, "winrate": None, "matches": 0}
    snap = EloSnapshot.objects.filter(player_id=player_id).order_by("-date").values_list("elo", flat=True).first()
    if snap is not None:
        data["elo"] = snap
    try:
        player = faceit._get(f"/players/{player_id}")
        elo = ((player.get("games") or {}).get(faceit.GAME) or {}).get("faceit_elo")
        if elo is not None:
            data["elo"] = elo
        items = faceit.get_match_stats(player_id, limit=30)
        avg = faceit.build_recent_averages(items, n=30) or {}
        data.update({
            "kd": avg.get("kd"),
            "hs": avg.get("hs"),
            "adr": avg.get("adr"),
            "winrate": avg.get("win_rate"),
            "matches": avg.get("matches") or 0,
        })
    except Exception:
        log.info("current_stats: FACEIT unavailable for %s", player_id)
    cache.set(key, data, STATS_TTL)
    return data


def _progress(goal, current):
    if current is None:
        return None
    start = goal.start_value
    if start is not None and goal.target != start:
        pct = (current - start) / (goal.target - start) * 100
    else:
        pct = current / goal.target * 100 if goal.target else 0
    return max(0, min(100, round(pct)))


def goal_payload(goal, stats):
    current = (stats or {}).get(goal.metric)
    return {
        "id": goal.id,
        "metric": goal.metric,
        "label": dict(goal.METRIC_CHOICES).get(goal.metric, goal.metric),
        "target": goal.target,
        "start_value": goal.start_value,
        "current": current,
        "progress": _progress(goal, current),
        "achieved": goal.achieved_at is not None,
        "achieved_at": goal.achieved_at.isoformat() if goal.achieved_at else None,
        "created_at": goal.created_at.isoformat(),
    }


def refresh_achieved(goals, stats):
    now = timezone.now()
    newly = []
    for g in goals:
        cur = (stats or {}).get(g.metric)
        if g.achieved_at is None and cur is not None and cur >= g.target:
            g.achieved_at = now
            g.save(update_fields=["achieved_at"])
            newly.append(g)
    return newly


def _signed_in_profile(request):
    from .models import UserProfile

    if not request.user.is_authenticated:
        return None
    return UserProfile.objects.filter(user=request.user).first()


def _goal_body(request):
    try:
        return json.loads(request.body or "{}")
    except (ValueError, UnicodeDecodeError):
        return None


def _valid_target(metric, raw):
    if metric not in GOAL_LIMITS:
        return None
    try:
        v = float(raw)
    except (TypeError, ValueError):
        return None
    lo, hi = GOAL_LIMITS[metric]
    if not (lo <= v <= hi):
        return None
    return round(v) if metric in ("elo", "hs", "adr", "winrate") else round(v, 2)


def _goals_response(request, profile):
    from .models import PlayerGoal

    pid = profile.faceit_player_id if profile else ""
    stats = current_stats(pid) if pid else None
    goals = list(PlayerGoal.objects.filter(user=request.user))
    refresh_achieved(goals, stats)
    return JsonResponse({
        "linked": bool(pid),
        "nickname": profile.faceit_nickname if profile else None,
        "stats": stats,
        "metrics": [{"id": k, "label": v, "min": GOAL_LIMITS[k][0], "max": GOAL_LIMITS[k][1]} for k, v in PlayerGoal.METRIC_CHOICES],
        "max_goals": MAX_GOALS,
        "items": [goal_payload(g, stats) for g in goals],
    })


@csrf_exempt
def goals(request):
    from .models import PlayerGoal

    if request.method not in ("GET", "POST"):
        return JsonResponse({"error": "Method not allowed."}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Not signed in."}, status=401)
    profile = _signed_in_profile(request)

    if request.method == "POST":
        body = _goal_body(request)
        if body is None:
            return JsonResponse({"error": "Invalid JSON."}, status=400)
        metric = str(body.get("metric") or "")
        target = _valid_target(metric, body.get("target"))
        if target is None:
            return JsonResponse({"error": "Pick a metric and a sensible target."}, status=400)
        if PlayerGoal.objects.filter(user=request.user, achieved_at=None).count() >= MAX_GOALS:
            return JsonResponse({"error": f"You can have up to {MAX_GOALS} open goals."}, status=400)
        stats = current_stats(profile.faceit_player_id) if profile and profile.faceit_player_id else None
        PlayerGoal.objects.create(
            user=request.user,
            metric=metric,
            target=target,
            start_value=(stats or {}).get(metric),
        )
    return _goals_response(request, profile)


@csrf_exempt
def goal_detail(request, goal_id):
    from .models import PlayerGoal

    if request.method not in ("PATCH", "DELETE"):
        return JsonResponse({"error": "Method not allowed."}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Not signed in."}, status=401)
    goal = PlayerGoal.objects.filter(user=request.user, id=goal_id).first()
    if goal is None:
        return JsonResponse({"error": "No such goal."}, status=404)
    if request.method == "DELETE":
        goal.delete()
    else:
        body = _goal_body(request)
        if body is None:
            return JsonResponse({"error": "Invalid JSON."}, status=400)
        target = _valid_target(goal.metric, body.get("target"))
        if target is None:
            return JsonResponse({"error": "That target is out of range."}, status=400)
        goal.target = target
        goal.achieved_at = None
        goal.save(update_fields=["target", "achieved_at"])
    return _goals_response(request, _signed_in_profile(request))


def _best_map(player_id, days=7):
    items = faceit.get_match_stats(player_id, limit=50)
    cutoff = time.time() - days * 86400
    maps = {}
    for it in items:
        s = it.get("stats") or {}
        ts = faceit._ts_seconds(s.get("Match Finished At") or s.get("Updated At") or s.get("Created At"))
        if ts and ts < cutoff:
            continue
        name = s.get("Map")
        res = faceit._to_int(s.get("Result"))
        if not name or res is None:
            continue
        e = maps.setdefault(name, [0, 0])
        e[0] += 1
        e[1] += res
    ranked = [(w / g, g, name) for name, (g, w) in maps.items() if g >= 2]
    if not ranked:
        return None
    wr, g, name = max(ranked)
    return {"map": name, "matches": g, "win_rate": round(wr * 100)}


def build_digest(profile):
    from .models import EloSnapshot, PlayerGoal

    pid = profile.faceit_player_id
    since = date.today() - timedelta(days=7)
    snaps = list(EloSnapshot.objects.filter(player_id=pid, date__gte=since).order_by("date").values_list("elo", flat=True))
    change = snaps[-1] - snaps[0] if len(snaps) >= 2 else None
    best = None
    try:
        best = _best_map(pid)
    except Exception:
        best = None
    goals_qs = list(PlayerGoal.objects.filter(user=profile.user))
    stats = current_stats(pid) if goals_qs else None
    refresh_achieved(goals_qs, stats)
    open_goals = [g for g in goals_qs if g.achieved_at is None]
    done_week = [g for g in goals_qs if g.achieved_at and g.achieved_at >= timezone.now() - timedelta(days=7)]
    parts = []
    if change is not None:
        parts.append(f"ELO {'+' if change > 0 else ''}{change} this week")
    if best:
        parts.append(f"best map {best['map'].replace('de_', '').capitalize()} ({best['win_rate']}% over {best['matches']})")
    if open_goals:
        progress = [p for p in (_progress(g, (stats or {}).get(g.metric)) for g in open_goals) if p is not None]
        if progress:
            parts.append(f"{len(open_goals)} goal(s) open, avg {round(sum(progress) / len(progress))}% there")
    if done_week:
        parts.append(f"{len(done_week)} goal(s) hit")
    return {"change": change, "best_map": best, "parts": parts}
