"""
Five skill ratings on a 0-100 scale, from FACEIT's own lifetime numbers.

FACEIT publishes no percentile and no skill breakdown, so each rating here is a
raw stat mapped onto a scale between two hand-set reference points: a value a
low-level player typically posts, and one only a strong player reaches. That is
all a rating is — a position between two marks. It is NOT a percentile, and the
UI says so, because "73/100" invites people to read it as "better than 73% of
players", which nobody here has the data to claim.

The reference points come from FACEIT's published CS2 averages and from where
the level boundaries sit; they are deliberately conservative, so an average
player lands near the middle rather than being flattered.

Every rating degrades on its own. A player whose account predates FACEIT's
advanced stats has no entry or clutch data, and those two ratings come back
None instead of being invented from what is left.
"""


def _f(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _first(stats, *names):
    """First of `names` present in the stats block, as a float.

    FACEIT has renamed several CS2 fields since launch and older cached
    profiles carry the old spelling, so each metric names every form it has
    been seen under rather than betting on one.
    """
    for name in names:
        v = _f((stats or {}).get(name))
        if v is not None:
            return v
    return None


def _scale(value, low, high):
    """Map `value` onto 0-100 between two reference points."""
    if value is None or high == low:
        return None
    pct = (value - low) / (high - low) * 100
    return int(max(0, min(100, round(pct))))


def _mix(*pairs):
    """Weighted average of (score, weight), ignoring the parts that are None."""
    used = [(s, w) for s, w in pairs if s is not None]
    if not used:
        return None
    total = sum(w for _, w in used)
    return int(round(sum(s * w for s, w in used) / total))


def _detail(*parts):
    """The numbers a rating was built from, as one line. Drops what's missing."""
    return " · ".join(p for p in parts if p) or None


def _num(value, fmt, suffix):
    return None if value is None else f"{format(value, fmt)} {suffix}"


def _rate(value, suffix):
    return None if value is None else f"{int(round(value))}% {suffix}"


def build_skill_profile(lifetime, recent=None):
    """Five ratings plus the numbers behind each, or None if nothing is known.

    :param lifetime: FACEIT's ``stats.lifetime`` block.
    :param recent: our own recent-form aggregate, used for ADR when FACEIT's
                   lifetime block predates the field.
    """
    life = lifetime or {}
    rec = recent or {}

    kd = _first(life, "Average K/D Ratio", "K/D Ratio")
    kr = _first(life, "Average K/R Ratio", "K/R Ratio")
    hs = _first(life, "Average Headshots %", "Headshots %")
    adr = _first(life, "ADR", "Average Damage per Round")
    if adr is None:
        adr = _f(rec.get("adr"))

    entry_rate = _first(life, "Entry Rate")
    entry_success = _first(life, "Entry Success Rate")
    clutch_1v1 = _first(life, "1v1 Win Rate")
    clutch_1v2 = _first(life, "1v2 Win Rate")
    util_dmg = _first(life, "Utility Damage per Round", "Utility Damage Success Rate")
    flash_success = _first(life, "Flash Success Rate")

    # FACEIT reports these rates as 0-1 on some accounts and 0-100 on others.
    # A "win rate" above 1 can only be the percentage form, so anything at or
    # below 1 gets scaled up.
    def as_pct(v):
        if v is None:
            return None
        return v * 100 if v <= 1 else v

    entry_rate = as_pct(entry_rate)
    entry_success = as_pct(entry_success)
    clutch_1v1 = as_pct(clutch_1v1)
    clutch_1v2 = as_pct(clutch_1v2)
    flash_success = as_pct(flash_success)

    ratings = []

    # --- Aim: can they win the duel they take. -------------------------------
    aim = _mix((_scale(kd, 0.70, 1.40), 2), (_scale(hs, 30, 60), 1))
    ratings.append({
        "key": "aim",
        "label": "Aim",
        "score": aim,
        "detail": _detail(_num(kd, ".2f", "K/D"), _rate(hs, "HS")),
    })

    # --- Firepower: how much damage lands per round, duel won or not. --------
    fire = _mix((_scale(adr, 55, 95), 2), (_scale(kr, 0.55, 0.85), 1))
    ratings.append({
        "key": "firepower",
        "label": "Firepower",
        "score": fire,
        "detail": _detail(_num(adr, ".0f", "ADR"), _num(kr, ".2f", "K/R")),
    })

    # --- Entry fragging: taking the first duel, and winning it. --------------
    entry = _mix((_scale(entry_success, 40, 60), 2), (_scale(entry_rate, 15, 35), 1))
    ratings.append({
        "key": "entry",
        "label": "Entry Fragging",
        "score": entry,
        "detail": _detail(_rate(entry_success, "entry win"), _rate(entry_rate, "entry rate")),
    })

    # --- Clutching: the rounds that come down to one player. -----------------
    clutch = _mix((_scale(clutch_1v1, 25, 55), 2), (_scale(clutch_1v2, 8, 28), 1))
    ratings.append({
        "key": "clutch",
        "label": "Clutching",
        "score": clutch,
        "detail": _detail(_rate(clutch_1v1, "1v1"), _rate(clutch_1v2, "1v2")),
    })

    # --- Utility: the contribution that never shows up as a kill. ------------
    util = _mix((_scale(util_dmg, 1.5, 8.0), 2), (_scale(flash_success, 25, 60), 1))
    ratings.append({
        "key": "utility",
        "label": "Utility",
        "score": util,
        "detail": _detail(_num(util_dmg, ".1f", "util dmg/rd"), _rate(flash_success, "flash")),
    })

    scored = [r for r in ratings if r["score"] is not None]
    if not scored:
        return None

    overall = int(round(sum(r["score"] for r in scored) / len(scored)))

    return {
        "overall": overall,
        "ratings": ratings,
        # How many of the five actually scored. The UI uses it to decide
        # whether to explain the n/a rows.
        "rated": len(scored),
    }
