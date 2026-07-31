from django.http import JsonResponse
import json
import os
from django.core.cache import cache
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt

from . import faceit
from . import ai
from .profiles import _client_ip

# Anthropic calls are the only thing in this API that costs real money, so cap
# how many one client can trigger. Serving an already-cached analysis is free
# and never spends a slot.
AI_RATE_LIMIT = int(os.environ.get("AI_RATE_LIMIT", "20"))
AI_RATE_WINDOW = 60 * 60


def _over_ai_rate_limit(request):
    """Count one billable AI call for this client.

    Returns a 429 response once the client is over budget, else None. The
    counter lives in the shared cache, so with Redis the limit holds across all
    gunicorn workers instead of being per-process.
    """
    key = f"rl:ai:{_client_ip(request)}"
    try:
        used = cache.incr(key)
    except ValueError:
        cache.set(key, 1, AI_RATE_WINDOW)
        used = 1
    if used > AI_RATE_LIMIT:
        return JsonResponse(
            {"error": "Too many AI requests from this address. Try again later."},
            status=429,
            headers={"Retry-After": str(AI_RATE_WINDOW)},
        )
    return None


def _record_bans(data):
    """If a looked-up player is banned, log it into the recent-bans feed.
    Safe/best-effort — never breaks the request."""
    try:
        bans = data.get("bans") or []
        if not bans:
            return
        from .models import BanRecord
        for b in bans:
            btype = (b.get("reason") or b.get("type") or "ban").strip()[:64]
            BanRecord.objects.get_or_create(
                player_id=data.get("player_id") or data.get("nickname"),
                ban_type=btype,
                defaults={
                    "nickname": data.get("nickname") or "",
                    "avatar": data.get("avatar") or "",
                    "reason": btype,
                },
            )
    except Exception:
        pass


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

    _record_bans(data)

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
def health(request):
    """GET /api/health/ - lightweight liveness probe for the API status badge."""
    return JsonResponse({
        "status": "ok",
        "service": "faceitlens-api",
    })


@require_GET
def recent_bans(request):
    """GET /api/bans/ - recently observed bans among searched/tracked players."""
    from .models import BanRecord
    items = [
        {
            "nickname": b.nickname,
            "player_id": b.player_id,
            "avatar": b.avatar or None,
            "ban_type": b.ban_type,
            "detected_at": b.detected_at.isoformat(),
        }
        for b in BanRecord.objects.all()[:60]
    ]
    return JsonResponse({"items": items, "count": len(items)})


@require_GET
def steam_status(request):
    """GET /api/steamstatus/ - official CS2 / Steam status via Valve's Web API
    (ICSGOServers_730/GetGameServersStatus). Cached 2 min. Needs STEAM_API_KEY."""
    import os
    import requests as _rq
    from django.core.cache import cache

    cached = cache.get("steam_status")
    if cached is not None:
        return JsonResponse(cached)

    key = os.environ.get("STEAM_API_KEY", "")
    if not key:
        return JsonResponse({"available": False, "reason": "no_key"})

    try:
        r = _rq.get(
            "https://api.steampowered.com/ICSGOServers_730/GetGameServersStatus/v1/",
            params={"key": key}, timeout=10,
        )
        res = (r.json() or {}).get("result", {})
    except Exception as exc:
        return JsonResponse({"available": False, "reason": str(exc)[:80]})

    if not res:
        return JsonResponse({"available": False, "reason": "empty"})

    svc = res.get("services", {}) or {}
    mm = res.get("matchmaking", {}) or {}
    dcs = res.get("datacenters", {}) or {}

    services = [{"name": k, "state": v} for k, v in svc.items()]
    datacenters = [
        {"name": k, "capacity": (v or {}).get("capacity"), "load": (v or {}).get("load")}
        for k, v in dcs.items()
    ]

    good = (mm.get("scheduler") == "normal") and all(
        s["state"] == "normal" for s in services
    )
    payload = {
        "available": True,
        "overall": "operational" if good else "issues",
        "matchmaking": {
            "scheduler": mm.get("scheduler"),
            "online_players": mm.get("online_players"),
            "online_servers": mm.get("online_servers"),
            "searching_players": mm.get("searching_players"),
            "search_seconds_avg": mm.get("search_seconds_avg"),
        },
        "services": services,
        "datacenters": datacenters,
        "app_version": res.get("app", {}).get("version"),
    }
    cache.set("steam_status", payload, 2 * 60)
    return JsonResponse(payload)


