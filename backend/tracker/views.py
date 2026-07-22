from django.http import JsonResponse
import json
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt

from . import faceit
from . import ai


@require_GET
def player_summary(request, nickname):
    """GET /api/player/<nickname>/ - full profile. Optional ?map=de_mirage filters averages."""
    try:
        data = faceit.build_player_summary(nickname)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JsonResponse({"error": f"Internal: {type(exc).__name__}: {exc}"}, status=500)

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
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JsonResponse({"error": f"Internal: {type(exc).__name__}: {exc}"}, status=500)
    return JsonResponse(data)


@require_GET
def clubs_search(request):
    """GET /api/clubs/?q=name - search FACEIT clubs by name."""
    q = (request.GET.get("q") or "").strip()
    if not q:
        return JsonResponse({"items": []})
    try:
        items = faceit.search_clubs(q)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JsonResponse({"error": f"Internal: {type(exc).__name__}: {exc}"}, status=500)
    return JsonResponse({"items": items})


@require_GET
def club_detail(request, club_id):
    """GET /api/club/<club_id>/ - one club's profile + members."""
    try:
        data = faceit.get_club(club_id)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JsonResponse({"error": f"Internal: {type(exc).__name__}: {exc}"}, status=500)
    return JsonResponse(data)


@require_GET
def match_room(request):
    """GET /api/matchroom/?url=<faceit room link> - scout both teams + prediction."""
    raw = request.GET.get("url") or request.GET.get("id") or ""
    if not raw.strip():
        return JsonResponse({"error": "Paste a FACEIT match room link."}, status=400)
    try:
        data = faceit.get_match_room(raw)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JsonResponse({"error": f"Internal: {type(exc).__name__}: {exc}"}, status=500)
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
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JsonResponse({"error": f"Internal: {type(exc).__name__}: {exc}"}, status=500)
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
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JsonResponse({"error": f"Internal: {type(exc).__name__}: {exc}"}, status=500)
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


@require_GET
def roast(request, nickname):
    """GET /api/roast/<nickname>/ - a short, funny AI roast (cached 12h)."""
    try:
        summary = faceit.build_player_summary(nickname)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)
    try:
        text = ai.roast_player(summary)
    except ai.AIError as exc:
        return JsonResponse({"error": str(exc)}, status=503)
    return JsonResponse({"roast": text})


@require_GET
def collectibles(request, nickname):
    """
    GET /api/player/<nickname>/collectibles/ - Account Trust Score + Steam level
    + CS2 inventory showcase (skins, knife/gloves, medals & coins). Public Steam
    data + non-demo trust signals; no demo worker needed.
    """
    try:
        # build_player_summary is cached and usually already warm from the main
        # page load, so this reuses it rather than re-hitting the FACEIT API.
        summary = faceit.build_player_summary(nickname)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JsonResponse({"error": f"Internal: {type(exc).__name__}: {exc}"}, status=500)

    steamid = summary.get("steam_id") or None
    # summary doesn't expose steam_id directly; re-derive from the player object.
    if not steamid:
        try:
            player = faceit.get_player_by_nickname(nickname)
            steamid = player.get("games", {}).get("cs2", {}).get("game_player_id")
        except faceit.FaceitError:
            steamid = None
    if not steamid:
        return JsonResponse({"available": False, "reason": "no steam id"})

    force = request.GET.get("refresh") in ("1", "true", "yes")
    try:
        from . import steam, trust
        level = steam.get_steam_level(steamid, force=force)
        inventory = steam.get_inventory(steamid, force=force)
        trust_score = trust.build_trust(summary, level, inventory)
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JsonResponse({"error": f"Internal: {type(exc).__name__}: {exc}"}, status=500)

    return JsonResponse({
        "nickname": summary.get("nickname"),
        "steamid": steamid,
        "steam_level": level,
        "inventory": inventory,
        "trust": trust_score,
    })


