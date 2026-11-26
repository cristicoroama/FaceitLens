"""
Real per-match stats by PARSING THE CS2 DEMO (.dem).

This is the data the FACEIT Data API does NOT expose and the reason sites like
csrep.gg / Leetify / scope.gg look so much richer than an API-only tracker:

  - real HLTV Rating 2.0  (uses real KAST + ADR, not an estimate)
  - KAST %                (kill / assist / survived / traded, per round)
  - opening duels         (first kill/death of each round + success rate)
  - clutches              (1vX situations won)
  - trade kills / traded deaths
  - utility               (flash assists, enemies flashed, blind time)
  - capped ADR            (overkill removed, like HLTV)

Pipeline:
  match_id -> FACEIT /matches/{id} -> demo_url -> download .dem(.gz)
           -> demoparser2 -> per-round events -> per-player aggregates.

Everything below is pure Python + demoparser2; no network except get_demo_url /
download_demo, so the number-crunching is unit-testable against a local .dem.
"""
from __future__ import annotations

import gzip
import os
import shutil
import tempfile
from collections import defaultdict

import requests

from demoparser2 import DemoParser

# CS2 competitive demos are recorded at 64 tick.
TICKRATE = 64
# A kill counts as a "trade" if it avenges a teammate who died within this window.
TRADE_WINDOW_TICKS = 5 * TICKRATE

FACEIT_BASE = "https://open.faceit.com/data/v4"


# --------------------------------------------------------------------------- #
#  1. Locate + fetch the demo
# --------------------------------------------------------------------------- #
def get_demo_url(match_id: str, api_key: str) -> str | None:
    """Return the first demo download URL for a finished match, or None."""
    r = requests.get(
        f"{FACEIT_BASE}/matches/{match_id}",
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=15,
    )
    r.raise_for_status()
    urls = r.json().get("demo_url") or []
    return urls[0] if urls else None


