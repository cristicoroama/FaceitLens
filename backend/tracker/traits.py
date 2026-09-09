"""
Behavioural traits, derived from the match history the profile already holds.

Costs no extra API call: get_player_profile pulls up to 250 matches with full
per-match stats, and this reads the same list.

Every trait carries the number that earned it. A chip reading "One Trick" with
nothing behind it is astrology; "One Trick — Mirage, 47% of matches" is a
statistic the reader can disagree with. The `detail` field is not decoration,
it is the evidence, and the UI must show it.

On thresholds: these are judgement calls, not population percentiles. We have
no corpus of FACEIT players to calibrate against, so the cutoffs below are set
where the behaviour becomes unusual enough to be worth naming, and are
deliberately gathered in one table so they can be retuned in one place once
there is real distribution data. MIN_SAMPLE guards the other failure mode —
awarding "Overtime King" off two overtime matches.
"""
from statistics import pstdev

MIN_MATCHES = 20
MIN_OVERTIME = 5
MIN_HALVES = 15
MAX_TRAITS = 8

GOOD = "good"
BAD = "bad"
NEUTRAL = "neutral"


def _num(v):
    if v is None:
        return None
    try:
        f = float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None
    return f


def _int(v):
    f = _num(v)
    return int(f) if f is not None else None


def _first(s, *names):
    for n in names:
        if s.get(n) not in (None, ""):
            return s[n]
    return None


def _halves(s):
    """(our half score, their half score) summed over both halves, or None.

    FACEIT reports halves as "13/7" strings from the perspective of the two
    teams in roster order, not the player's, so the player's own team index is
    needed to read them. Without it the numbers are a coin flip and the
    lead-related traits would be noise.
    """
    first = _first(s, "First Half Score")
    second = _first(s, "Second Half Score")
    team = _int(_first(s, "Team"))
    if not first or team not in (0, 1):
        return None

    def split(raw):
        parts = [p for p in str(raw).replace("-", "/").split("/") if p.strip()]
        if len(parts) != 2:
            return None
        try:
            return int(parts[0]), int(parts[1])
        except ValueError:
            return None

    f = split(first)
    if not f:
        return None
    ours, theirs = (f[0], f[1]) if team == 0 else (f[1], f[0])

    sec = split(second) if second else None
    if sec:
        a, b = (sec[0], sec[1]) if team == 0 else (sec[1], sec[0])
        return ours + a, theirs + b
    return ours, theirs


def _rows(items):
    out = []
    for it in items or []:
        s = it.get("stats") or {}
        kills = _int(_first(s, "Kills"))
        deaths = _int(_first(s, "Deaths"))
        rounds = _int(_first(s, "Rounds"))
        result = _int(_first(s, "Result"))
        if kills is None or result is None:
            continue
        out.append({
            "kills": kills,
            "deaths": deaths,
            "rounds": rounds,
            "won": result == 1,
            "kd": _num(_first(s, "K/D Ratio")),
            "adr": _num(_first(s, "ADR", "Average Damage per Round")),
            "hs": _num(_first(s, "Headshots %")),
            "mvps": _int(_first(s, "MVPs")),
            "multi": sum(
                _int(_first(s, k)) or 0
                for k in ("Triple Kills", "Quadro Kills", "Penta Kills")
            ),
            "clutches": (_int(_first(s, "1v1Wins")) or 0) + (_int(_first(s, "1v2Wins")) or 0),
            "entry_count": _int(_first(s, "Entry Count")),
            "entry_wins": _int(_first(s, "Entry Wins")),
            "sniper": _int(_first(s, "Sniper Kills")),
            "overtime": _int(_first(s, "Overtime score")),
            "halves": _halves(s),
            "map": _first(s, "Map"),
            "at": it.get("finished_at") or _int(_first(s, "Match Finished At")),
        })
    return out


def _avg(values):
    vals = [v for v in values if v is not None]
    return sum(vals) / len(vals) if vals else None


def _pct(part, whole):
    return 100.0 * part / whole if whole else None