@require_GET
def steam_profile(request):
    """
    GET /api/steamprofile/?id=<steamid64 | profile url | vanity> — Steam-first
    profile for players with or WITHOUT a FACEIT account: Steam summary, Trust
    Score, inventory/medals, Leetify (incl. current Premier rating), plus the
    linked FACEIT nickname when one exists.
    """
    raw = request.GET.get("id", "").strip()
    if not raw:
        return JsonResponse({"error": "Provide ?id=<steamid64 / profile url / vanity>."}, status=400)

    from . import steam, trust as trust_mod, leetify
    steamid = steam.resolve_steamid(raw)
    if not steamid:
        return JsonResponse({
            "error": "Couldn't resolve a SteamID64. Paste a 17-digit ID or a "
                     "steamcommunity.com link (vanity names need STEAM_API_KEY set)."
        }, status=404)

    try:
        info = faceit.get_steam_info(steamid) or {}
        level = steam.get_steam_level(steamid)
        inventory = steam.get_inventory(steamid)
        leet = leetify.get_profile(steamid)
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JsonResponse({"error": f"Internal: {type(exc).__name__}: {exc}"}, status=500)

    # Linked FACEIT account (optional — this page must work without one).
    faceit_nick = None
    try:
        player = faceit.get_player_by_steam(steamid)
        faceit_nick = player.get("nickname")
    except Exception:
        pass

    import time as _t
    created = info.get("created")
    signals = {
        "account_age_days": int((_t.time() - created) / 86400) if created else None,
        "hours_cs2": info.get("hours_cs2"),
        "steam_level": level,
        "inventory_items": (
            (inventory.get("counts") or {}).get("total") if inventory.get("available")
            else (0 if inventory.get("private") else None)
        ),
        "faceit_matches": None,  # unknown here; pillar renormalizes away
        "vac_banned": info.get("vac_banned"),
        "vac_count": info.get("vac_count"),
        "faceit_banned": False,
        "private_inventory": inventory.get("private", False),
        "faceit_verified": False,
    }

    return JsonResponse({
        "steamid": steamid,
        "persona": info.get("persona"),
        "avatar": info.get("avatar"),
        "country": info.get("country"),
        "created": created,
        "hours_cs2": info.get("hours_cs2"),
        "vac_banned": info.get("vac_banned"),
        "profile_url": info.get("profile_url") or f"https://steamcommunity.com/profiles/{steamid}/",
        "steam_level": level,
        "inventory": inventory,
        "leetify": leet,
        "trust": trust_mod.compute_trust(signals),
        "faceit_nickname": faceit_nick,
    })


@require_GET
def leetify_stats(request, nickname):
    """
    GET /api/player/<nickname>/leetify/ - demo-based stats via the Leetify public
    API (ranks incl. Premier, aim/positioning/utility ratings, aim & utility
    stats). Returns {available: false, reason: 'not_on_leetify'} for players
    Leetify has no data on. Data is proxied live, never stored (Leetify rule).
    """
    try:
        summary = faceit.build_player_summary(nickname)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JsonResponse({"error": f"Internal: {type(exc).__name__}: {exc}"}, status=500)

    steamid = summary.get("steam_id")
    if not steamid:
        return JsonResponse({"available": False, "reason": "no steam id"})

    try:
        from . import leetify
        data = leetify.get_profile(steamid)
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JsonResponse({"error": f"Internal: {type(exc).__name__}: {exc}"}, status=500)
    data["nickname"] = summary.get("nickname")
    return JsonResponse(data)


@require_GET
def real_stats(request, nickname):
    """
    GET /api/player/<nickname>/real/ - REAL demo-parsed stats (HLTV 2.0, KAST,
    opening duels, clutches, trades, utility). Returns {available: false} when
    none of this player's demos have been parsed yet.
    """
    try:
        player = faceit.get_player_by_nickname(nickname)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)

    steamid = player.get("games", {}).get("cs2", {}).get("game_player_id")
    if not steamid:
        return JsonResponse({"available": False, "reason": "no steam id"})

    try:
        from .demo_stats import aggregate
        data = aggregate(steamid)
    except Exception:
        data = None

    if not data:
        return JsonResponse({"available": False, "nickname": player.get("nickname")})
    data["available"] = True
    data["nickname"] = player.get("nickname")
    return JsonResponse(data)


