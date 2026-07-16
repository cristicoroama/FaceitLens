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
def _round_windows(parser: DemoParser):
    """
    Build the list of *live* round windows as (start_tick, end_tick, winner).

    A round's live phase runs from its round_freeze_end (guns are hot) to its
    round_end. Warmup / knife rounds are filtered out by requiring a real
    winning side (2 = T, 3 = CT).
    """
    freeze = parser.parse_event("round_freeze_end")
    ends = parser.parse_event("round_end")

    freeze_ticks = sorted(int(t) for t in freeze["tick"])
    end_rows = sorted(
        ((int(t), int(w)) for t, w in zip(ends["tick"], ends["winner"])),
        key=lambda x: x[0],
    )

    windows = []
    prev_end = -1
    for end_tick, winner in end_rows:
        if winner not in (2, 3):
            continue
        # Round starts at the latest freeze_end strictly before this end and
        # strictly after the previous round's end (avoids warmup overlap).
        candidates = [ft for ft in freeze_ticks if prev_end < ft < end_tick]
        if not candidates:
            continue
        start = max(candidates)
        windows.append((start, end_tick, winner))
        prev_end = end_tick
    return windows


def _teams_at(parser: DemoParser, start_ticks: list[int]) -> dict[int, dict[str, int]]:
    """
    team_num for every player at each round-start tick.
    Returns {start_tick: {steamid: team_num}}. Handles the half-time side swap
    because we resample every round.
    """
    if not start_ticks:
        return {}
    df = parser.parse_ticks(["team_num"], ticks=start_ticks)
    out: dict[int, dict[str, int]] = defaultdict(dict)
    for tick, sid, team in zip(df["tick"], df["steamid"], df["team_num"]):
        if sid is None:
            continue
        out[int(tick)][str(sid)] = int(team)
    return out


def _blank():
    return {
        "name": None,
        "rounds": 0,
        "kills": 0,
        "deaths": 0,
        "assists": 0,
        "hs_kills": 0,
        "damage": 0.0,
        "kast_rounds": 0,
        "opening_kills": 0,
        "opening_deaths": 0,
        "opening_wins": 0,      # opening duels taken that the team went on to win
        "trade_kills": 0,
        "traded_deaths": 0,
        "flash_assists": 0,
        "enemies_flashed": 0,
        "blind_time": 0.0,      # seconds of enemy blindness caused
        "clutch_attempts": 0,
        "clutch_won": 0,
    }