@require_GET
def faceit_status(request):
    """GET /api/faceitstatus/ - FACEIT platform status from the official
    incident.io RSS feed (faceitstatus.com). Cached 5 min."""
    import re as _re
    import requests as _rq
    from django.core.cache import cache
    from xml.etree import ElementTree as ET

    cached = cache.get("faceit_status")
    if cached is not None:
        return JsonResponse(cached)

    COMPONENTS = ["Play", "Login", "Subscriptions", "Anti Cheat"]
    incidents = []
    active_components = set()

    try:
        resp = _rq.get("https://www.faceitstatus.com/feed.rss", timeout=10,
                       headers={"User-Agent": "FaceitLens/1.0"})
        root = ET.fromstring(resp.content)
        for item in list(root.iter("item"))[:8]:
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub = (item.findtext("pubDate") or "").strip()
            desc = item.findtext("description") or ""
            m = _re.search(r"Status:\s*(?:</?b>\s*)?([A-Za-z]+)", desc)
            state = (m.group(1).strip() if m else "Unknown")
            comps = _re.findall(r"<li>\s*([A-Za-z ]+?)\s*\(", desc)
            resolved = state.lower() == "resolved"
            if not resolved:
                for c in comps:
                    active_components.add(c.strip())
            incidents.append({
                "title": title, "link": link, "date": pub,
                "state": state, "resolved": resolved,
                "components": [c.strip() for c in comps],
            })
        reachable = True
    except Exception:
        reachable = False

    components = [
        {"name": c, "ok": c not in active_components}
        for c in COMPONENTS
    ]
    all_ok = reachable and len(active_components) == 0
    overall = "operational" if all_ok else ("issues" if reachable else "unknown")

    payload = {
        "overall": overall,
        "reachable": reachable,
        "components": components,
        "incidents": incidents,
        "source": "https://www.faceitstatus.com/",
    }
    cache.set("faceit_status", payload, 5 * 60)
    return JsonResponse(payload)


@require_GET
def status(request):
    """GET /api/status/ - per-upstream health for the status page. Cached 3 min
    so it never hammers the providers. Each data source is probed independently
    so we can report 'partially operational' when one (e.g. HLTV) is down."""
    import os
    from django.core.cache import cache

    cached = cache.get("svc_status")
    if cached is not None:
        return JsonResponse(cached)

    services = []

    # --- FACEIT (core) — cheap regional-ranking call verifies the key works ---
    try:
        faceit._get("/rankings/games/cs2/regions/EU", params={"offset": 0, "limit": 1})
        services.append({"name": "FACEIT API", "ok": True, "detail": "player & match data", "core": True})
    except Exception as exc:
        services.append({"name": "FACEIT API", "ok": False, "detail": str(exc)[:80], "core": True})

    # --- Steam — reachable + not on cooldown ---
    try:
        from . import steam as steam_mod
        if steam_mod._cooldown_active():
            services.append({"name": "Steam", "ok": False, "detail": "rate-limited (cooldown)"})
        else:
            services.append({"name": "Steam", "ok": True, "detail": "inventory / trust score"})
    except Exception as exc:
        services.append({"name": "Steam", "ok": False, "detail": str(exc)[:80]})

    # --- Leetify — public API, config-free ---
    services.append({"name": "Leetify", "ok": True, "detail": "demo-based stats"})

    # --- AI — key configured? (don't spend tokens probing) ---
    if os.environ.get("ANTHROPIC_API_KEY", ""):
        services.append({"name": "AI (analysis / roast)", "ok": True, "detail": "configured"})
    else:
        services.append({"name": "AI (analysis / roast)", "ok": False, "detail": "not configured"})

    # --- Allstar — auto-generated highlight clips (optional add-on) ---
    from . import allstar
    if allstar.is_configured():
        services.append({"name": "Allstar Highlights", "ok": True, "detail": "highlight clips"})
    else:
        services.append({"name": "Allstar Highlights", "ok": False, "detail": "not configured"})

    core_down = any(not s["ok"] for s in services if s.get("core"))
    any_down = any(not s["ok"] for s in services)
    if core_down:
        overall = "outage"
    elif any_down:
        overall = "partial"
    else:
        overall = "operational"

    payload = {"overall": overall, "services": services}
    cache.set("svc_status", payload, 3 * 60)
    return JsonResponse(payload)


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

    hit = ai.cached_result(summary, ai.ANALYSIS_KIND)
    if hit is not None:
        return JsonResponse({"analysis": hit})

    limited = _over_ai_rate_limit(request)
    if limited is not None:
        return limited

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

    hit = ai.cached_result(summary, ai.ROAST_KIND)
    if hit is not None:
        return JsonResponse({"roast": hit})

    limited = _over_ai_rate_limit(request)
    if limited is not None:
        return limited

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
def leetify_match(request):
    """
    GET /api/leetify/match/?source=faceit&id=<match_id> - demo-parsed scoreboard
    for one match, straight from Leetify.

    This is the cheap version of our own demo worker: Leetify has already
    downloaded and parsed the demo, so for any match they cover we get per-player
    ratings, multi-kills, opening duels, trading and utility without spending
    bandwidth or CPU on it. Returns {available: false} for matches they don't
    have. Proxied live, never stored (Leetify rule).
    """
    source = request.GET.get("source", "faceit")
    match_id = request.GET.get("id", "")
    if not match_id:
        return JsonResponse({"error": "id is required."}, status=400)
    if source not in ("faceit", "matchmaking"):
        return JsonResponse({"error": "source must be faceit or matchmaking."}, status=400)

    try:
        from . import leetify
        return JsonResponse(leetify.get_match(source, match_id))
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JsonResponse({"error": f"Internal: {type(exc).__name__}: {exc}"}, status=500)