@require_GET
def have_we_met(request):
    """GET /api/met/?p1=A&p2=B - did two players cross paths?"""
    p1 = request.GET.get("p1", "").strip()
    p2 = request.GET.get("p2", "").strip()
    if not p1 or not p2:
        return JsonResponse({"error": "Provide two players."}, status=400)
    try:
        data = faceit.build_have_we_met(p1, p2)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JsonResponse({"error": f"Internal: {type(exc).__name__}: {exc}"}, status=500)
    return JsonResponse(data)


def _int_arg(request, name, default):
    try:
        return int(request.GET.get(name, default))
    except (TypeError, ValueError):
        return default


@require_GET
def hltv(request, section):
    """
    GET /api/hltv/<section>/ - HLTV.org data via parse.bot. Sections:
    rankings, results, upcoming, team-stats, player-stats. Returns
    {available: false, reason: 'not_configured'} when PARSE_API_KEY isn't set.
    """
    from . import parsebot
    limit = _int_arg(request, "limit", 30)
    days = _int_arg(request, "days", 30)
    try:
        if section == "rankings":
            data = parsebot.get_team_rankings(limit=limit)
        elif section == "results":
            data = parsebot.get_results(limit=limit)
        elif section == "upcoming":
            filter_cct = request.GET.get("cct") in ("1", "true", "yes")
            data = parsebot.get_upcoming(limit=limit, filter_cct=filter_cct)
        elif section == "team-stats":
            data = parsebot.get_team_stats(days=days, limit=limit)
        elif section == "player-stats":
            data = parsebot.get_player_stats(days=days, limit=limit)
        elif section == "team-details":
            data = parsebot.get_team_details(
                team_url=request.GET.get("url"), team_id=request.GET.get("id"))
        elif section == "player-details":
            data = parsebot.get_player_details(
                player_url=request.GET.get("url"), player_id=request.GET.get("id"))
        else:
            return JsonResponse({"error": "Unknown HLTV section."}, status=404)
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JsonResponse({"error": f"Internal: {type(exc).__name__}: {exc}"}, status=500)
    return JsonResponse(data)


VALID_GAMES = {"price", "trivia"}


@require_GET
def game_leaderboard(request):
    """GET /api/games/leaderboard/?game=price - top 10 scores for a game."""
    game = request.GET.get("game", "")
    if game not in VALID_GAMES:
        return JsonResponse({"error": "Unknown game."}, status=400)
    try:
        from .models import GameScore
        rows = GameScore.objects.filter(game=game).order_by("-score", "created_at")[:10]
        items = [{"name": r.name, "score": r.score} for r in rows]
    except Exception:
        items = []
    return JsonResponse({"items": items})


@csrf_exempt
@require_POST
def game_score(request):
    """POST /api/games/score/ {game, name, score} - save a leaderboard score."""
    try:
        body = json.loads(request.body or "{}")
    except ValueError:
        return JsonResponse({"error": "Bad JSON."}, status=400)

    game = str(body.get("game", ""))
    name = str(body.get("name", "")).strip()[:24] or "Anonymous"
    try:
        score = int(body.get("score"))
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid score."}, status=400)

    if game not in VALID_GAMES or not (0 <= score <= 100000):
        return JsonResponse({"error": "Invalid submission."}, status=400)

    try:
        from .models import GameScore
        GameScore.objects.create(game=game, name=name, score=score)
    except Exception as exc:
        return JsonResponse({"error": f"Could not save: {exc}"}, status=500)
    return JsonResponse({"ok": True})
