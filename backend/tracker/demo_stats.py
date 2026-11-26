"""
Bridge between the pure demo parser and the database:
  - store_match(data)      : persist one parsed match (idempotent).
  - aggregate(steamid)     : combine every parsed match for a player into
                             profile-level real stats (HLTV 2.0, KAST, ...).

Rates are re-derived from summed totals (not averaged per-match), so a player's
aggregate rating is correct regardless of how many rounds each match had.
"""
from __future__ import annotations

from datetime import datetime, timezone as dt_timezone

from django.db.models import F, Sum
from django.db.models.functions import Coalesce

from .models import ParsedMatch, DemoPlayerStat

EXTRA_INT_FIELDS = (
    "rounds_won", "flashes_thrown", "smokes_thrown", "he_thrown", "molotovs_thrown",
    "teammates_flashed", "deaths_with_utility", "unused_utility_value",
    "pistol_rounds", "pistol_wins", "eco_rounds", "eco_wins", "force_rounds", "force_wins",
    "full_buy_rounds", "full_buy_wins", "save_rounds", "broken_eco_rounds",
)
EXTRA_FLOAT_FIELDS = ("he_damage", "fire_damage")
BUY_TYPES = ("pistol", "eco", "force", "full_buy")


def _finished_at(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    try:
        stamp = float(value)
    except (TypeError, ValueError):
        return None
    if stamp > 4102444800:
        stamp /= 1000
    return datetime.fromtimestamp(stamp, tz=dt_timezone.utc)


def store_match(data: dict) -> ParsedMatch:
    match_id = data.get("match_id")
    if not match_id:
        raise ValueError("data has no match_id")

    defaults = {
        "map_name": data.get("map") or "",
        "rounds": data.get("rounds") or 0,
        "economy": data.get("economy") or [],
    }
    finished = _finished_at(data.get("finished_at"))
    if finished:
        defaults["finished_at"] = finished
    match, _ = ParsedMatch.objects.update_or_create(match_id=match_id, defaults=defaults)
    match.players.all().delete()
    rows = []
    for sid, p in data.get("players", {}).items():
        if _suppressed(sid):
            continue
        extra = {k: int(p.get(k) or 0) for k in EXTRA_INT_FIELDS}
        extra.update({k: float(p.get(k) or 0) for k in EXTRA_FLOAT_FIELDS})
        rows.append(DemoPlayerStat(
            match=match,
            steamid=sid,
            name=p.get("name") or "",
            rounds=p["rounds"],
            kills=p["kills"],
            deaths=p["deaths"],
            assists=p["assists"],
            hs_kills=p.get("_hs_kills", round(p["hs_pct"] / 100 * p["kills"]) if p["kills"] else 0),
            damage=p.get("_damage", round(p["adr"] * p["rounds"], 1)),
            kast_rounds=p.get("_kast_rounds", round(p["kast"] / 100 * p["rounds"])),
            rating=p["rating"],
            impact=p.get("impact") or 0.0,
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
            equip_value=p.get("_equip_value", (p.get("avg_equip") or 0) * p["rounds"]),
            **extra,
        ))
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


def _pct(part, whole, digits=0):
    if not whole:
        return None
    value = part / whole * 100
    return round(value) if digits == 0 else round(value, digits)


def _ratio(part, whole, digits=2):
    if not whole:
        return None
    return round(part / whole, digits)


def utility_block(t: dict) -> dict:
    flashes = t.get("flashes_thrown") or 0
    deaths = t.get("deaths") or 0
    return {
        "flashes_thrown": flashes,
        "smokes_thrown": t.get("smokes_thrown") or 0,
        "he_thrown": t.get("he_thrown") or 0,
        "molotovs_thrown": t.get("molotovs_thrown") or 0,
        "enemies_flashed": t.get("enemies_flashed") or 0,
        "teammates_flashed": t.get("teammates_flashed") or 0,
        "flash_assists": t.get("flash_assists") or 0,
        "flash_efficiency": _ratio(t.get("enemies_flashed") or 0, flashes),
        "blind_time": round(t.get("blind_time") or 0, 1),
        "he_damage": round(t.get("he_damage") or 0, 1),
        "fire_damage": round(t.get("fire_damage") or 0, 1),
        "deaths_with_utility": t.get("deaths_with_utility") or 0,
        "unused_utility_value": t.get("unused_utility_value") or 0,
        "unused_utility_per_death": round((t.get("unused_utility_value") or 0) / deaths) if deaths else None,
    }


def economy_block(t: dict) -> dict:
    rounds = t.get("rounds") or 0
    out = {
        "avg_equip": round((t.get("equip_value") or 0) / rounds) if rounds else None,
        "save_rounds": t.get("save_rounds") or 0,
        "broken_eco_rounds": t.get("broken_eco_rounds") or 0,
    }
    for kind in BUY_TYPES:
        played = t.get(f"{kind}_rounds") or 0
        won = t.get(f"{kind}_wins") or 0
        out[kind] = {"rounds": played, "wins": won, "win_rate": _pct(won, played)}
    return out


def row_payload(row: DemoPlayerStat) -> dict:
    t = {f.name: getattr(row, f.name) for f in DemoPlayerStat._meta.concrete_fields if f.name != "match"}
    rounds = row.rounds or 0
    opens = row.opening_kills + row.opening_deaths
    return {
        "steamid": row.steamid,
        "name": row.name,
        "rounds": rounds,
        "rounds_won": row.rounds_won,
        "kills": row.kills,
        "deaths": row.deaths,
        "assists": row.assists,
        "rating": round(row.rating, 2),
        "impact": round(row.impact, 2),
        "kast": _pct(row.kast_rounds, rounds, 1),
        "adr": round(row.damage / rounds, 1) if rounds else None,
        "kd": round(row.kills / row.deaths, 2) if row.deaths else float(row.kills),
        "hs_pct": _pct(row.hs_kills, row.kills) or 0,
        "opening_kills": row.opening_kills,
        "opening_deaths": row.opening_deaths,
        "opening_success": _pct(row.opening_wins, opens),
        "trade_kills": row.trade_kills,
        "traded_deaths": row.traded_deaths,
        "clutch_attempts": row.clutch_attempts,
        "clutch_won": row.clutch_won,
        "utility": utility_block(t),
        "economy": economy_block(t),
    }


def match_payload(match: ParsedMatch) -> dict:
    players = sorted(
        (row_payload(r) for r in match.players.all()),
        key=lambda p: p["rating"],
        reverse=True,
    )
    return {
        "match_id": match.match_id,
        "map": match.map_name,
        "rounds": match.rounds,
        "finished_at": match.finished_at.isoformat() if match.finished_at else None,
        "parsed_at": match.parsed_at.isoformat() if match.parsed_at else None,
        "economy": match.economy or [],
        "players": players,
    }


def player_matches(steamid: str, limit: int = 30) -> list[dict]:
    qs = (
        DemoPlayerStat.objects.filter(steamid=str(steamid))
        .select_related("match")
        .annotate(played_at=Coalesce("match__finished_at", "match__parsed_at"))
        .order_by(F("played_at").desc(nulls_last=True), "-match__id")[:limit]
    )
    out = []
    for row in qs:
        item = row_payload(row)
        m = row.match
        lost = (row.rounds or 0) - row.rounds_won
        item.update({
            "match_id": m.match_id,
            "map": m.map_name,
            "finished_at": m.finished_at.isoformat() if m.finished_at else None,
            "parsed_at": m.parsed_at.isoformat() if m.parsed_at else None,
            "score": f"{row.rounds_won}-{lost}",
            "result": "win" if row.rounds_won > lost else ("loss" if row.rounds_won < lost else "draw"),
        })
        out.append(item)
    return out


SUM_FIELDS = (
    "rounds", "kills", "deaths", "assists", "hs_kills", "damage", "kast_rounds",
    "opening_kills", "opening_deaths", "opening_wins", "trade_kills", "traded_deaths",
    "flash_assists", "enemies_flashed", "blind_time", "clutch_attempts", "clutch_won",
    "equip_value",
) + EXTRA_INT_FIELDS + EXTRA_FLOAT_FIELDS


def totals(qs) -> dict:
    t = qs.aggregate(**{name: Sum(name) for name in SUM_FIELDS})
    return {k: (v or 0) for k, v in t.items()}


def aggregate(steamid: str) -> dict | None:
    qs = DemoPlayerStat.objects.filter(steamid=str(steamid))
    if not qs.exists():
        return None

    t = totals(qs)
    matches = qs.values("match_id").distinct().count()
    rounds = t["rounds"]
    if rounds == 0:
        return None

    kills = t["kills"]
    deaths = t["deaths"]
    opens = t["opening_kills"] + t["opening_deaths"]
    return {
        "matches": matches,
        "rounds": rounds,
        "rating": round(
            _hltv_rating(rounds, kills, deaths, t["assists"], t["damage"], t["kast_rounds"]), 2),
        "kast": round(t["kast_rounds"] / rounds * 100, 1),
        "adr": round(t["damage"] / rounds, 1),
        "kpr": round(kills / rounds, 2),
        "dpr": round(deaths / rounds, 2),
        "kd": round(kills / deaths, 2) if deaths else float(kills),
        "hs_pct": round(t["hs_kills"] / kills * 100) if kills else 0,
        "opening_kills": t["opening_kills"],
        "opening_deaths": t["opening_deaths"],
        "opening_success": round(t["opening_wins"] / opens * 100) if opens else None,
        "trade_kills": t["trade_kills"],
        "traded_deaths": t["traded_deaths"],
        "flash_assists": t["flash_assists"],
        "enemies_flashed": t["enemies_flashed"],
        "blind_time": round(t["blind_time"], 1),
        "clutch_attempts": t["clutch_attempts"],
        "clutch_won": t["clutch_won"],
        "utility": utility_block(t),
        "economy": economy_block(t),
    }


def _suppressed(steamid):
    try:
        from .privacy import is_suppressed
        return is_suppressed(steamid=str(steamid))
    except Exception:
        return False