@require_GET
def leetify_matches(request, nickname):
    """
    GET /api/player/<nickname>/leetify/matches/ - the player's recent matches
    with their own parsed stat line for each.
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
        return JsonResponse(leetify.get_player_matches(steamid))
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JsonResponse({"error": f"Internal: {type(exc).__name__}: {exc}"}, status=500)


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


@require_GET
def changelog(request):
    """The "What's New" feed, written from the Django admin.

    `latest_id` is what drives the popup: the frontend stores the highest id
    it has shown and only interrupts the visitor again once a newer entry
    exists. Comparing ids rather than dates means backdating an old post in
    the admin won't re-nag everyone.
    """
    from .models import ChangelogEntry

    rows = ChangelogEntry.objects.filter(published=True)[:60]
    entries = [
        {
            "id": e.id,
            "title": e.title,
            "kind": e.kind,
            "kind_label": e.get_kind_display(),
            "lines": e.lines,
            "date": e.published_at.date().isoformat(),
            "highlight": e.highlight,
        }
        for e in rows
    ]
    return JsonResponse({
        "entries": entries,
        "latest_id": max((e["id"] for e in entries), default=0),
        "count": len(entries),
    })


def incidents(request):
    """Public status feed: overall system state + incident history with a
    timestamped update timeline. All content is editable from the Django admin."""
    from django.utils import timezone
    from .models import Incident

    qs = (
        Incident.objects.filter(published=True)
        .prefetch_related("updates")
        .order_by("-started")
    )

    incidents_data = []
    active_impacts = []
    latest_ts = None

    for inc in qs:
        if inc.is_active:
            active_impacts.append(inc.impact)

        updates = []
        for u in inc.updates.all():  # model Meta orders these newest-first
            updates.append({"at": u.at.isoformat(), "status": u.status, "text": u.text})
            if latest_ts is None or u.at > latest_ts:
                latest_ts = u.at

        for ts in (inc.started, inc.resolved):
            if ts and (latest_ts is None or ts > latest_ts):
                latest_ts = ts

        incidents_data.append({
            "id": inc.id,
            "title": inc.title,
            "component": inc.component,
            "endpoint": inc.endpoint,
            "impact": inc.impact,
            "status": inc.status,
            "started": inc.started.isoformat() if inc.started else None,
            "resolved": inc.resolved.isoformat() if inc.resolved else None,
            "updates": updates,
        })

    # Overall banner derived from any still-active incidents.
    if not active_impacts:
        system = {"state": "operational", "text": "All systems operational", "active": False}
    elif "critical" in active_impacts:
        system = {"state": "outage", "text": "Service outage", "active": True}
    elif set(active_impacts) == {"maintenance"}:
        system = {"state": "maintenance", "text": "Under maintenance", "active": True}
    else:
        system = {"state": "degraded", "text": "Degraded performance", "active": True}

    system["updated"] = (latest_ts or timezone.now()).isoformat()

    return JsonResponse({"system": system, "incidents": incidents_data})


@require_GET
def player_clips(request, nickname):
    """A player's Allstar.gg highlight clips. Returns configured=False (and no
    clips) until the Allstar Partner API keys are set in the environment.
    Prefers clips stored via webhook; falls back to Allstar's own store."""
    from . import allstar
    from .models import AllstarClip
    if not allstar.is_configured():
        return JsonResponse({"configured": False, "clips": []})
    try:
        player = faceit.get_player_by_nickname(nickname)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)
    steam_id = (player.get("games", {}).get(faceit.GAME, {}) or {}).get("game_player_id")

    clips = []
    if steam_id:
        rows = list(AllstarClip.objects.filter(steamid=steam_id).exclude(status="Error")[:24])
        clips = [allstar.clip_to_dict(r) for r in rows]
        if not clips:
            clips = allstar.get_user_clips(steam_id)

    return JsonResponse({
        "configured": True,
        "can_generate": allstar.can_generate(),
        "steam_id": steam_id,
        "partner_id": allstar.PARTNER_ID,
        "use_case": allstar.USE_CASE,
        "clips": clips,
    })


