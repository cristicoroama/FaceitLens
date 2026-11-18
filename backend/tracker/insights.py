"""Season report, Season 10 placement tracker, tilt/session analytics,
achievements and Challenger encounters, all computed from data the profile
summary already fetched."""
import statistics
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone

from django.core.cache import cache

ELO_PER_MATCH = 25
SESSION_GAP = 3 * 60 * 60


def _utc(y, m, d, h=0):
    return int(datetime(y, m, d, h, tzinfo=timezone.utc).timestamp())


SEASONS = {
    9: {"start": _utc(2026, 8, 5, 0), "end": _utc(2026, 12, 8, 16)},
    10: {"start": _utc(2026, 12, 9, 12), "end": None},
}
REPORT_SEASON = 9
PLACEMENT_SEASON = 10
PLACEMENT_MATCHES = 10


def _i(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def _f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _ts(v):
    t = _i(v)
    if t is None:
        return None
    return t // 1000 if t > 1_000_000_000_000 else t


def _score(s):
    raw = str(s.get("Score") or "").replace("/", " ").replace("-", " ").replace(":", " ")
    nums = [n for n in (_i(x) for x in raw.split()) if n is not None]
    if len(nums) != 2:
        return None
    ours = _i(s.get("Final Score"))
    if ours is not None and ours in nums:
        theirs = nums[1] if nums[0] == ours else nums[0]
        return ours, theirs
    return None


def normalize(items):
    out = []
    for it in items or []:
        s = it.get("stats") or {}
        date = _ts(s.get("Match Finished At") or s.get("Updated At") or s.get("Created At"))
        res = _i(s.get("Result"))
        if date is None or res is None:
            continue
        sc = _score(s)
        out.append({
            "match_id": s.get("Match Id") or s.get("Match ID"),
            "date": date,
            "win": res == 1,
            "map": s.get("Map"),
            "kills": _i(s.get("Kills")),
            "deaths": _i(s.get("Deaths")),
            "kd": _f(s.get("K/D Ratio")),
            "adr": _f(s.get("ADR") or s.get("Average Damage per Round")),
            "hs": _f(s.get("Headshots %")),
            "rounds": _i(s.get("Rounds")),
            "penta": _i(s.get("Penta Kills")) or 0,
            "quadro": _i(s.get("Quadro Kills")) or 0,
            "mvps": _i(s.get("MVPs")),
            "ours": sc[0] if sc else None,
            "theirs": sc[1] if sc else None,
        })
    out.sort(key=lambda m: m["date"])
    return out


def _mean(vals, nd=2):
    vals = [v for v in vals if v is not None]
    return round(sum(vals) / len(vals), nd) if vals else None


def _wr(ms):
    return round(100 * sum(1 for m in ms if m["win"]) / len(ms)) if ms else None


def _streaks(ms):
    best_w = best_l = cur = 0
    last = None
    for m in ms:
        if m["win"] == last:
            cur += 1
        else:
            cur = 1
            last = m["win"]
        if m["win"]:
            best_w = max(best_w, cur)
        else:
            best_l = max(best_l, cur)
    return best_w, best_l


def _sessions(ms):
    if not ms:
        return []
    out = [[ms[0]]]
    for a, b in zip(ms, ms[1:]):
        if b["date"] - a["date"] > SESSION_GAP:
            out.append([b])
        else:
            out[-1].append(b)
    return out


def _map_rows(ms, min_n=3):
    by = defaultdict(list)
    for m in ms:
        if m["map"]:
            by[m["map"]].append(m)
    return [{"map": k, "matches": len(v), "win_rate": _wr(v)} for k, v in by.items() if len(v) >= min_n]


def _elo_from_snapshots(snapshots, start, end):
    pts = []
    for s in snapshots or []:
        try:
            t = int(datetime.fromisoformat(s["date"]).replace(tzinfo=timezone.utc).timestamp())
        except (KeyError, ValueError, TypeError):
            continue
        if t >= start - 86400 and (end is None or t <= end + 86400):
            pts.append(s["elo"])
    return pts


def season_report(ms, season, current_elo=None, snapshots=None, fetched_oldest=None):
    cfg = SEASONS.get(season)
    if not cfg:
        return None
    start, end = cfg["start"], cfg["end"]
    now = time.time()
    if now < start:
        return None
    sm = [m for m in ms if m["date"] >= start and (end is None or m["date"] < end)]
    if not sm:
        return {"season": season, "matches": 0, "ended": bool(end and now >= end)}
    wins = sum(1 for m in sm if m["win"])
    w_streak, l_streak = _streaks(sm)
    maps = _map_rows(sm)
    best_map = max(maps, key=lambda r: (r["win_rate"], r["matches"]), default=None)
    most_map = Counter(m["map"] for m in sm if m["map"]).most_common(1)
    best_game = max((m for m in sm if m["kills"] is not None), key=lambda m: (m["kills"], m["kd"] or 0), default=None)
    days = Counter(datetime.fromtimestamp(m["date"], timezone.utc).date().isoformat() for m in sm)
    busiest = days.most_common(1)[0] if days else None
    snap = _elo_from_snapshots(snapshots, start, end)
    if len(snap) >= 2:
        elo = {"start": snap[0], "end": snap[-1] if end and now >= end else (current_elo or snap[-1]),
               "peak": max(snap + ([current_elo] if current_elo and not (end and now >= end) else [])),
               "estimated": False}
        elo["change"] = elo["end"] - elo["start"]
    else:
        change = (wins - (len(sm) - wins)) * ELO_PER_MATCH
        elo = {"change": change, "estimated": True,
               "end": current_elo if not (end and now >= end) else None}
    sessions = _sessions(sm)
    longest = max(sessions, key=len) if sessions else []
    ended = bool(end and now >= end)
    report = {
        "season": season,
        "ended": ended,
        "starts_at": start,
        "ends_at": end,
        "matches": len(sm),
        "wins": wins,
        "losses": len(sm) - wins,
        "win_rate": _wr(sm),
        "kd": _mean([m["kd"] for m in sm]),
        "adr": _mean([m["adr"] for m in sm], 0),
        "hs": _mean([m["hs"] for m in sm], 0),
        "kills": sum(m["kills"] or 0 for m in sm),
        "aces": sum(m["penta"] for m in sm),
        "elo": elo,
        "best_map": best_map,
        "most_played": {"map": most_map[0][0], "matches": most_map[0][1]} if most_map else None,
        "best_game": {
            "match_id": best_game["match_id"], "map": best_game["map"], "kills": best_game["kills"],
            "deaths": best_game["deaths"], "adr": best_game["adr"], "date": best_game["date"],
            "win": best_game["win"],
        } if best_game else None,
        "longest_win_streak": w_streak,
        "longest_loss_streak": l_streak,
        "busiest_day": {"date": busiest[0], "matches": busiest[1]} if busiest else None,
        "longest_session": len(longest),
        "partial": bool(fetched_oldest and fetched_oldest > start),
    }
    report["title"] = _season_title(report)
    return report


def _season_title(r):
    ch = (r.get("elo") or {}).get("change") or 0
    if r["matches"] >= 150:
        return "The Grinder"
    if ch >= 300:
        return "The Climber"
    if ch <= -300:
        return "Free Fall"
    if (r.get("kd") or 0) >= 1.3:
        return "Lobby Boss"
    if r["longest_win_streak"] >= 8:
        return "Heat Check"
    if r["longest_loss_streak"] >= 8:
        return "Character Building"
    if r["matches"] < 20:
        return "Weekend Warrior"
    return "Steady Hands"


def placement(ms):
    cfg = SEASONS[PLACEMENT_SEASON]
    start = cfg["start"]
    now = time.time()
    if now < start:
        return {"season": PLACEMENT_SEASON, "status": "upcoming", "starts_at": start, "need": PLACEMENT_MATCHES}
    pm = [m for m in ms if m["date"] >= start][:PLACEMENT_MATCHES]
    wins = sum(1 for m in pm if m["win"])
    return {
        "season": PLACEMENT_SEASON,
        "status": "done" if len(pm) >= PLACEMENT_MATCHES else "in_progress",
        "starts_at": start,
        "need": PLACEMENT_MATCHES,
        "played": len(pm),
        "wins": wins,
        "losses": len(pm) - wins,
        "results": ["W" if m["win"] else "L" for m in pm],
        "kd": _mean([m["kd"] for m in pm]),
    }


def tilt(ms):
    if len(ms) < 15:
        return None
    overall = _wr(ms)
    after_w, after_l, after_ll = [], [], []
    by_n = defaultdict(list)
    for sess in _sessions(ms):
        for i, m in enumerate(sess):
            by_n[min(i + 1, 5)].append(m)
            if i >= 1:
                (after_w if sess[i - 1]["win"] else after_l).append(m)
            if i >= 2 and not sess[i - 1]["win"] and not sess[i - 2]["win"]:
                after_ll.append(m)
    close = [m for m in ms if m["ours"] is not None and abs(m["ours"] - m["theirs"]) <= 3]
    ot = [m for m in ms if m["rounds"] and m["rounds"] > 24]
    stomps = [m for m in ms if m["ours"] is not None and m["win"] and m["ours"] - m["theirs"] >= 8]
    kds = [m["kd"] for m in ms if m["kd"] is not None]

    def row(lst):
        return {"matches": len(lst), "win_rate": _wr(lst)} if lst else None

    verdict = None
    if len(after_ll) >= 8 and overall is not None:
        d = _wr(after_ll) - overall
        if d <= -8:
            verdict = "tilts"
        elif d >= 5:
            verdict = "resilient"
    if verdict is None and len(after_l) >= 10 and overall is not None:
        d = _wr(after_l) - overall
        if d <= -8:
            verdict = "tilts"
        elif d >= 5:
            verdict = "resilient"
    if verdict is None:
        verdict = "steady"

    return {
        "matches": len(ms),
        "win_rate": overall,
        "after_win": row(after_w),
        "after_loss": row(after_l),
        "after_two_losses": row(after_ll),
        "by_game": [{"n": n, **row(by_n[n])} for n in sorted(by_n) if by_n[n]],
        "close": row(close),
        "overtime": row(ot),
        "stomps": len(stomps),
        "consistency": round(statistics.pstdev(kds), 2) if len(kds) >= 5 else None,
        "verdict": verdict,
    }


def challenger_ids():
    return cache.get("challengers") or {}


def encounters(history, player_id):
    ch = challenger_ids()
    if not ch or not history:
        return None
    seen = {}
    for m in history:
        teams = m.get("teams") or {}
        mine = None
        for k, t in teams.items():
            if any((p.get("player_id") == player_id) for p in (t or {}).get("players") or []):
                mine = k
        for k, t in teams.items():
            for p in (t or {}).get("players") or []:
                pid = p.get("player_id")
                if not pid or pid == player_id or pid not in ch:
                    continue
                row = seen.setdefault(pid, {**ch[pid], "player_id": pid, "with": 0, "against": 0,
                                            "avatar": p.get("avatar") or None})
                row["with" if k == mine else "against"] += 1
    rows = sorted(seen.values(), key=lambda r: (r.get("position") or 9999))
    return {"count": len(rows), "players": rows[:12]}


def achievements(ms, summary_bits):
    out = []

    def add(key, name, desc, tier="bronze"):
        out.append({"id": key, "name": name, "desc": desc, "tier": tier})

    level = summary_bits.get("level")
    total = summary_bits.get("total_matches") or 0
    if level == 10:
        add("lvl10", "Level 10", "Reached the top FACEIT level.", "gold")
    if summary_bits.get("challenger"):
        add("challenger", "Challenger", "Top 1000 of the region ladder.", "gold")
    if total >= 5000:
        add("vet5k", "Ancient", f"{total:,} FACEIT matches.", "gold")
    elif total >= 1000:
        add("vet1k", "Veteran", f"{total:,} FACEIT matches.", "silver")
    elif total >= 100:
        add("vet100", "Regular", f"{total:,} FACEIT matches.")
    if summary_bits.get("csgo_matches"):
        add("csgo", "CS:GO Veteran", "Played FACEIT back in the CS:GO days.", "silver")
    if summary_bits.get("verified"):
        add("verified", "Verified", "FACEIT-verified account.", "silver")
    aces = sum(m["penta"] for m in ms)
    if aces:
        add("ace", "Ace", f"{aces} ace{'s' if aces > 1 else ''} in recent matches.", "gold" if aces >= 5 else "silver")
    recent = ms[-30:]
    hs = _mean([m["hs"] for m in recent], 0)
    if hs is not None and hs >= 55 and len(recent) >= 10:
        add("headhunter", "Headhunter", f"{int(hs)}% headshots over the last {len(recent)} matches.", "silver")
    kd = _mean([m["kd"] for m in recent])
    if kd is not None and kd >= 1.4 and len(recent) >= 10:
        add("fragger", "Entry Menace", f"{kd} K/D over the last {len(recent)} matches.", "gold")
    w, _ = _streaks(ms)
    if w >= 10:
        add("streak10", "Unstoppable", f"{w} wins in a row.", "gold")
    elif w >= 6:
        add("streak6", "On Fire", f"{w} wins in a row.", "silver")
    sess = _sessions(ms)
    if sess and max(len(s) for s in sess) >= 10:
        add("marathon", "Marathon", f"{max(len(s) for s in sess)} matches in one sitting.")
    ot = [m for m in ms if m["rounds"] and m["rounds"] > 24 and m["win"]]
    if len(ot) >= 3:
        add("overtime", "Overtime Specialist", f"Won {len(ot)} overtime matches.", "silver")
    big = max((m["kills"] or 0 for m in ms), default=0)
    if big >= 40:
        add("forty", "40 Bomb", f"{big} kills in a single match.", "gold")
    elif big >= 30:
        add("thirty", "30 Bomb", f"{big} kills in a single match.")
    for r in _map_rows(ms, min_n=20):
        if (r["win_rate"] or 0) >= 62:
            add(f"map-{r['map']}", "Map Specialist", f"{r['win_rate']}% win rate on {r['map']} ({r['matches']} matches).", "silver")
            break
    return out


def build(stat_items, history, player_id, current_elo, snapshots, bits):
    ms = normalize(stat_items)
    oldest = ms[0]["date"] if ms else None
    ch = challenger_ids()
    bits = {**bits, "challenger": player_id in ch}
    return {
        "season_report": season_report(ms, REPORT_SEASON, current_elo, snapshots, oldest if len(ms) >= 240 else None),
        "placement": placement(ms),
        "tilt": tilt(ms),
        "achievements": achievements(ms, bits),
        "encounters": encounters(history, player_id),
    }
