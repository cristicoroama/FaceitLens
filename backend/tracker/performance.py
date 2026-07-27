"""
Estimated HLTV-style performance metrics from FACEIT per-match stats.

The FACEIT API does not expose per-round data (KAST, impact) or a real HLTV
rating, and older matches don't even carry ADR or double-kills. So we ESTIMATE
Rating / KAST / Firepower / ADR / double-kills from the basic per-match stats
(kills, deaths, assists, rounds, multi-kills) using linear-regression models.

Coefficients are ported from the open-source faceitperf project
(https://github.com/iffypixy/faceitperf), which fit them against real HLTV data.
Everything here is an APPROXIMATION and is labelled 'estimated' in the UI; when a
real value exists (e.g. FACEIT provides ADR for recent matches) we use it.
"""


def _f(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _clamp(x, lo=None, hi=None):
    if lo is not None and x < lo:
        return lo
    if hi is not None and x > hi:
        return hi
    return x


# --- regression models (ported from faceitperf) --------------------------- #
def estimate_adr(kpr, apr):
    return _clamp(3.3276314054649703 + kpr * 86.61895172 + apr * 78.64156577, 0)


def estimate_kast(kpr, apr, dpr):
    return _clamp(
        85.77576693024515 + kpr * 14.59741003 + apr * 39.57510705 - dpr * 46.21062528,
        0, 100,
    )


def estimate_rating(kpr, apr, dpr, adr, mkpr):
    return _clamp(
        0.6844811040150518
        + kpr * 0.65597945
        + apr * 0.31304591
        - dpr * 0.75999214
        + adr * 0.00370714
        + mkpr * 0.72169367,
        0,
    )


def estimate_firepower(kpr, apr, adr, mkpr):
    return _clamp(
        -187.0508572575841
        + kpr * 160.34947296
        - apr * 15.18186891
        + adr * 1.36153342
        + mkpr * 228.48279068,
        0, 100,
    )


def estimate_double_kpr(kpr, apr, adr, triple_kpr, quad_kpr, penta_kpr):
    return _clamp(
        -0.05357045289282321
        + kpr * 0.279077598
        - apr * 0.00786663351
        + adr * 0.000195105388
        - triple_kpr * 0.617993888
        - quad_kpr * 0.946751056
        + penta_kpr * 0.419746708,
        0, 1,
    )


def match_performance(player_stats, rounds=None):
    """Estimate one player's performance in a single match.

    :param player_stats: FACEIT ``player_stats`` dict (Kills, Deaths, ADR, ...)
    :param rounds: rounds played in the map (preferred); derived from K/R Ratio
                   if not given.
    :return: dict of metrics, or None when the stats are insufficient.
    """
    ps = player_stats or {}

    kills = _f(ps.get("Kills"))
    deaths = _f(ps.get("Deaths"))
    if kills is None or deaths is None:
        return None
    assists = _f(ps.get("Assists")) or 0.0

    r = _f(rounds)
    if not r or r <= 0:
        kpr0 = _f(ps.get("K/R Ratio"))
        if kpr0 and kpr0 > 0:
            r = kills / kpr0
    if not r or r <= 0:
        return None

    kpr = kills / r
    dpr = deaths / r
    apr = assists / r

    adr_raw = _f(ps.get("ADR"))
    if adr_raw is None:
        adr_raw = _f(ps.get("Average Damage per Round"))
    adr_estimated = adr_raw is None
    adr = adr_raw if adr_raw is not None else estimate_adr(kpr, apr)

    triple = _f(ps.get("Triple Kills")) or 0.0
    quad = _f(ps.get("Quadro Kills")) or 0.0
    penta = _f(ps.get("Penta Kills")) or 0.0
    double_raw = _f(ps.get("Double Kills"))
    if double_raw is None:
        double = estimate_double_kpr(kpr, apr, adr, triple / r, quad / r, penta / r) * r
    else:
        double = double_raw

    mkpr = (double + triple + quad + penta) / r

    return {
        "rating": round(estimate_rating(kpr, apr, dpr, adr, mkpr), 2),
        "firepower": round(estimate_firepower(kpr, apr, adr, mkpr)),
        "kast": round(estimate_kast(kpr, apr, dpr)),
        "adr": round(adr),
        "adr_estimated": adr_estimated,
        "kpr": round(kpr, 2),
        "estimated": True,
    }


def aggregate_performance(items, n=None):
    """Aggregate estimated performance across many matches (round-weighted, like
    faceitperf's computePlayerPerformance).

    :param items: list of dicts each carrying a FACEIT per-match ``stats`` dict.
    :param n: only consider the most recent ``n`` items.
    :return: dict with rating / firepower / kast / mkpr / adr etc., or None.
    """
    if n:
        items = items[:n]

    tk = td = ta = tr = tdmg = ths = 0.0
    tdouble = ttriple = tquad = tpenta = 0.0
    used = 0

    for it in items:
        ps = it.get("stats", {}) if isinstance(it, dict) else {}
        kills = _f(ps.get("Kills"))
        deaths = _f(ps.get("Deaths"))
        if kills is None or deaths is None:
            continue
        assists = _f(ps.get("Assists")) or 0.0

        rounds = _f(ps.get("Rounds"))
        if not rounds or rounds <= 0:
            kpr0 = _f(ps.get("K/R Ratio"))
            if kpr0 and kpr0 > 0:
                rounds = kills / kpr0
        if not rounds or rounds <= 0:
            continue

        kpr = kills / rounds
        apr = assists / rounds
        adr = _f(ps.get("ADR"))
        if adr is None:
            adr = _f(ps.get("Average Damage per Round"))
        if adr is None:
            adr = estimate_adr(kpr, apr)

        triple = _f(ps.get("Triple Kills")) or 0.0
        quad = _f(ps.get("Quadro Kills")) or 0.0
        penta = _f(ps.get("Penta Kills")) or 0.0
        double = _f(ps.get("Double Kills"))
        if double is None:
            double = estimate_double_kpr(
                kpr, apr, adr, triple / rounds, quad / rounds, penta / rounds
            ) * rounds

        tk += kills
        td += deaths
        ta += assists
        tr += rounds
        tdmg += adr * rounds
        ths += _f(ps.get("Headshots")) or 0.0
        tdouble += double
        ttriple += triple
        tquad += quad
        tpenta += penta
        used += 1

    if used == 0 or tr <= 0:
        return None

    kpr = tk / tr
    dpr = td / tr
    apr = ta / tr
    adr = tdmg / tr
    mkpr = (tdouble + ttriple + tquad + tpenta) / tr

    return {
        "matches": used,
        "rating": round(estimate_rating(kpr, apr, dpr, adr, mkpr), 2),
        "firepower": round(estimate_firepower(kpr, apr, adr, mkpr)),
        "kast": round(estimate_kast(kpr, apr, dpr)),
        "kpr": round(kpr, 2),
        "dpr": round(dpr, 2),
        "apr": round(apr, 2),
        "adr": round(adr),
        "mkpr": round(mkpr, 2),
        "kd": round(tk / td, 2) if td else round(tk, 2),
        "hs": round((ths / tk) * 100) if tk else 0,
    }
