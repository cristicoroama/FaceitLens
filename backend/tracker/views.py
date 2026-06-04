from django.http import JsonResponse
from django.views.decorators.http import require_GET

from . import faceit
from . import ai


@require_GET
def player_summary(request, nickname):
    """GET /api/player/<nickname>/ - full profile. Optional ?map=de_mirage filters averages."""
    try:
        data = faceit.build_player_summary(nickname)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)

    # Optional map filter recomputes the recent averages from match items.
    map_filter = request.GET.get("map")
    if map_filter and data.get("player_id"):
        try:
            items = faceit.get_match_stats(data["player_id"], limit=50)
            data["recent_avg"] = faceit.build_recent_averages(items, n=30, map_filter=map_filter)
        except faceit.FaceitError:
            pass
    return JsonResponse(data)


@require_GET
def player_by_steam(request):
    """GET /api/steam/?id=<steamid64 or steam profile url> - resolve FACEIT player."""
    steam_input = request.GET.get("id", "")
    try:
        player = faceit.get_player_by_steam(steam_input)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)
    return JsonResponse({"nickname": player.get("nickname")})


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


@require_GET
def search(request):
    """GET /api/search/?q=... - nickname autocomplete suggestions."""
    q = request.GET.get("q", "").strip()
    return JsonResponse({"items": faceit.search_players(q)})


@require_GET
def recent(request):
    """GET /api/recent/ - most recently searched players."""
    try:
        from .models import TrackedPlayer
        qs = TrackedPlayer.objects.exclude(last_searched=None).order_by("-last_searched")[:8]
        items = [{"nickname": p.nickname} for p in qs]
    except Exception:
        items = []
    return JsonResponse({"items": items})


@require_GET
def leaderboard(request):
    """GET /api/leaderboard/?region=EU&country=ro - top players."""
    region = request.GET.get("region", "EU")
    country = request.GET.get("country") or None
    try:
        items = faceit.get_leaderboard(region, country=country)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)
    return JsonResponse({"items": items})


@require_GET
def analyze(request, nickname):
    """GET /api/analyze/<nickname>/ - short AI scouting report (cached 12h)."""
    try:
        summary = faceit.build_player_summary(nickname)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)
    try:
        text = ai.analyze_player(summary)
    except ai.AIError as exc:
        return JsonResponse({"error": str(exc)}, status=503)
    return JsonResponse({"analysis": text})
