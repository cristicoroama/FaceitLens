"""Deeper per-player analysis served on its own endpoint so the main profile
payload stays unchanged: luck vs FACEIT's own win forecast, when the player
performs best, opening/clutch/utility profile with a role guess, and
consistency bands."""
import statistics
from concurrent.futures import ThreadPoolExecutor

from django.core.cache import cache

from . import faceit

TTL = 20 * 60
MATCH_TTL = 30 * 24 * 60 * 60
LUCK_MATCHES = 30


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


def _match(mid):
    key = f"mobj:{mid}"
    hit = cache.get(key)
    if hit is not None:
        return hit or None
    try:
        m = faceit._get(f"/matches/{mid}")
    except faceit.FaceitError:
        cache.set(key, {}, 6 * 60 * 60)
        return None
    teams = {}
    for k, t in (m.get("teams") or {}).items():
        st = (t or {}).get("stats") or {}
        sk = st.get("skillLevel") or {}
        teams[k] = {
            "ids": [p.get("player_id") for p in (t or {}).get("roster") or []],
            "p": _f(st.get("winProbability")),
            "lvl": _f(sk.get("average")),
        }
    slim = {"teams": teams, "winner": ((m.get("results") or {}).get("winner"))}
    cache.set(key, slim, MATCH_TTL if m.get("status") == "FINISHED" else 6 * 60 * 60)
    return slim


def luck(player_id, rows):
    recent = [r for r in rows if r["mid"]][:LUCK_MATCHES]
    if len(recent) < 8:
        return None
    with ThreadPoolExecutor(max_workers=8) as pool:
        objs = list(pool.map(lambda r: _match(r["mid"]), recent))
    pts = []
    for r, m in zip(recent, objs):
        if not m:
            continue
        mine = opp = None
        for k, t in m["teams"].items():
            if player_id in t["ids"]:
                mine = t
            else:
                opp = t
        if not mine or mine["p"] is None:
            continue
        diff = None
        if mine["lvl"] is not None and opp and opp["lvl"] is not None:
            diff = round(opp["lvl"] - mine["lvl"])
        pts.append({"ts": r["ts"], "p": round(mine["p"], 3), "win": r["win"], "diff": diff})
    if len(pts) < 8:
        return None
    pts.sort(key=lambda x: x["ts"])
    expected = sum(x["p"] for x in pts)
    actual = sum(1 for x in pts if x["win"])
    buckets = {}
    for x in pts:
        if x["diff"] is None:
            continue
        d = max(-2, min(2, x["diff"]))
        b = buckets.setdefault(d, {"diff": d, "matches": 0, "wins": 0, "exp": 0.0})
        b["matches"] += 1
        b["wins"] += 1 if x["win"] else 0
        b["exp"] += x["p"]
    rows_b = []
    for d in sorted(buckets):
        b = buckets[d]
        rows_b.append({"diff": d, "matches": b["matches"],
                       "win_rate": round(100 * b["wins"] / b["matches"]),
                       "expected": round(100 * b["exp"] / b["matches"])})
    upsets = [x for x in pts if x["win"] and x["p"] < 0.45]
    chokes = [x for x in pts if not x["win"] and x["p"] > 0.55]
    return {
        "matches": len(pts),
        "expected_wins": round(expected, 1),
        "actual_wins": actual,
        "delta": round(actual - expected, 1),
        "series": [[x["ts"], x["p"], 1 if x["win"] else 0] for x in pts],
        "by_strength": rows_b,
        "upsets": len(upsets),
        "chokes": len(chokes),
    }


def _norm(items):
    out = []
    for it in items or []:
        s = it.get("stats") or {}
        ts = _i(s.get("Match Finished At") or s.get("Updated At") or s.get("Created At"))
        res = _i(s.get("Result"))
        if ts is None or res is None:
            continue
        if ts > 1_000_000_000_000:
            ts //= 1000
        rounds = _i(s.get("Rounds")) or 0
        out.append({
            "mid": s.get("Match Id") or s.get("Match ID"),
            "ts": ts,
            "win": res == 1,
            "kd": _f(s.get("K/D Ratio")),
            "kr": _f(s.get("K/R Ratio")),
            "adr": _f(s.get("ADR") or s.get("Average Damage per Round")),
            "rounds": rounds,
            "entry_n": _i(s.get("Entry Count")),
            "entry_w": _i(s.get("Entry Wins")),
            "v1_n": _i(s.get("1v1Count")),
            "v1_w": _i(s.get("1v1Wins")),
            "v2_n": _i(s.get("1v2Count")),
            "v2_w": _i(s.get("1v2Wins")),
            "util_dpr": _f(s.get("Utility Damage per Round in a Match")),
            "flash_pr": _f(s.get("Flashes per Round in a Match")),
            "sniper_pr": _f(s.get("Sniper Kill Rate per Round")),
            "first_kills": _i(s.get("First Kills")),
        })
    out.sort(key=lambda r: -r["ts"])
    return out


