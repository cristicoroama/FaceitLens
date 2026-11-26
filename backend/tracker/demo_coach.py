from __future__ import annotations

import hashlib
import json
import logging

from django.core.cache import cache

from .demo_stats import totals
from .models import DemoPlayerStat

log = logging.getLogger(__name__)

COACH_DEFAULT_MATCHES = 20
COACH_MAX_MATCHES = 50
COACH_FOCUS_COUNT = 3
COACH_AI_TTL = 12 * 60 * 60
COACH_AI_MAX_TOKENS = 300

LEVEL_BANDS = (
    ("low", 1, 4),
    ("mid", 5, 7),
    ("high", 8, 10),
)
DEFAULT_BAND = "mid"

BASELINES = {
    "low": {
        "untraded_deaths": 0.82,
        "failed_entries": 0.52,
        "low_kast_rounds": 0.34,
        "flash_efficiency": 0.60,
        "unused_utility": 260,
        "eco_discipline": 0.25,
    },
    "mid": {
        "untraded_deaths": 0.78,
        "failed_entries": 0.50,
        "low_kast_rounds": 0.30,
        "flash_efficiency": 0.80,
        "unused_utility": 200,
        "eco_discipline": 0.15,
    },
    "high": {
        "untraded_deaths": 0.74,
        "failed_entries": 0.48,
        "low_kast_rounds": 0.27,
        "flash_efficiency": 1.00,
        "unused_utility": 150,
        "eco_discipline": 0.10,
    },
}

MIN_DEATHS = 25
MIN_OPENING_DUELS = 8
MIN_ROUNDS = 80
MIN_FLASHES = 12
MIN_ECO_ROUNDS = 6

AREAS = {
    "untraded_deaths": {
        "title": "Untraded deaths",
        "unit": "%",
        "higher_is_worse": True,
        "tip": "Play closer to a teammate who can refrag: stay within trade distance and avoid peeking alone without a follow-up.",
    },
    "failed_entries": {
        "title": "Failed entries",
        "unit": "%",
        "higher_is_worse": True,
        "tip": "Lose fewer opening duels: take first contact with a flash or a teammate, and avoid dry wide peeks early in the round.",
    },
    "low_kast_rounds": {
        "title": "Low-impact rounds",
        "unit": "%",
        "higher_is_worse": True,
        "tip": "Rounds with no kill, assist, survival or trade cost the team most. Prioritise staying alive and contributing damage or utility every round.",
    },
    "flash_efficiency": {
        "title": "Flash efficiency",
        "unit": "x",
        "higher_is_worse": False,
        "tip": "Learn two or three pop-flashes per map and throw them for a teammate's peek instead of flashing blind.",
    },
    "unused_utility": {
        "title": "Utility unused on death",
        "unit": "$",
        "higher_is_worse": True,
        "tip": "Use grenades before you take a fight. Utility in your pocket when you die is money the team never gets back.",
    },
    "eco_discipline": {
        "title": "Eco discipline",
        "unit": "%",
        "higher_is_worse": True,
        "tip": "Buy with your team. Buying a rifle while the team saves breaks the next round's economy for everyone.",
    },
}


def level_band(level) -> str:
    try:
        lvl = int(level)
    except (TypeError, ValueError):
        return DEFAULT_BAND
    for name, low, high in LEVEL_BANDS:
        if low <= lvl <= high:
            return name
    return DEFAULT_BAND


def _metrics(t: dict) -> dict:
    out = {}
    deaths = t["deaths"]
    if deaths >= MIN_DEATHS:
        out["untraded_deaths"] = {
            "value": (deaths - t["traded_deaths"]) / deaths,
            "evidence": f"{deaths - t['traded_deaths']} of {deaths} deaths were not traded",
        }
        out["unused_utility"] = {
            "value": t["unused_utility_value"] / deaths,
            "evidence": (
                f"died holding utility {t['deaths_with_utility']} times, "
                f"${t['unused_utility_value']} of grenades unused across {deaths} deaths"
            ),
        }
    opens = t["opening_kills"] + t["opening_deaths"]
    if opens >= MIN_OPENING_DUELS:
        out["failed_entries"] = {
            "value": t["opening_deaths"] / opens,
            "evidence": f"lost {t['opening_deaths']} of {opens} opening duels",
        }
    rounds = t["rounds"]
    if rounds >= MIN_ROUNDS:
        out["low_kast_rounds"] = {
            "value": (rounds - t["kast_rounds"]) / rounds,
            "evidence": f"{rounds - t['kast_rounds']} of {rounds} rounds without a kill, assist, survival or trade",
        }
    flashes = t["flashes_thrown"]
    if flashes >= MIN_FLASHES:
        out["flash_efficiency"] = {
            "value": t["enemies_flashed"] / flashes,
            "evidence": (
                f"{t['enemies_flashed']} enemies and {t['teammates_flashed']} teammates "
                f"blinded from {flashes} flashes"
            ),
        }
    eco = t["eco_rounds"]
    if eco >= MIN_ECO_ROUNDS:
        out["eco_discipline"] = {
            "value": t["broken_eco_rounds"] / eco,
            "evidence": f"bought big in {t['broken_eco_rounds']} of {eco} team eco rounds",
        }
    return out


