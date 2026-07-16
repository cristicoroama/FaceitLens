"""
Bridge between the pure demo parser and the database:
  - store_match(data)      : persist one parsed match (idempotent).
  - aggregate(steamid)     : combine every parsed match for a player into
                             profile-level real stats (HLTV 2.0, KAST, ...).

Rates are re-derived from summed totals (not averaged per-match), so a player's
aggregate rating is correct regardless of how many rounds each match had.
"""
from __future__ import annotations

from django.db.models import Sum

from .models import ParsedMatch, DemoPlayerStat


def store_match(data: dict) -> ParsedMatch:
    """
    Persist the output of demo_parser.stats_from_demo / stats_for_match.
    Safe to call again for the same match_id (updates in place).
    """
    match_id = data.get("match_id")
    if not match_id:
        raise ValueError("data has no match_id")

    match, _ = ParsedMatch.objects.update_or_create(
        match_id=match_id,
        defaults={
            "map_name": data.get("map") or "",
            "rounds": data.get("rounds") or 0,
        },
    )
    # Replace any previous per-player rows for this match.
    match.players.all().delete()
    rows = [
        DemoPlayerStat(
            match=match,
            steamid=sid,
            name=p.get("name") or "",
            rounds=p["rounds"],
            kills=p["kills"],
            deaths=p["deaths"],
            assists=p["assists"],
            # Prefer the parser's raw totals; fall back to reconstruction so
            # older/hand-built payloads still store.
            hs_kills=p.get("_hs_kills", round(p["hs_pct"] / 100 * p["kills"]) if p["kills"] else 0),
            damage=p.get("_damage", round(p["adr"] * p["rounds"], 1)),
            kast_rounds=p.get("_kast_rounds", round(p["kast"] / 100 * p["rounds"])),
            rating=p["rating"],
            opening_kills=p["opening_kills"],
            opening_deaths=p["opening_deaths"],
            opening_wins=p.get("_opening_wins", round((p["opening_success"] or 0) / 100
                               * (p["opening_kills"] + p["opening_deaths"]))),
            trade_kills=p["trade_kills"],
            traded_deaths=p["traded_deaths"],
            flash_assists=p["flash_assists"],
            enemies_flashed=p["enemies_flashed"],
            blind_time=p["blind_time"],
            clutch_attempts=p["clutch_attempts"],
            clutch_won=p["clutch_won"],
        )
        for sid, p in data.get("players", {}).items()
    ]
    DemoPlayerStat.objects.bulk_create(rows)
    return match


def _hltv_rating(rounds, kills, deaths, assists, damage, kast_rounds):
    if rounds == 0:
        return 0.0
    kpr = kills / rounds
    dpr = deaths / rounds
    apr = assists / rounds
    adr = damage / rounds
    kast = kast_rounds / rounds * 100
    impact = 2.13 * kpr + 0.42 * apr - 0.41
    rating = (
        0.0073 * kast + 0.3591 * kpr - 0.5329 * dpr
        + 0.2372 * impact + 0.0032 * adr + 0.1587
    )
    return max(0.0, rating)


def aggregate(steamid: str) -> dict | None:
    """
    Profile-level real stats for one SteamID64 across all parsed matches.
    Returns None if we have not parsed any of this player's demos yet.
    """
    qs = DemoPlayerStat.objects.filter(steamid=str(steamid))
    if not qs.exists():
        return None

    t = qs.aggregate(
        rounds=Sum("rounds"),
        kills=Sum("kills"),
        deaths=Sum("deaths"),
        assists=Sum("assists"),
        hs_kills=Sum("hs_kills"),
        damage=Sum("damage"),
        kast_rounds=Sum("kast_rounds"),
        opening_kills=Sum("opening_kills"),
        opening_deaths=Sum("opening_deaths"),
        opening_wins=Sum("opening_wins"),
        trade_kills=Sum("trade_kills"),
        traded_deaths=Sum("traded_deaths"),
        flash_assists=Sum("flash_assists"),
        enemies_flashed=Sum("enemies_flashed"),
        blind_time=Sum("blind_time"),
        clutch_attempts=Sum("clutch_attempts"),
        clutch_won=Sum("clutch_won"),
    )
    matches = qs.values("match_id").distinct().count()
    rounds = t["rounds"] or 0
    if rounds == 0:
        return None

    kills = t["kills"] or 0
    deaths = t["deaths"] or 0
    opens = (t["opening_kills"] or 0) + (t["opening_deaths"] or 0)
    return {
        "matches": matches,
        "rounds": rounds,
        "rating": round(
            _hltv_rating(rounds, kills, deaths, t["assists"] or 0,
                         t["damage"] or 0, t["kast_rounds"] or 0), 2),
        "kast": round((t["kast_rounds"] or 0) / rounds * 100, 1),
        "adr": round((t["damage"] or 0) / rounds, 1),
        "kpr": round(kills / rounds, 2),
        "dpr": round(deaths / rounds, 2),
        "kd": round(kills / deaths, 2) if deaths else float(kills),
        "hs_pct": round((t["hs_kills"] or 0) / kills * 100) if kills else 0,
        "opening_kills": t["opening_kills"] or 0,
        "opening_deaths": t["opening_deaths"] or 0,
        "opening_success": round((t["opening_wins"] or 0) / opens * 100) if opens else None,
        "trade_kills": t["trade_kills"] or 0,
        "traded_deaths": t["traded_deaths"] or 0,
        "flash_assists": t["flash_assists"] or 0,
        "enemies_flashed": t["enemies_flashed"] or 0,
        "blind_time": round(t["blind_time"] or 0, 1),
        "clutch_attempts": t["clutch_attempts"] or 0,
        "clutch_won": t["clutch_won"] or 0,
    }
