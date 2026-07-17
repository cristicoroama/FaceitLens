"""
Account Trust Score — a csrep-style "legit-o-meter" built ONLY from signals we
can get without parsing demos: Steam account age, CS2 hours, Steam level, VAC /
FACEIT bans, inventory, and FACEIT activity.

This is NOT cheat detection (that needs demo/round data). It answers a different,
still-useful question: "how established / legit is this account?" — great for
spotting fresh smurfs and throwaway accounts. Labelled honestly in the UI.

`compute_trust` is pure and unit-testable; `build_trust` just extracts the
signals from an already-fetched player summary + Steam data.
"""
from __future__ import annotations

import time


def _tier(score: int) -> str:
    if score >= 85:
        return "EXCELLENT"
    if score >= 70:
        return "GOOD"
    if score >= 55:
        return "FAIR"
    if score >= 35:
        return "LOW"
    return "SUSPICIOUS"


def _pillar_age(days):
    if days is None:
        return None
    for lo, pts in ((1825, 25), (1095, 22), (365, 18), (180, 12), (30, 6), (0, 2)):
        if days >= lo:
            return pts, 25
    return 0, 25


def _pillar_hours(h):
    if h is None:
        return None
    for lo, pts in ((2000, 20), (1000, 17), (500, 14), (200, 10), (50, 5), (0, 1)):
        if h >= lo:
            return pts, 20
    return 0, 20


def _pillar_level(lvl):
    if lvl is None:
        return None
    for lo, pts in ((50, 15), (20, 12), (10, 9), (5, 6), (1, 3), (0, 0)):
        if lvl >= lo:
            return pts, 15
    return 0, 15


def _pillar_inventory(items):
    if items is None:
        return None
    for lo, pts in ((50, 15), (20, 12), (5, 8), (1, 4)):
        if items >= lo:
            return pts, 15
    return 0, 15


def _pillar_matches(m):
    if m is None:
        return None
    for lo, pts in ((1000, 25), (500, 21), (200, 16), (50, 10), (10, 5), (0, 2)):
        if m >= lo:
            return pts, 25
    return 0, 25


def compute_trust(signals: dict) -> dict:
    """
    signals: account_age_days, hours_cs2, steam_level, inventory_items,
             faceit_matches (any may be None), plus booleans
             vac_banned, faceit_banned, private_inventory, faceit_verified.
    Returns {score, tier, breakdown[], flags[]}.
    """
    pillars = [
        ("Account age", _pillar_age(signals.get("account_age_days"))),
        ("CS2 hours", _pillar_hours(signals.get("hours_cs2"))),
        ("Steam level", _pillar_level(signals.get("steam_level"))),
        ("Inventory", _pillar_inventory(signals.get("inventory_items"))),
        ("FACEIT activity", _pillar_matches(signals.get("faceit_matches"))),
    ]
    available = [(label, p) for label, p in pillars if p is not None]

    breakdown = []
    got = maxp = 0.0
    for label, (pts, mx) in available:
        got += pts
        maxp += mx
        breakdown.append({"label": label, "score": pts, "max": mx})

    # Normalize to 0-100 over the pillars we actually had data for.
    score = round(got / maxp * 100) if maxp else 50

    # Bonus: FACEIT-verified accounts are a small positive signal.
    bonus = 0
    if signals.get("faceit_verified"):
        bonus = 3
        score = min(100, score + bonus)

    # Hard penalties (these dominate — a banned account is not "trusted").
    vac = bool(signals.get("vac_banned"))
    fban = bool(signals.get("faceit_banned"))
    if vac:
        score = min(score, 15)
    if fban:
        score = min(score, 25)
    fresh = (signals.get("account_age_days") or 9999) < 30

    flags = [
        {"label": "VAC ban", "ok": not vac,
         "detail": "None" if not vac else f"{signals.get('vac_count') or 1} ban(s)"},
        {"label": "FACEIT ban", "ok": not fban, "detail": "None" if not fban else "Active/past"},
        {"label": "Fresh account", "ok": not fresh,
         "detail": "No" if not fresh else "< 30 days"},
        {"label": "Inventory", "ok": not signals.get("private_inventory"),
         "detail": "Private" if signals.get("private_inventory") else
                   f"{signals.get('inventory_items') or 0} items"},
    ]

    return {
        "score": score,
        "tier": _tier(score),
        "bonus": bonus,
        "breakdown": breakdown,
        "flags": flags,
        # so the UI can be honest about what powered the score
        "based_on_demos": False,
    }


def build_trust(summary: dict, steam_level, inventory: dict) -> dict:
    """Extract trust signals from a player summary + Steam data, then score."""
    steam = summary.get("steam") or {}
    created = steam.get("created")  # epoch seconds (needs STEAM_API_KEY)
    age_days = None
    if created:
        age_days = int((time.time() - created) / 86400)

    bans = summary.get("bans") or []
    inv = inventory or {}
    inv_items = (inv.get("counts") or {}).get("total") if inv.get("available") else 0

    try:
        matches = int((summary.get("stats") or {}).get("matches"))
    except (TypeError, ValueError):
        matches = None

    signals = {
        "account_age_days": age_days,
        "hours_cs2": steam.get("hours_cs2"),
        "steam_level": steam_level,
        "inventory_items": inv_items,
        "faceit_matches": matches,
        "vac_banned": steam.get("vac_banned"),
        "vac_count": steam.get("vac_count"),
        "faceit_banned": len(bans) > 0,
        "private_inventory": inv.get("private", False),
        "faceit_verified": summary.get("verified", False),
    }
    return compute_trust(signals)