@csrf_exempt
@require_POST
def allstar_webhook(request):
    """Receive Allstar clip lifecycle events (Submitted/Processed/OnDemand/Error).
    Must reply 2xx, else Allstar retries every 15 min (up to 8 times)."""
    from . import allstar
    from .models import AllstarClip

    if not allstar.webhook_auth_ok(request.headers.get("Authorization", "")):
        return JsonResponse({"error": "unauthorized"}, status=401)

    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({"ok": True})  # 2xx so a malformed body isn't retried forever

    fields = allstar.parse_webhook_event(data)
    clip_id = fields.get("clip_id")
    req_id = fields.get("request_id")

    # Match a (possibly pre-created) row; never overwrite known values with empty
    # ones from a sparse event.
    row = None
    if clip_id:
        row = AllstarClip.objects.filter(clip_id=clip_id).first()
    if row is None and req_id:
        row = AllstarClip.objects.filter(request_id=req_id).first()

    updates = {k: v for k, v in fields.items() if v not in ("", None)}
    try:
        if row:
            for k, v in updates.items():
                setattr(row, k, v)
            row.save()
        elif clip_id or req_id:
            AllstarClip.objects.create(**updates)
    except Exception:  # noqa - never fail the webhook (would just trigger retries)
        pass

    return JsonResponse({"ok": True})


@csrf_exempt
@require_POST
def player_clips_generate(request, nickname):
    """Request Allstar POTG clips from a player's recent FACEIT matches (capped)."""
    from . import allstar
    from .models import AllstarClip

    if not allstar.can_generate():
        return JsonResponse({"error": "Clip generation is not enabled."}, status=400)
    try:
        player = faceit.get_player_by_nickname(nickname)
    except faceit.FaceitError as exc:
        return JsonResponse({"error": str(exc)}, status=502)

    player_id = player["player_id"]
    steam_id = (player.get("games", {}).get(faceit.GAME, {}) or {}).get("game_player_id")
    items = faceit.get_match_stats(player_id, limit=5)

    requested = 0
    for it in items:
        mid = (it.get("stats", {}) or {}).get("Match Id") or it.get("match_id")
        if not mid:
            continue
        if AllstarClip.objects.filter(match_id=mid, steamid=steam_id or "").exists():
            continue
        demo = faceit.get_match_demo_url(mid)
        if not demo:
            continue
        ok, info = allstar.request_potg(demo, steamid=steam_id, match_id=mid)
        if ok:
            data = info if isinstance(info, dict) else {}
            req_id = data.get("requestId") or (data.get("data") or {}).get("requestId") or ""
            AllstarClip.objects.create(
                request_id=req_id, steamid=steam_id or "", match_id=mid,
                demo_url=demo, status="Requested",
            )
            requested += 1
        if requested >= 3:
            break

    return JsonResponse({"requested": requested})