def stats_from_demo(dem_path: str) -> dict:
    """
    Parse a local .dem and return {steamid: {...real stats...}} plus a per-map
    label. Pure computation — safe to unit-test.
    """
    parser = DemoParser(dem_path)
    header = parser.parse_header()

    deaths = parser.parse_event("player_death")
    hurts = parser.parse_event("player_hurt")
    blinds = parser.parse_event("player_blind")

    windows = _round_windows(parser)
    start_ticks = [w[0] for w in windows]
    teams_by_start = _teams_at(parser, start_ticks)

    agg = defaultdict(_blank)

    def name_map():
        m = {}
        for sid, nm in zip(deaths["attacker_steamid"], deaths["attacker_name"]):
            if sid is not None:
                m[str(sid)] = nm
        for sid, nm in zip(deaths["user_steamid"], deaths["user_name"]):
            if sid is not None:
                m[str(sid)] = nm
        return m

    names = name_map()

    # Pre-bucket events by tick for quick per-round slicing.
    death_rows = sorted(
        (
            int(r.tick),
            str(r.attacker_steamid) if r.attacker_steamid is not None else None,
            str(r.user_steamid) if r.user_steamid is not None else None,
            str(r.assister_steamid) if r.assister_steamid is not None else None,
            bool(r.assistedflash),
            bool(r.headshot),
        )
        for r in deaths.itertuples(index=False)
    )
    hurt_rows = sorted(
        (
            int(r.tick),
            str(r.attacker_steamid) if r.attacker_steamid is not None else None,
            str(r.user_steamid) if r.user_steamid is not None else None,
            float(r.dmg_health),
        )
        for r in hurts.itertuples(index=False)
    )
    blind_rows = sorted(
        (
            int(r.tick),
            str(r.attacker_steamid) if r.attacker_steamid is not None else None,
            str(r.user_steamid) if r.user_steamid is not None else None,
            float(r.blind_duration),
        )
        for r in blinds.itertuples(index=False)
    )

    for start, end, winner in windows:
        teams = teams_by_start.get(start, {})
        if not teams:
            continue
        roster = set(teams)
        for sid in roster:
            agg[sid]["rounds"] += 1
            if agg[sid]["name"] is None:
                agg[sid]["name"] = names.get(sid)

        d_round = [r for r in death_rows if start < r[0] <= end]
        h_round = [r for r in hurt_rows if start < r[0] <= end]
        b_round = [r for r in blind_rows if start < r[0] <= end]

        # ----- capped ADR (health tracked so overkill doesn't count) -----
        hp = {sid: 100 for sid in roster}
        for _, att, vic, dmg in h_round:
            if att is None or vic is None or att == vic:
                continue
            if teams.get(att) == teams.get(vic):  # ignore team damage
                continue
            applied = min(dmg, hp.get(vic, 100))
            if applied <= 0:
                continue
            hp[vic] = hp.get(vic, 100) - applied
            agg[att]["damage"] += applied

        # ----- utility: flashes on enemies -----
        for _, att, vic, dur in b_round:
            if att is None or vic is None or att == vic:
                continue
            if teams.get(att) == teams.get(vic):  # self/team flash
                continue
            agg[att]["enemies_flashed"] += 1
            agg[att]["blind_time"] += dur

        # ----- kills / deaths / opening / trades / clutch -----
        alive = set(roster)
        killers, assisters, victims, traded = set(), set(), set(), set()
        recent = []  # (tick, killer, victim) for trade detection
        first_kill_done = False
        clutcher = {}  # team_num -> steamid currently 1-left

        for tick, att, vic, ast, flash, hs in d_round:
            if vic is None:
                continue
            agg[vic]["deaths"] += 1
            victims.add(vic)

            valid_kill = att is not None and att != vic and teams.get(att) != teams.get(vic)
            if valid_kill:
                agg[att]["kills"] += 1
                killers.add(att)
                if hs:
                    agg[att]["hs_kills"] += 1

                # opening duel = first kill of the round
                if not first_kill_done:
                    first_kill_done = True
                    agg[att]["opening_kills"] += 1
                    agg[vic]["opening_deaths"] += 1
                    if teams.get(att) == winner:
                        agg[att]["opening_wins"] += 1

                # trade: did the victim just kill a teammate of the attacker?
                for t0, k0, v0 in reversed(recent):
                    if tick - t0 > TRADE_WINDOW_TICKS:
                        break
                    if k0 == vic and teams.get(v0) == teams.get(att):
                        agg[att]["trade_kills"] += 1
                        agg[v0]["traded_deaths"] += 1
                        traded.add(v0)
                        break

                # assist (non-flash counted as assist; flash tracked separately)
                if ast is not None and ast != att and teams.get(ast) == teams.get(att):
                    agg[ast]["assists"] += 1
                    assisters.add(ast)
                    if flash:
                        agg[ast]["flash_assists"] += 1

                recent.append((tick, att, vic))

            # update alive + detect the moment a team drops to a lone survivor
            alive.discard(vic)
            for tnum in (2, 3):
                team_alive = [s for s in alive if teams.get(s) == tnum]
                enemy_alive = [s for s in alive if teams.get(s) not in (tnum, None)]
                if len(team_alive) == 1 and enemy_alive and tnum not in clutcher:
                    lone = team_alive[0]
                    clutcher[tnum] = lone
                    agg[lone]["clutch_attempts"] += 1

        # clutch won if the lone survivor's team took the round
        for tnum, sid in clutcher.items():
            if tnum == winner:
                agg[sid]["clutch_won"] += 1

        # ----- KAST: kill / assist / survived / traded death -----
        survivors = roster - victims
        kasters = killers | assisters | survivors | traded
        for sid in kasters:
            agg[sid]["kast_rounds"] += 1

    return {
        "map": header.get("map_name"),
        "rounds": len(windows),
        "players": _finalize(agg),
    }


# --------------------------------------------------------------------------- #
#  3. Derived metrics (rates + HLTV Rating 2.0)
# --------------------------------------------------------------------------- #
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
        # HLTV Rating 2.0 (community coefficients). Now REAL: KAST + ADR are
        # measured from the demo rather than estimated from per-match K/D.
        rating = (
            0.0073 * kast
            + 0.3591 * kpr
            - 0.5329 * dpr
            + 0.2372 * impact
            + 0.0032 * adr
            + 0.1587
        )
        opens = s["opening_kills"] + s["opening_deaths"]
        out[sid] = {
            "name": s["name"],
            "rounds": r,
            "kills": s["kills"],
            "deaths": s["deaths"],
            "assists": s["assists"],
            # Raw totals (underscore keys) so the DB layer can re-aggregate
            # exactly across matches instead of reversing rounded rates.
            "_damage": round(s["damage"], 1),
            "_kast_rounds": s["kast_rounds"],
            "_hs_kills": s["hs_kills"],
            "_opening_wins": s["opening_wins"],
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
        }
    return out


# --------------------------------------------------------------------------- #
#  4. Full pipeline for one match id
# --------------------------------------------------------------------------- #
def stats_for_match(match_id: str, api_key: str) -> dict:
    """Download + parse a FACEIT match by id and return real per-player stats."""
    url = get_demo_url(match_id, api_key)
    if not url:
        raise RuntimeError(f"No demo available for match {match_id}")
    tmp = tempfile.mkdtemp(prefix="faceitlens_demo_")
    try:
        dem = download_demo(url, tmp)
        data = stats_from_demo(dem)
        data["match_id"] = match_id
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
