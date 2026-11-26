from __future__ import annotations

import os

from django.core.cache import cache
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from . import demo_coach, demo_queue, demo_stats, faceit
from .models import ParsedMatch
from .profiles import _client_ip

DEMO_PARSE_RATE_LIMIT = int(os.environ.get("DEMO_PARSE_RATE_LIMIT", "10"))
DEMO_PARSE_RATE_WINDOW = 60 * 60


def _over_parse_limit(request):
    key = f"rl:demoparse:{_client_ip(request)}"
    try:
        used = cache.incr(key)
    except ValueError:
        cache.set(key, 1, DEMO_PARSE_RATE_WINDOW)
        used = 1
    if used > DEMO_PARSE_RATE_LIMIT:
        return JsonResponse(
            {"error": "Too many demo parse requests from this address. Try again later."},
            status=429,
            headers={"Retry-After": str(DEMO_PARSE_RATE_WINDOW)},
        )
    return None


def _match_state(match_id):
    match = ParsedMatch.objects.filter(match_id=match_id).first()
    if match:
        return {"match_id": match_id, "status": "done", "match": demo_stats.match_payload(match)}
    body = demo_queue.request_payload(demo_queue.latest_request(match_id))
    body["match_id"] = match_id
    body["match"] = None
    return body


@csrf_exempt
@require_POST
def match_parse(request, match_id):
    if not demo_queue.valid_match_id(match_id):
        return JsonResponse({"error": "Invalid match id."}, status=400)
    if ParsedMatch.objects.filter(match_id=match_id).exists():
        return JsonResponse(_match_state(match_id))
    existing = demo_queue.latest_request(match_id)
    if existing and existing.status in demo_queue.ACTIVE_STATUSES:
        return JsonResponse(_match_state(match_id))
    if existing and existing.status == "failed" and existing.attempts >= demo_queue.MAX_ATTEMPTS:
        return JsonResponse(_match_state(match_id))
    if demo_queue.queue_full():
        return JsonResponse(
            {"error": "The demo queue is full right now. Try again later."}, status=503
        )
    limited = _over_parse_limit(request)
    if limited:
        return limited
    demo_queue.enqueue(match_id, _client_ip(request), getattr(request, "user", None))
    return JsonResponse(_match_state(match_id), status=202)


@require_GET
def match_demo(request, match_id):
    if not demo_queue.valid_match_id(match_id):
        return JsonResponse({"error": "Invalid match id."}, status=400)
    return JsonResponse(_match_state(match_id))


def _player(nickname):
    from . import privacy
    try:
        player = faceit.get_player_by_nickname(nickname)
    except faceit.FaceitNotFound:
        return None, JsonResponse({"error": "No FACEIT player with that nickname."}, status=404)
    except faceit.FaceitError as exc:
        return None, JsonResponse({"error": str(exc)}, status=502)
    cs2 = (player.get("games") or {}).get(faceit.GAME) or {}
    steamid = cs2.get("game_player_id")
    if privacy.is_suppressed(player.get("player_id"), steamid, player.get("nickname")):
        return None, JsonResponse({"error": privacy.UNAVAILABLE}, status=404)
    return {"nickname": player.get("nickname"), "steamid": steamid, "level": cs2.get("skill_level")}, None


@require_GET
def player_coach(request, nickname):
    info, err = _player(nickname)
    if err:
        return err
    if not info["steamid"]:
        return JsonResponse({"available": False, "nickname": info["nickname"], "reason": "no steam id"})
    try:
        matches = int(request.GET.get("matches", demo_coach.COACH_DEFAULT_MATCHES))
    except (TypeError, ValueError):
        matches = demo_coach.COACH_DEFAULT_MATCHES
    report = demo_coach.build_report(info["steamid"], info["level"], matches)
    report["nickname"] = info["nickname"]
    if report.get("available") and request.GET.get("ai") == "1":
        cached = demo_coach.cached_ai_summary(info["steamid"], report)
        if cached is not None:
            report["ai_summary"] = cached
        else:
            from .views import _over_ai_rate_limit
            limited = _over_ai_rate_limit(request)
            if not limited:
                report["ai_summary"] = demo_coach.ai_summary(info["steamid"], report)
    return JsonResponse(report)