def _trait(key, label, tone, detail):
    return {"key": key, "label": label, "tone": tone, "detail": detail}


def _impact(rows, out):
    adr = _avg(r["adr"] for r in rows)
    if adr is not None:
        if adr >= 85:
            out.append(_trait("star_player", "Star Player", GOOD, f"{adr:.0f} ADR average"))
        elif adr <= 58:
            out.append(_trait("ghost", "Ghost", BAD, f"{adr:.0f} ADR average"))

    multi = _avg(r["multi"] for r in rows)
    if multi is not None and multi >= 0.55:
        out.append(_trait("multikill_machine", "Multikill Machine", GOOD,
                          f"{multi:.2f} triple-plus kills per match"))

    mvps = _avg(r["mvps"] for r in rows)
    if mvps is not None and mvps >= 3.5:
        out.append(_trait("mvp_magnet", "MVP Magnet", GOOD, f"{mvps:.1f} MVPs per match"))

    hs = _avg(r["hs"] for r in rows)
    if hs is not None and hs >= 55:
        out.append(_trait("headhunter", "Headhunter", GOOD, f"{hs:.0f}% headshots"))


def _survival(rows, out):
    paired = [(r["deaths"], r["rounds"]) for r in rows
              if r["deaths"] is not None and r["rounds"]]
    if len(paired) < MIN_MATCHES:
        return
    dpr = sum(d for d, _ in paired) / sum(n for _, n in paired)
    if dpr <= 0.62:
        out.append(_trait("hard_to_kill", "Hard to Kill", GOOD, f"{dpr:.2f} deaths per round"))
    elif dpr >= 0.80:
        out.append(_trait("deathwish", "Deathwish", BAD, f"{dpr:.2f} deaths per round"))


def _consistency(rows, out):
    kds = [r["kd"] for r in rows if r["kd"] is not None]
    if len(kds) < MIN_MATCHES:
        return
    spread = pstdev(kds)
    if spread <= 0.30:
        out.append(_trait("metronome", "Metronome", GOOD,
                          f"±{spread:.2f} K/D swing"))
    elif spread >= 0.55:
        out.append(_trait("rollercoaster", "Rollercoaster", BAD,
                          f"±{spread:.2f} K/D swing"))


def _leads(rows, out):
    ahead = [r for r in rows if r["halves"] and r["halves"][0] > r["halves"][1]]
    behind = [r for r in rows if r["halves"] and r["halves"][0] < r["halves"][1]]

    if len(ahead) >= MIN_HALVES:
        rate = _pct(sum(1 for r in ahead if r["won"]), len(ahead))
        if rate >= 78:
            out.append(_trait("holds_leads", "Holds Leads", GOOD,
                              f"wins {rate:.0f}% when ahead at the half"))
        elif rate <= 55:
            out.append(_trait("loses_leads", "Loses Leads", BAD,
                              f"wins only {rate:.0f}% when ahead at the half"))

    if len(behind) >= MIN_HALVES:
        rate = _pct(sum(1 for r in behind if r["won"]), len(behind))
        if rate >= 35:
            out.append(_trait("comeback_kid", "Comeback Kid", GOOD,
                              f"wins {rate:.0f}% when behind at the half"))


def _overtime(rows, out):
    ot = [r for r in rows if r["overtime"]]
    if len(ot) < MIN_OVERTIME:
        return
    rate = _pct(sum(1 for r in ot if r["won"]), len(ot))
    if rate >= 60:
        out.append(_trait("overtime_king", "Overtime King", GOOD,
                          f"{rate:.0f}% of {len(ot)} overtimes won"))
    elif rate <= 35:
        out.append(_trait("overtime_choke", "Overtime Choker", BAD,
                          f"{rate:.0f}% of {len(ot)} overtimes won"))


