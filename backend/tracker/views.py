from django.http import JsonResponse
from django.views.decorators.http import require_GET

from . import faceit


@require_GET
def player_summary(request, nickname):
    """GET /api/player/<nickname>/ - profile + stats + matches + maps + bans."""
    try:
        data = faceit.build_player_summary(nickname)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)
    return JsonResponse(data)


@require_GET
def match_detail(request, match_id):
    """GET /api/match/<match_id>/ - simplified scoreboard for one match."""
    try:
        data = faceit.get_match_detail(match_id)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)
    return JsonResponse(data)


@require_GET
def squad_stats(request):
    """GET /api/squad/?players=a,b,c - leaderboard + matches played together."""
    raw = request.GET.get("players", "")
    nicknames = [n.strip() for n in raw.split(",") if n.strip()]
    if len(nicknames) < 2:
        return JsonResponse({"error": "Provide at least 2 players."}, status=400)
    try:
        data = faceit.build_squad_stats(nicknames)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)
    return JsonResponse(data)
