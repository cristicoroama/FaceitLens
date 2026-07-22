"""
Short one-shot AI scouting report for a player, via the Anthropic API.
The API key lives here on the backend (never the frontend) so costs and the
key stay under our control. Results are cached per player to avoid re-billing
for repeat views.
"""
import os
import json
import requests
from django.core.cache import cache

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANALYSIS_TTL = 12 * 60 * 60  # cache an analysis 12h


class AIError(Exception):
    pass


def _compact_stats(summary):
    """Pull just the numbers worth feeding the model."""
    s = summary.get("stats", {}) or {}
    ra = summary.get("recent_avg", {}) or {}
    hltv = summary.get("hltv", {}) or {}
    maps = summary.get("map_stats", []) or []
    sess = summary.get("last_session", {}) or {}
    return {
        "nickname": summary.get("nickname"),
        "elo": summary.get("elo"),
        "level": summary.get("skill_level"),
        "region": summary.get("region"),
        "global_rank": summary.get("ranking"),
        "lifetime": {
            "matches": s.get("matches"),
            "win_rate": s.get("win_rate"),
            "avg_kd": s.get("avg_kd"),
            "avg_hs": s.get("avg_hs"),
            "longest_win_streak": s.get("longest_win_streak"),
        },
        "last30": ra,
        "rating_approx": hltv.get("rating"),
        "kpr": hltv.get("kpr"),
        "dpr": hltv.get("dpr"),
        "kast_approx": hltv.get("kast"),
        "recent_form_last10": summary.get("form"),
        "kd_trend": summary.get("kd_trend"),
        "current_session": {
            "wins": sess.get("wins"),
            "losses": sess.get("losses"),
            "tilt": sess.get("tilt"),
        },
        "maps": [
            {"map": m.get("map"), "win_rate": m.get("win_rate"), "matches": m.get("matches")}
            for m in maps[:7]
        ],
        "banned": bool(summary.get("bans")),
    }


def analyze_player(summary):
    """Return a short (~15 line) scouting report. Cached per player_id 12h."""
    if not ANTHROPIC_API_KEY:
        raise AIError("AI analysis is not configured (missing ANTHROPIC_API_KEY).")

    player_id = summary.get("player_id")
    cache_key = f"ai:{player_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    stats = _compact_stats(summary)
    prompt = (
        "You are a sharp Counter-Strike 2 analyst. Based ONLY on the FACEIT stats "
        "below, write a concise scouting report about this player. Rules:\n"
        "- At most 15 short lines, one idea per line.\n"
        "- Cover: overall skill tier, clear strengths, clear weaknesses, recent form "
        "and whether they're tilting, best and worst maps, and end with a one-line verdict.\n"
        "- Be specific and reference the actual numbers.\n"
        "- Plain text only: no markdown, no headers, no bullet symbols, no preamble.\n"
        "- Do not invite conversation or ask questions. Just the report.\n\n"
        f"STATS:\n{json.dumps(stats, ensure_ascii=False)}"
    )

    try:
        resp = requests.post(
            ANTHROPIC_URL,
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": ANTHROPIC_MODEL,
                "max_tokens": 500,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=40,
        )
    except requests.RequestException as exc:
        raise AIError(f"Could not reach the AI service: {exc}")

    if resp.status_code != 200:
        raise AIError(f"AI service error {resp.status_code}: {resp.text[:200]}")

    data = resp.json()
    text = "".join(
        block.get("text", "")
        for block in data.get("content", [])
        if block.get("type") == "text"
    ).strip()

    if not text:
        raise AIError("AI service returned an empty response.")

    cache.set(cache_key, text, ANALYSIS_TTL)
    return text


def _call_ai(prompt, max_tokens=350):
    """Thin wrapper around the Anthropic messages endpoint."""
    try:
        resp = requests.post(
            ANTHROPIC_URL,
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": ANTHROPIC_MODEL,
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=40,
        )
    except requests.RequestException as exc:
        raise AIError(f"Could not reach the AI service: {exc}")
    if resp.status_code != 200:
        raise AIError(f"AI service error {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    text = "".join(
        block.get("text", "")
        for block in data.get("content", [])
        if block.get("type") == "text"
    ).strip()
    if not text:
        raise AIError("AI service returned an empty response.")
    return text


def roast_player(summary):
    """A short, funny (PG-13) roast of the player based on their stats.
    Cached per player 12h. Designed to be screenshot-and-share bait."""
    if not ANTHROPIC_API_KEY:
        raise AIError("AI roast is not configured (missing ANTHROPIC_API_KEY).")

    player_id = summary.get("player_id")
    cache_key = f"roast:{player_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    stats = _compact_stats(summary)
    prompt = (
        "You are a savage but good-natured Counter-Strike 2 comedian. Roast this "
        "player based ONLY on the FACEIT stats below. Rules:\n"
        "- 4 to 6 short punchy lines, each a separate joke about their numbers.\n"
        "- Be witty and playful, like trash-talk between friends — never cruel, "
        "no slurs, nothing about real identity, appearance, race, gender or health.\n"
        "- Reference the ACTUAL numbers (ELO, K/D, HS%, win rate, worst map, tilt, "
        "streaks) so it feels personal.\n"
        "- If the stats are genuinely good, roast them for being a tryhard / no life instead.\n"
        "- End with one backhanded compliment.\n"
        "- Plain text only: no markdown, no bullet symbols, no preamble, no questions.\n\n"
        f"STATS:\n{json.dumps(stats, ensure_ascii=False)}"
    )
    text = _call_ai(prompt, max_tokens=350)
    cache.set(cache_key, text, ANALYSIS_TTL)
    return text