def download_demo(url: str, dest_dir: str) -> str:
    """
    Download a (possibly gzipped) demo and return the path to the .dem file.
    FACEIT serves demos as `.dem.gz`.
    """
    os.makedirs(dest_dir, exist_ok=True)
    raw_path = os.path.join(dest_dir, "match.dem.gz")
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(raw_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                f.write(chunk)

    dem_path = os.path.join(dest_dir, "match.dem")
    # Gunzip if it really is gzip (magic bytes 1f 8b), else it's already a .dem.
    with open(raw_path, "rb") as f:
        magic = f.read(2)
    if magic == b"\x1f\x8b":
        with gzip.open(raw_path, "rb") as src, open(dem_path, "wb") as dst:
            shutil.copyfileobj(src, dst)
    else:
        os.replace(raw_path, dem_path)
    return dem_path


# --------------------------------------------------------------------------- #
#  2. Parse a local .dem into per-player real stats
# --------------------------------------------------------------------------- #
GRENADE_THROW_FIELDS = {
    "flashbang": "flashes_thrown",
    "smokegrenade": "smokes_thrown",
    "hegrenade": "he_thrown",
    "molotov": "molotovs_thrown",
    "incgrenade": "molotovs_thrown",
}
HE_DAMAGE_WEAPONS = {"hegrenade"}
FIRE_DAMAGE_WEAPONS = {"inferno", "molotov", "incgrenade"}
UTILITY_PRICES = (
    ("flashbang", 200),
    ("smoke", 300),
    ("high explosive", 300),
    ("hegrenade", 300),
    ("molotov", 400),
    ("incendiary", 500),
    ("incgrenade", 500),
    ("decoy", 50),
)
PISTOL_ROUND_INDICES = (0, 12)
ECO_MAX_AVG_EQUIP = 1500
FULL_BUY_MIN_AVG_EQUIP = 3800
BROKEN_ECO_MIN_EQUIP = 2500
BUY_SAMPLE_DELAY_TICKS = 5 * TICKRATE
SIDE_NAMES = {2: "T", 3: "CT"}


def _sid(value):
    if value is None:
        return None
    if isinstance(value, float):
        if value != value:
            return None
        value = int(value)
    text = str(value)
    if not text or text == "0" or text.lower() == "nan":
        return None
    return text


def _num(value, default=0):
    try:
        if value is None:
            return default
        out = float(value)
        return default if out != out else out
    except (TypeError, ValueError):
        return default


def _weapon(value):
    return str(value or "").replace("weapon_", "")


def _columns(df, cols):
    if df is None or len(df) == 0:
        return []
    size = len(df)
    data = [df[c].tolist() if c in df.columns else [None] * size for c in cols]
    return list(zip(*data))


def _event_rows(parser, name, cols):
    try:
        df = parser.parse_event(name)
    except Exception:
        return []
    return _columns(df, cols)


def _round_windows(parser):
    freeze_ticks = sorted(int(_num(r[0])) for r in _event_rows(parser, "round_freeze_end", ["tick"]))
    end_rows = sorted(
        ((int(_num(t)), int(_num(w))) for t, w in _event_rows(parser, "round_end", ["tick", "winner"])),
        key=lambda x: x[0],
    )

    windows = []
    prev_end = -1
    for end_tick, winner in end_rows:
        if winner not in (2, 3):
            continue
        candidates = [ft for ft in freeze_ticks if prev_end < ft < end_tick]
        if not candidates:
            continue
        windows.append((max(candidates), end_tick, winner))
        prev_end = end_tick
    return windows


def _round_samples(parser, windows):
    if not windows:
        return {}, {}
    start_ticks = [w[0] for w in windows]
    buy_ticks = [min(w[0] + BUY_SAMPLE_DELAY_TICKS, w[1]) for w in windows]
    wanted = sorted(set(start_ticks) | set(buy_ticks))
    try:
        df = parser.parse_ticks(["team_num", "current_equip_value"], ticks=wanted)
        rows = _columns(df, ["tick", "steamid", "team_num", "current_equip_value"])
    except Exception:
        df = parser.parse_ticks(["team_num"], ticks=start_ticks)
        rows = [r + (None,) for r in _columns(df, ["tick", "steamid", "team_num"])]
    del df

    by_tick = defaultdict(dict)
    for tick, sid, team, equip in rows:
        sid = _sid(sid)
        if sid is None:
            continue
        by_tick[int(_num(tick))][sid] = (int(_num(team)), _num(equip))

    teams, equips = {}, {}
    for start, buy in zip(start_ticks, buy_ticks):
        at_start = by_tick.get(start, {})
        at_buy = by_tick.get(buy, {})
        teams[start] = {sid: team for sid, (team, _) in at_start.items() if team in (2, 3)}
        equips[start] = {
            sid: max(at_start.get(sid, (0, 0))[1], at_buy.get(sid, (0, 0))[1])
            for sid in teams[start]
        }
    return teams, equips


def _inventory_at(parser, ticks):
    if not ticks:
        return {}
    try:
        df = parser.parse_ticks(["inventory"], ticks=sorted(set(ticks)))
    except Exception:
        return {}
    out = {}
    for tick, sid, inv in _columns(df, ["tick", "steamid", "inventory"]):
        sid = _sid(sid)
        if sid is None:
            continue
        if inv is None or isinstance(inv, (str, float)):
            items = []
        else:
            try:
                items = [str(i) for i in inv]
            except TypeError:
                items = []
        out[(int(_num(tick)), sid)] = items
    del df
    return out


def _utility_value(items):
    total = 0
    for item in items or []:
        name = item.lower()
        for key, price in UTILITY_PRICES:
            if key in name:
                total += price
                break
    return total


def _buy_type(round_index, values):
    if round_index in PISTOL_ROUND_INDICES:
        return "pistol"
    if not values:
        return "eco"
    avg = sum(values) / len(values)
    if avg < ECO_MAX_AVG_EQUIP:
        return "eco"
    if avg < FULL_BUY_MIN_AVG_EQUIP:
        return "force"
    return "full_buy"


def _blank():
    return {
        "name": None,
        "rounds": 0,
        "rounds_won": 0,
        "kills": 0,
        "deaths": 0,
        "assists": 0,
        "hs_kills": 0,
        "damage": 0.0,
        "kast_rounds": 0,
        "opening_kills": 0,
        "opening_deaths": 0,
        "opening_wins": 0,
        "trade_kills": 0,
        "traded_deaths": 0,
        "flash_assists": 0,
        "enemies_flashed": 0,
        "teammates_flashed": 0,
        "blind_time": 0.0,
        "clutch_attempts": 0,
        "clutch_won": 0,
        "flashes_thrown": 0,
        "smokes_thrown": 0,
        "he_thrown": 0,
        "molotovs_thrown": 0,
        "he_damage": 0.0,
        "fire_damage": 0.0,
        "deaths_with_utility": 0,
        "unused_utility_value": 0,
        "equip_value": 0.0,
        "pistol_rounds": 0,
        "pistol_wins": 0,
        "eco_rounds": 0,
        "eco_wins": 0,
        "force_rounds": 0,
        "force_wins": 0,
        "full_buy_rounds": 0,
        "full_buy_wins": 0,
        "save_rounds": 0,
        "broken_eco_rounds": 0,
    }


def stats_from_demo(dem_path: str) -> dict:
    parser = DemoParser(dem_path)
    try:
        return stats_from_parser(parser)
    finally:
        del parser


def stats_from_parser(parser) -> dict:
    header = parser.parse_header() or {}

    death_rows = sorted(
        (
            (int(_num(t)), _sid(a), _sid(v), _sid(ast), bool(_num(fl)), bool(_num(hs)), an, vn)
            for t, a, v, ast, fl, hs, an, vn in _event_rows(
                parser,
                "player_death",
                ["tick", "attacker_steamid", "user_steamid", "assister_steamid",
                 "assistedflash", "headshot", "attacker_name", "user_name"],
            )
        ),
        key=lambda r: r[0],
    )
    hurt_rows = sorted(
        (
            (int(_num(t)), _sid(a), _sid(v), _num(d), _weapon(w))
            for t, a, v, d, w in _event_rows(
                parser, "player_hurt",
                ["tick", "attacker_steamid", "user_steamid", "dmg_health", "weapon"],
            )
        ),
        key=lambda r: r[0],
    )
    blind_rows = sorted(
        (
            (int(_num(t)), _sid(a), _sid(v), _num(d))
            for t, a, v, d in _event_rows(
                parser, "player_blind",
                ["tick", "attacker_steamid", "user_steamid", "blind_duration"],
            )
        ),
        key=lambda r: r[0],
    )
    throw_rows = sorted(
        (
            (int(_num(t)), _sid(u), GRENADE_THROW_FIELDS[_weapon(w)])
            for t, u, w in _event_rows(parser, "weapon_fire", ["tick", "user_steamid", "weapon"])
            if _weapon(w) in GRENADE_THROW_FIELDS
        ),
        key=lambda r: r[0],
    )

    names = {}
    for _, att, vic, _, _, _, att_name, vic_name in death_rows:
        if att is not None and att_name:
            names[att] = att_name
        if vic is not None and vic_name:
            names[vic] = vic_name

    windows = _round_windows(parser)
    teams_by_start, equip_by_start = _round_samples(parser, windows)
    inventories = _inventory_at(
        parser,
        [max(r[0] - 1, 0) for r in death_rows
         if r[2] is not None and any(s < r[0] <= e for s, e, _ in windows)],
    )

    agg = defaultdict(_blank)
    economy = []

    for round_index, (start, end, winner) in enumerate(windows):
        teams = teams_by_start.get(start, {})
        if not teams:
            continue
        equips = equip_by_start.get(start, {})
        roster = set(teams)
        for sid in roster:
            agg[sid]["rounds"] += 1
            if teams[sid] == winner:
                agg[sid]["rounds_won"] += 1
            if agg[sid]["name"] is None:
                agg[sid]["name"] = names.get(sid)

        d_round = [r for r in death_rows if start < r[0] <= end]
        h_round = [r for r in hurt_rows if start < r[0] <= end]
        b_round = [r for r in blind_rows if start < r[0] <= end]

        for tick, sid, field in throw_rows:
            if sid in roster and start < tick <= end:
                agg[sid][field] += 1

        hp = {sid: 100 for sid in roster}
        for _, att, vic, dmg, weapon in h_round:
            if att is None or vic is None or att == vic:
                continue
            if teams.get(att) == teams.get(vic):
                continue
            applied = min(dmg, hp.get(vic, 100))
            if applied <= 0:
                continue
            hp[vic] = hp.get(vic, 100) - applied
            agg[att]["damage"] += applied
            if weapon in HE_DAMAGE_WEAPONS:
                agg[att]["he_damage"] += applied
            elif weapon in FIRE_DAMAGE_WEAPONS:
                agg[att]["fire_damage"] += applied

        for _, att, vic, dur in b_round:
            if att is None or vic is None or att == vic:
                continue
            if teams.get(att) == teams.get(vic):
                agg[att]["teammates_flashed"] += 1
                continue
            agg[att]["enemies_flashed"] += 1
            agg[att]["blind_time"] += dur

        alive = set(roster)
        killers, assisters, victims, traded = set(), set(), set(), set()
        recent = []
        first_kill_done = False
        clutcher = {}

        for tick, att, vic, ast, flash, hs, _, _ in d_round:
            if vic is None:
                continue
            agg[vic]["deaths"] += 1
            victims.add(vic)

            held = _utility_value(inventories.get((max(tick - 1, 0), vic)))
            if held:
                agg[vic]["deaths_with_utility"] += 1
                agg[vic]["unused_utility_value"] += held

            valid_kill = att is not None and att != vic and teams.get(att) != teams.get(vic)
            if valid_kill:
                agg[att]["kills"] += 1
                killers.add(att)
                if hs:
                    agg[att]["hs_kills"] += 1

                if not first_kill_done:
                    first_kill_done = True
                    agg[att]["opening_kills"] += 1
                    agg[vic]["opening_deaths"] += 1
                    if teams.get(att) == winner:
                        agg[att]["opening_wins"] += 1

                for t0, k0, v0 in reversed(recent):
                    if tick - t0 > TRADE_WINDOW_TICKS:
                        break
                    if k0 == vic and teams.get(v0) == teams.get(att):
                        agg[att]["trade_kills"] += 1
                        agg[v0]["traded_deaths"] += 1
                        traded.add(v0)
                        break

                if ast is not None and ast != att and teams.get(ast) == teams.get(att):
                    agg[ast]["assists"] += 1
                    assisters.add(ast)
                    if flash:
                        agg[ast]["flash_assists"] += 1

                recent.append((tick, att, vic))

            alive.discard(vic)
            for tnum in (2, 3):
                team_alive = [s for s in alive if teams.get(s) == tnum]
                enemy_alive = [s for s in alive if teams.get(s) not in (tnum, None)]
                if len(team_alive) == 1 and enemy_alive and tnum not in clutcher:
                    lone = team_alive[0]
                    clutcher[tnum] = lone
                    agg[lone]["clutch_attempts"] += 1

        for tnum, sid in clutcher.items():
            if tnum == winner:
                agg[sid]["clutch_won"] += 1

        survivors = roster - victims
        kasters = killers | assisters | survivors | traded
        for sid in kasters:
            agg[sid]["kast_rounds"] += 1

        round_econ = {"round": round_index + 1, "winner": SIDE_NAMES.get(winner)}
        for tnum in (2, 3):
            members = [sid for sid in roster if teams[sid] == tnum]
            values = [equips.get(sid, 0) for sid in members]
            kind = _buy_type(round_index, values)
            round_econ[SIDE_NAMES[tnum].lower()] = {"value": int(sum(values)), "type": kind}
            won = tnum == winner
            for sid in members:
                own = equips.get(sid, 0)
                agg[sid]["equip_value"] += own
                agg[sid][f"{kind}_rounds"] += 1
                if won:
                    agg[sid][f"{kind}_wins"] += 1
                elif sid in survivors:
                    agg[sid]["save_rounds"] += 1
                if kind == "eco" and own >= BROKEN_ECO_MIN_EQUIP:
                    agg[sid]["broken_eco_rounds"] += 1
        economy.append(round_econ)

    return {
        "map": header.get("map_name"),
        "rounds": len(windows),
        "economy": economy,
        "players": _finalize(agg),
    }


# --------------------------------------------------------------------------- #
#  3. Derived metrics (rates + HLTV Rating 2.0)
# --------------------------------------------------------------------------- #
RAW_COUNTERS = (
    "rounds_won", "teammates_flashed", "flashes_thrown", "smokes_thrown", "he_thrown",
    "molotovs_thrown", "deaths_with_utility", "unused_utility_value", "pistol_rounds",
    "pistol_wins", "eco_rounds", "eco_wins", "force_rounds", "force_wins",
    "full_buy_rounds", "full_buy_wins", "save_rounds", "broken_eco_rounds",
)


def _finalize(agg: dict) -> dict:
    out = {}
    for sid, s in agg.items():
        r = s["rounds"]
        if r == 0:
            continue
        kpr = s["kills"] / r
        dpr = s["deaths"] / r
        apr = s["assists"] / r
        adr = s["damage"] / r
        kast = s["kast_rounds"] / r * 100
        impact = 2.13 * kpr + 0.42 * apr - 0.41
        rating = (
            0.0073 * kast
            + 0.3591 * kpr
            - 0.5329 * dpr
            + 0.2372 * impact
            + 0.0032 * adr
            + 0.1587
        )
        opens = s["opening_kills"] + s["opening_deaths"]
        row = {
            "name": s["name"],
            "rounds": r,
            "kills": s["kills"],
            "deaths": s["deaths"],
            "assists": s["assists"],
            "_damage": round(s["damage"], 1),
            "_kast_rounds": s["kast_rounds"],
            "_hs_kills": s["hs_kills"],
            "_opening_wins": s["opening_wins"],
            "_equip_value": round(s["equip_value"], 1),
            "kd": round(s["kills"] / s["deaths"], 2) if s["deaths"] else float(s["kills"]),
            "kpr": round(kpr, 2),
            "dpr": round(dpr, 2),
            "adr": round(adr, 1),
            "hs_pct": round(s["hs_kills"] / s["kills"] * 100) if s["kills"] else 0,
            "kast": round(kast, 1),
            "impact": round(max(0.0, impact), 2),
            "rating": round(max(0.0, rating), 2),
            "opening_kills": s["opening_kills"],
            "opening_deaths": s["opening_deaths"],
            "opening_success": round(s["opening_wins"] / opens * 100) if opens else None,
            "trade_kills": s["trade_kills"],
            "traded_deaths": s["traded_deaths"],
            "flash_assists": s["flash_assists"],
            "enemies_flashed": s["enemies_flashed"],
            "blind_time": round(s["blind_time"], 1),
            "clutch_attempts": s["clutch_attempts"],
            "clutch_won": s["clutch_won"],
            "he_damage": round(s["he_damage"], 1),
            "fire_damage": round(s["fire_damage"], 1),
            "avg_equip": round(s["equip_value"] / r),
            "flash_efficiency": (
                round(s["enemies_flashed"] / s["flashes_thrown"], 2) if s["flashes_thrown"] else None
            ),
        }
        for key in RAW_COUNTERS:
            row[key] = s[key]
        out[sid] = row
    return out


# --------------------------------------------------------------------------- #
#  4. Full pipeline for one match id
# --------------------------------------------------------------------------- #
def get_match_meta(match_id: str, api_key: str) -> dict:
    r = requests.get(
        f"{FACEIT_BASE}/matches/{match_id}",
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=15,
    )
    r.raise_for_status()
    body = r.json()
    urls = body.get("demo_url") or []
    if isinstance(urls, str):
        urls = [urls]
    return {"demo_url": urls[0] if urls else None, "finished_at": body.get("finished_at")}


def stats_for_match(match_id: str, api_key: str) -> dict:
    meta = get_match_meta(match_id, api_key)
    url = meta["demo_url"]
    if not url:
        raise RuntimeError(f"No demo available for match {match_id}")
    tmp = tempfile.mkdtemp(prefix="faceitlens_demo_")
    try:
        dem = download_demo(url, tmp)
        data = stats_from_demo(dem)
        data["match_id"] = match_id
        data["finished_at"] = meta["finished_at"]
        return data
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# --------------------------------------------------------------------------- #
#  CLI: parse a local .dem for quick verification
#    python -m tracker.demo_parser path/to/match.dem
# --------------------------------------------------------------------------- #
if __name__ == "__main__":
    import sys
    import json

    if len(sys.argv) < 2:
        print("usage: python -m tracker.demo_parser <match.dem>")
        raise SystemExit(1)
    result = stats_from_demo(sys.argv[1])
    players = sorted(
        result["players"].values(), key=lambda p: p["rating"], reverse=True
    )
    print(f"map={result['map']}  rounds={result['rounds']}  players={len(players)}\n")
    hdr = f"{'player':<18}{'rating':>7}{'K-D-A':>10}{'ADR':>7}{'KAST':>7}{'HS%':>6}{'OPK/OPD':>9}{'clutch':>8}{'flashes':>9}"
    print(hdr)
    print("-" * len(hdr))
    for p in players:
        nm = (p["name"] or "?")[:16]
        kda = f"{p['kills']}-{p['deaths']}-{p['assists']}"
        opk = f"{p['opening_kills']}/{p['opening_deaths']}"
        clu = f"{p['clutch_won']}/{p['clutch_attempts']}"
        print(
            f"{nm:<18}{p['rating']:>7}{kda:>10}{p['adr']:>7}{p['kast']:>7}"
            f"{p['hs_pct']:>5}%{opk:>9}{clu:>8}{p['enemies_flashed']:>9}"
        )
    print("\nfull JSON for top player:")
    print(json.dumps(players[0], indent=2))