def _sum(rows, k):
    vals = [r[k] for r in rows if r[k] is not None]
    return sum(vals) if vals else None


def _avg(rows, k, nd=2):
    vals = [r[k] for r in rows if r[k] is not None]
    return round(sum(vals) / len(vals), nd) if vals else None


def _pct(a, b):
    return round(100 * a / b) if a is not None and b else None


def profile(rows):
    rows = rows[:50]
    if len(rows) < 8:
        return None
    rounds = sum(r["rounds"] for r in rows) or None
    en, ew = _sum(rows, "entry_n"), _sum(rows, "entry_w")
    v1n, v1w = _sum(rows, "v1_n"), _sum(rows, "v1_w")
    v2n, v2w = _sum(rows, "v2_n"), _sum(rows, "v2_w")
    out = {
        "matches": len(rows),
        "entry_share": _pct(en, rounds),
        "entry_success": _pct(ew, en),
        "v1_rate": _pct(v1w, v1n), "v1_count": v1n,
        "v2_rate": _pct(v2w, v2n), "v2_count": v2n,
        "util_dpr": _avg(rows, "util_dpr", 1),
        "flash_pr": _avg(rows, "flash_pr", 2),
        "sniper_pr": _avg(rows, "sniper_pr", 2),
        "adr": _avg(rows, "adr", 0),
        "kr": _avg(rows, "kr", 2),
    }
    if out["entry_share"] is None and out["util_dpr"] is None and out["sniper_pr"] is None:
        return None
    out["role"] = role(out)
    return out


def role(p):
    sn = p.get("sniper_pr") or 0
    es = p.get("entry_share") or 0
    ud = p.get("util_dpr") or 0
    fl = p.get("flash_pr") or 0
    cl = (p.get("v1_count") or 0) + (p.get("v2_count") or 0)
    if sn >= 0.25:
        return ["AWPer", "A big share of kills come from the sniper."]
    if es >= 20:
        return ["Entry", "Takes the first duel in a lot of rounds."]
    if ud >= 9 or fl >= 0.55:
        return ["Support", "Heavy on utility: flashes and grenade damage."]
    if cl and p["matches"] and cl / p["matches"] >= 1.2:
        return ["Lurker / Closer", "Often the last one alive, playing late rounds."]
    return ["Rifler", "Balanced profile without one dominant habit."]


def consistency(rows):
    rows = rows[:30]
    adr = sorted(r["adr"] for r in rows if r["adr"] is not None)
    kr = [r["kr"] for r in rows if r["kr"] is not None]
    if len(adr) < 10:
        return None

    def q(vals, p):
        i = max(0, min(len(vals) - 1, round(p * (len(vals) - 1))))
        return vals[i]

    mean = statistics.mean(adr)
    cv = statistics.pstdev(adr) / mean if mean else None
    bad = sum(1 for v in kr if v < 0.5)
    return {
        "matches": len(adr),
        "adr_avg": round(mean),
        "adr_floor": round(q(adr, 0.1)),
        "adr_ceiling": round(q(adr, 0.9)),
        "cv": round(cv * 100) if cv is not None else None,
        "bad_rate": round(100 * bad / len(kr)) if kr else None,
        "series": [round(r["adr"]) for r in reversed(rows) if r["adr"] is not None],
        "verdict": ("Rock solid" if cv is not None and cv < 0.18 else
                    "Streaky" if cv is not None and cv > 0.3 else "Steady"),
    }


def build(nickname):
    summary = faceit.build_player_summary(nickname)
    pid = summary["player_id"]
    key = f"analysis:{pid}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    rows = _norm(faceit.get_recent_match_stats(pid, total=200))
    out = {
        "player_id": pid,
        "nickname": summary.get("nickname"),
        "timeline": [[r["ts"], 1 if r["win"] else 0, r["kd"], r["adr"]] for r in rows],
        "luck": luck(pid, rows),
        "profile": profile(rows),
        "consistency": consistency(rows),
    }
    cache.set(key, out, TTL)
    return out