def _display(key, value):
    unit = AREAS[key]["unit"]
    if unit == "%":
        return round(value * 100, 1)
    if unit == "$":
        return round(value)
    return round(value, 2)


def focus_areas(t: dict, band: str) -> list[dict]:
    base = BASELINES.get(band, BASELINES[DEFAULT_BAND])
    scored = []
    for key, m in _metrics(t).items():
        spec = AREAS[key]
        b = base[key]
        gap = (m["value"] - b) / b if spec["higher_is_worse"] else (b - m["value"]) / b
        scored.append({
            "key": key,
            "title": spec["title"],
            "unit": spec["unit"],
            "value": _display(key, m["value"]),
            "baseline": _display(key, b),
            "severity": round(gap, 3),
            "status": "focus" if gap > 0 else "on_track",
            "evidence": m["evidence"],
            "tip": spec["tip"],
        })
    scored.sort(key=lambda a: a["severity"], reverse=True)
    return scored[:COACH_FOCUS_COUNT]


def _summary(areas: list[dict]) -> str:
    focus = [a for a in areas if a["status"] == "focus"]
    if not areas:
        return "Not enough parsed rounds yet to coach on. Parse a few more matches."
    if not focus:
        return "Every tracked area is at or better than the baseline for your level. Keep it up."
    parts = [f"{a['title'].lower()} ({a['evidence']})" for a in focus]
    return "Biggest gains for your level: " + "; ".join(parts) + "."


def recent_rows(steamid: str, limit: int):
    from .demo_stats import player_matches
    ids = [m["match_id"] for m in player_matches(steamid, limit)]
    return DemoPlayerStat.objects.filter(steamid=str(steamid), match__match_id__in=ids), len(ids)


def build_report(steamid: str, level=None, matches: int = COACH_DEFAULT_MATCHES) -> dict:
    matches = max(1, min(int(matches or COACH_DEFAULT_MATCHES), COACH_MAX_MATCHES))
    qs, count = recent_rows(steamid, matches)
    if not count:
        return {"available": False, "reason": "no parsed matches"}
    t = totals(qs)
    band = level_band(level)
    areas = focus_areas(t, band)
    return {
        "available": True,
        "matches": count,
        "rounds": t["rounds"],
        "level": level,
        "band": band,
        "baselines": BASELINES[band],
        "focus_areas": areas,
        "summary": _summary(areas),
        "ai_summary": None,
    }


def cached_ai_summary(steamid: str, report: dict):
    return cache.get(_ai_key(steamid, report))


def _ai_key(steamid, report):
    digest = hashlib.sha1(
        json.dumps(report.get("focus_areas"), sort_keys=True).encode()
    ).hexdigest()[:16]
    return f"coach:{steamid}:{digest}"


def ai_summary(steamid: str, report: dict):
    from . import ai
    from .guardrails import validate_analysis, wrap_untrusted

    if not ai.ANTHROPIC_API_KEY or not report.get("focus_areas"):
        return None
    key = _ai_key(steamid, report)
    hit = cache.get(key)
    if hit is not None:
        return hit
    block, _ = wrap_untrusted({
        "band": report.get("band"),
        "matches": report.get("matches"),
        "focus_areas": [
            {k: a[k] for k in ("title", "value", "baseline", "unit", "evidence")}
            for a in report["focus_areas"]
        ],
    })
    prompt = (
        "You are a Counter-Strike 2 coach. Using ONLY the focus areas below, write "
        "at most 6 short plain-text lines: one concrete practice suggestion per focus "
        "area that references its numbers, then a one-line priority. No markdown, no "
        "preamble, no questions.\n\n" + block
    )
    try:
        text = validate_analysis(ai._call_ai(prompt, COACH_AI_MAX_TOKENS))
    except Exception as exc:
        log.warning("coach ai summary failed: %s", exc)
        return None
    cache.set(key, text, COACH_AI_TTL)
    return text
