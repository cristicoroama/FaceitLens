"""
Stream overlay: the data behind a streamer's OBS browser source.

Design note worth keeping: there is no background worker. The overlay page
polls this endpoint, and this endpoint asks FACEIT only when someone actually
polls — so a streamer who isn't live costs nothing, and Render's free tier
spinning down between streams doesn't matter. A short cache means ten viewers
opening the same overlay still only produces one FACEIT call.

Access is by token, not by login: OBS is a browser with no session, so the
secret in the URL is what keeps a streamer's live ELO from being readable by
anyone who guesses their handle.

Endpoints:
  GET  /api/overlay/<token>/            the live state (public, token-gated)
  GET  /api/overlay/settings/           my overlay config      (signed in)
  POST /api/overlay/settings/           update it              (signed in)
  POST /api/overlay/session/            start or reset the session counter
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone as dt_timezone

from django.core.cache import cache
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from .models import StreamOverlay, UserProfile

# One FACEIT round-trip per this many seconds, however many people are watching.
LIVE_TTL = 20


def _get_overlay(profile: UserProfile) -> StreamOverlay:
    ov = getattr(profile, "overlay", None)
    if ov is None:
        ov = StreamOverlay.objects.create(
            profile=profile, token=StreamOverlay.new_token()
        )
    return ov


def _settings_payload(ov: StreamOverlay) -> dict:
    return {
        "token": ov.token,
        "url": f"/overlay/{ov.token}",
        "show_elo": ov.show_elo,
        "show_session": ov.show_session,
        "show_match": ov.show_match,
        "show_brand": ov.show_brand,
        "session_started": ov.session_started.isoformat() if ov.session_started else None,
        "session_start_elo": ov.session_start_elo,
        "last_seen": ov.last_seen.isoformat() if ov.last_seen else None,
    }


def _live_state(ov: StreamOverlay) -> dict:
    """Everything the overlay draws, in one shape."""
    profile = ov.profile
    player_id = profile.faceit_player_id
    if not player_id:
        return {"ok": False, "reason": "no_faceit"}

    key = f"overlay:{player_id}"
    hit = cache.get(key)
    if hit is not None:
        return hit

    from . import faceit

    try:
        player = faceit._get(f"/players/{player_id}") or {}
    except Exception:
        # Never let a FACEIT hiccup blank someone's stream — the overlay keeps
        # drawing whatever it last had.
        return {"ok": False, "reason": "faceit_unavailable"}

    cs2 = (player.get("games") or {}).get(faceit.GAME) or {}
    elo = cs2.get("faceit_elo")
    level = cs2.get("skill_level")

    # Session counters. The window starts when the streamer presses start; if
    # they never do, it falls back to today, which is what most people mean.
    since = ov.session_started or timezone.now().replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    wins = losses = 0
    try:
        for m in faceit.get_match_stats(player_id, limit=30):
            stats = m.get("stats") or {}
            ts = m.get("stats", {}).get("Match Finished At") or m.get("started_at")
            when = None
            if ts:
                try:
                    when = datetime.fromtimestamp(
                        int(ts) / (1000 if int(ts) > 10**11 else 1),
                        tz=dt_timezone.utc,
                    )
                except (TypeError, ValueError):
                    when = None
            if when and when < since:
                break
            result = stats.get("Result")
            if result == "1":
                wins += 1
            elif result == "0":
                losses += 1
    except Exception:
        pass

    # The match in progress, if any.
    match = None
    try:
        for m in faceit.get_player_history(player_id, limit=3):
            if (m.get("status") or "").upper() in ("ONGOING", "READY", "MANUAL_RESULT"):
                teams = m.get("teams") or {}
                match = {
                    "id": m.get("match_id"),
                    "map": (m.get("voting") or {}).get("map", {}).get("pick", [None])[0],
                    "competition": m.get("competition_name"),
                    "teams": [t.get("nickname") for t in teams.values() if t],
                }
                break
    except Exception:
        pass

    elo_delta = None
    if elo is not None and ov.session_start_elo is not None:
        elo_delta = elo - ov.session_start_elo

    state = {
        "ok": True,
        "nickname": profile.faceit_nickname,
        "avatar": player.get("avatar") or None,
        "country": player.get("country") or None,
        "elo": elo,
        "level": level,
        "session": {"wins": wins, "losses": losses, "elo_delta": elo_delta},
        "match": match,
        "show": {
            "elo": ov.show_elo,
            "session": ov.show_session,
            "match": ov.show_match,
            "brand": ov.show_brand,
        },
    }
    cache.set(key, state, LIVE_TTL)
    return state


def overlay_state(request, token):
    """Public, token-gated. This is what OBS polls."""
    ov = (
        StreamOverlay.objects.filter(token=token)
        .select_related("profile")
        .first()
    )
    if ov is None:
        return JsonResponse({"ok": False, "reason": "not_found"}, status=404)

    state = _live_state(ov)

    # If the session was never started, anchor it on the first poll so the ELO
    # delta has something to count from instead of showing nothing all stream.
    if state.get("ok") and ov.session_start_elo is None and state.get("elo") is not None:
        ov.session_started = timezone.now()
        ov.session_start_elo = state["elo"]
        state["session"]["elo_delta"] = 0

    # Cheap liveness signal — written at most once a minute, not on every poll.
    now = timezone.now()
    if ov.last_seen is None or (now - ov.last_seen) > timedelta(minutes=1):
        ov.last_seen = now
        ov.save(update_fields=["session_started", "session_start_elo", "last_seen"])
    elif ov.session_start_elo is not None and ov.session_started is not None:
        StreamOverlay.objects.filter(pk=ov.pk).update(
            session_started=ov.session_started, session_start_elo=ov.session_start_elo
        )

    return JsonResponse(state)


@csrf_exempt
def overlay_settings(request):
    """GET my overlay config, or POST changes to it."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Not signed in."}, status=401)

    profile = UserProfile.objects.filter(user=request.user).first()
    if profile is None:
        return JsonResponse({"error": "No profile yet."}, status=404)
    if not profile.faceit_player_id:
        return JsonResponse({"error": "no_faceit"}, status=400)

    ov = _get_overlay(profile)

    if request.method == "GET":
        return JsonResponse({"overlay": _settings_payload(ov)})

    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)

    try:
        body = json.loads(request.body or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        body = {}

    for field in ("show_elo", "show_session", "show_match", "show_brand"):
        if field in body:
            setattr(ov, field, bool(body[field]))

    # Regenerating is how a streamer revokes a link they leaked on stream.
    if body.get("regenerate"):
        ov.token = StreamOverlay.new_token()

    ov.save()
    return JsonResponse({"overlay": _settings_payload(ov), "ok": True})


@csrf_exempt
def overlay_session(request):
    """Reset the session counters to right now."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Not signed in."}, status=401)
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)

    profile = UserProfile.objects.filter(user=request.user).first()
    if profile is None or not profile.faceit_player_id:
        return JsonResponse({"error": "no_faceit"}, status=400)

    ov = _get_overlay(profile)

    elo = None
    try:
        from . import faceit
        player = faceit._get(f"/players/{profile.faceit_player_id}") or {}
        elo = ((player.get("games") or {}).get(faceit.GAME) or {}).get("faceit_elo")
    except Exception:
        pass

    ov.session_started = timezone.now()
    ov.session_start_elo = elo
    ov.save(update_fields=["session_started", "session_start_elo"])

    # Drop the cached state so the overlay reflects the reset on its next poll
    # rather than up to LIVE_TTL seconds later.
    cache.delete(f"overlay:{profile.faceit_player_id}")

    return JsonResponse({"overlay": _settings_payload(ov), "ok": True})