def _maps(rows, out):
    counts = {}
    for r in rows:
        if r["map"]:
            counts[r["map"]] = counts.get(r["map"], 0) + 1
    total = sum(counts.values())
    if total < MIN_MATCHES:
        return
    top, n = max(counts.items(), key=lambda kv: kv[1])
    share = _pct(n, total)
    if share >= 40:
        out.append(_trait("one_trick", "One Trick", NEUTRAL,
                          f"{top.replace('de_', '').title()}, {share:.0f}% of matches"))
    elif len(counts) >= 7 and share <= 25:
        out.append(_trait("plays_every_map", "Plays Every Map", NEUTRAL,
                          f"{len(counts)} maps, none over {share:.0f}%"))


def _schedule(rows, out):
    import time
    stamped = [r["at"] for r in rows if r["at"]]
    if len(stamped) < MIN_MATCHES:
        return
    # Day-of-week only. An hour-of-day trait would need the player's timezone,
    # which the API does not give — "night owl" off UTC would just be a label
    # for living east of Greenwich.
    weekend = sum(1 for t in stamped if time.gmtime(t).tm_wday >= 5)
    share = _pct(weekend, len(stamped))
    if share >= 45:
        out.append(_trait("weekend_warrior", "Weekend Warrior", NEUTRAL,
                          f"{share:.0f}% of matches on weekends"))
    elif share <= 18:
        out.append(_trait("weekday_warrior", "Weekday Warrior", NEUTRAL,
                          f"only {share:.0f}% of matches on weekends"))


def _days(rows, out):
    import time
    by_day = {}
    for r in rows:
        if not r["at"]:
            continue
        day = time.strftime("%Y-%m-%d", time.gmtime(r["at"]))
        w, l = by_day.get(day, (0, 0))
        by_day[day] = (w + 1, l) if r["won"] else (w, l + 1)
    if len(by_day) < 5:
        return

    rough = sum(1 for w, l in by_day.values() if l >= 4 and w <= 1)
    if rough >= 3:
        out.append(_trait("bad_days", "Bad Days", BAD,
                          f"{rough} days ending 4+ losses deep"))

    busiest = max((w + l for w, l in by_day.values()), default=0)
    if busiest >= 12:
        out.append(_trait("marathon", "Marathon Man", NEUTRAL,
                          f"{busiest} matches in a single day"))


def _roles(rows, out):
    kills = sum(r["kills"] for r in rows)
    sniper = sum(r["sniper"] or 0 for r in rows)
    if kills and _pct(sniper, kills) >= 25:
        out.append(_trait("awper", "AWPer", NEUTRAL,
                          f"{_pct(sniper, kills):.0f}% of kills with the AWP"))

    clutches = _avg(r["clutches"] for r in rows)
    if clutches is not None and clutches >= 0.40:
        out.append(_trait("clutch_merchant", "Clutch Merchant", GOOD,
                          f"{clutches:.2f} clutches won per match"))

    attempts = sum(r["entry_count"] or 0 for r in rows)
    wins = sum(r["entry_wins"] or 0 for r in rows)
    if attempts >= 100:
        rate = _pct(wins, attempts)
        per_match = attempts / len(rows)
        if per_match >= 4 and rate >= 55:
            out.append(_trait("opening_duelist", "Opening Duelist", GOOD,
                              f"wins {rate:.0f}% of {attempts} opening duels"))
        elif per_match >= 4 and rate <= 42:
            out.append(_trait("first_to_die", "First to Die", BAD,
                              f"wins only {rate:.0f}% of {attempts} opening duels"))


ORDER = [GOOD, BAD, NEUTRAL]


def build_traits(items, limit=MAX_TRAITS):
    """Traits earned over the supplied match history, best evidence first."""
    rows = _rows(items)
    if len(rows) < MIN_MATCHES:
        return {"traits": [], "matches": len(rows), "min_matches": MIN_MATCHES}

    out = []
    for fn in (_impact, _survival, _consistency, _leads,
               _overtime, _maps, _schedule, _days, _roles):
        fn(rows, out)

    out.sort(key=lambda t: ORDER.index(t["tone"]))
    return {"traits": out[:limit], "matches": len(rows), "min_matches": MIN_MATCHES}
