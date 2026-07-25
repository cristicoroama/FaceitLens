"""
Sign in with Steam (OpenID 2.0) + session accounts + per-user favorites.

Steam has no OAuth — it uses OpenID 2.0: we redirect the user to
steamcommunity.com, they log in THERE (we never see credentials), and Steam
sends them back with a signed assertion containing their SteamID64. We verify
the signature server-side (check_authentication) and log them into a Django
session. The Django user is created automatically on first sign-in.

Endpoints (wired in tracker/urls.py under /api/auth/):
  GET  /api/auth/steam/login/   -> 302 to Steam's login page
  GET  /api/auth/steam/return/  -> verifies, signs in, 302 back to FRONTEND_URL
  GET  /api/auth/me/            -> {authenticated, name, avatar, steamid, favorites}
  POST /api/auth/logout/        -> ends the session
  GET/POST/DELETE /api/auth/favorites/  -> the signed-in user's favorites

Environment:
  FRONTEND_URL   where to send the user after login (default http://localhost:3000)
  STEAM_API_KEY  optional — used to fetch persona name + avatar
"""
from __future__ import annotations

import json
import os
import re
import urllib.parse

import requests
from django.contrib.auth import login as dj_login, logout as dj_logout
from django.contrib.auth.models import User
from django.http import HttpResponseRedirect, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import Favorite, SteamProfile, UserProfile

STEAM_OPENID = "https://steamcommunity.com/openid/login"

# Handles we never hand out: they'd collide with real routes, or they'd let
# someone pose as us.
RESERVED_HANDLES = {
    "admin", "api", "auth", "u", "me", "settings", "profile", "login", "logout",
    "signup", "register", "static", "assets", "public", "help", "support",
    "about", "terms", "privacy", "contact", "docs", "status", "faceitlens",
    "faceit", "steam", "official", "staff", "moderator", "mod", "root", "system",
    "null", "undefined", "new", "edit", "delete", "search", "player", "players",
}


def slugify_handle(raw: str) -> str:
    """Turn any name into a legal handle: lowercase a-z0-9_- , 3-30 chars."""
    s = re.sub(r"[^a-zA-Z0-9_-]+", "-", (raw or "")).strip("-_").lower()
    s = re.sub(r"-{2,}", "-", s)[:30]
    return s


# Separators people put between a clan/team tag and their actual name.
_TAG_SPLIT = re.compile(r"\s*[|/•·:›»~]+\s*|\]\s*|\)\s*")


def strip_clan_tag(name: str) -> str:
    """Pull the actual nickname out of a decorated Steam persona.

    Steam names are routinely "Team Dorohoi | LorduKiki" or "[BOT] Player".
    Slugifying the whole thing gives handles like @team-dorohoi-lordukiki,
    which is not what anyone wants on their profile. Gaming personas put the
    tag first and the name last, so when there's an explicit separator we keep
    the last segment. Names with no separator are left alone — splitting
    "Cristi Coroama" on the space would throw away half of it.
    """
    name = (name or "").strip()
    if not name:
        return ""

    parts = [p.strip(" -_[](){}") for p in _TAG_SPLIT.split(name)]
    parts = [p for p in parts if p]
    if len(parts) > 1:
        # Take the last meaningful segment, but not if it's a scrap like "TR".
        last = parts[-1]
        if len(slugify_handle(last)) >= 3:
            return last
        for p in reversed(parts[:-1]):
            if len(slugify_handle(p)) >= 3:
                return p
    return name


def unique_handle(preferred: str, taken_by_user_id=None) -> str:
    """A free handle close to `preferred` — appends 2, 3, ... only if needed."""
    base = slugify_handle(strip_clan_tag(preferred))
    if len(base) < 3 or base in RESERVED_HANDLES:
        base = f"player-{base}" if base else "player"
    base = base[:26]

    qs = UserProfile.objects.all()
    if taken_by_user_id:
        qs = qs.exclude(user_id=taken_by_user_id)

    candidate = base
    n = 1
    while candidate in RESERVED_HANDLES or qs.filter(handle__iexact=candidate).exists():
        n += 1
        suffix = str(n)
        candidate = f"{base[:30 - len(suffix)]}{suffix}"
    return candidate


def record_elo_snapshot(player_id: str, elo) -> None:
    """Store today's ELO for a player, if we happen to have it.

    The cron job is the reliable source, but calling this whenever we already
    hold fresh data — at sign-in, or when someone opens a member's profile —
    means the history starts building immediately, and it keeps working on days
    the cron misses. update_or_create keyed on (player_id, date) makes repeat
    calls within a day harmless.
    """
    if not player_id or elo in (None, ""):
        return
    try:
        from datetime import date
        from .models import EloSnapshot
        EloSnapshot.objects.update_or_create(
            player_id=player_id, date=date.today(), defaults={"elo": int(elo)}
        )
    except Exception:
        # Never let bookkeeping break the request that triggered it.
        pass


def link_faceit_account(profile: UserProfile, steamid: str) -> bool:
    """Find the FACEIT account that owns this SteamID and attach it.

    This is the whole reason sign-in is worth doing. Steam has already proven
    the user owns this SteamID64, and FACEIT will tell us which account has it
    registered — so the link is verified end to end without asking the user to
    paste a code anywhere. Returns True if a CS2 account was found.
    """
    # Imported lazily: this module is also loaded by management commands that
    # have no business reaching out to the FACEIT API.
    try:
        from .faceit import get_player_by_steam
    except Exception:
        return False

    try:
        data = get_player_by_steam(steamid) or {}
    except Exception:
        # FACEIT being down must never break signing in.
        return False

    nickname = data.get("nickname")
    player_id = data.get("player_id")
    if not nickname or not player_id:
        return False

    profile.faceit_nickname = nickname
    profile.faceit_player_id = player_id
    profile.faceit_verified = True

    # We already have their ELO in hand — start the history right now.
    cs2 = (data.get("games") or {}).get("cs2") or {}
    record_elo_snapshot(player_id, cs2.get("faceit_elo"))

    # Registering them as a tracked player means the cron picks them up too.
    try:
        from django.utils import timezone
        from .models import TrackedPlayer
        TrackedPlayer.objects.update_or_create(
            player_id=player_id,
            defaults={"nickname": nickname, "last_searched": timezone.now()},
        )
    except Exception:
        pass

    return True


def ensure_profile(user, steamid: str = "", persona: str = "") -> UserProfile:
    """Fetch or build this user's public profile, linking FACEIT if we can."""
    profile = UserProfile.objects.filter(user=user).first()
    created = profile is None
    if created:
        profile = UserProfile(user=user)

    # Only try to link while we don't have a verified link yet — once it's
    # established there's no reason to hit the FACEIT API on every sign-in.
    if steamid and not profile.faceit_verified:
        link_faceit_account(profile, steamid)

    if not profile.handle:
        # Prefer the FACEIT nickname, fall back to the Steam persona.
        profile.handle = unique_handle(
            profile.faceit_nickname or persona or f"player{steamid[-6:]}",
            taken_by_user_id=user.id,
        )

    profile.save()
    return profile


def profile_payload(profile: UserProfile) -> dict:
    """The shape the frontend expects for 'my profile'."""
    return {
        "handle": profile.handle,
        "name": profile.name,
        "display_name": profile.display_name,
        "bio": profile.bio,
        "avatar": (
            f"/api/avatar/{profile.handle}/?v={int(profile.avatar_updated.timestamp())}"
            if profile.avatar_updated and profile.has_avatar
            else None
        ),
        "faceit_nickname": profile.faceit_nickname,
        "faceit_player_id": profile.faceit_player_id,
        "faceit_verified": profile.faceit_verified,
        "is_public": profile.is_public,
        "url": f"/u/{profile.handle}",
    }


def _frontend(request=None) -> str:
    """Where to send the user after login.

    Priority: FRONTEND_URL env  ->  the origin they came from (captured in the
    session at login time)  ->  localhost dev default. The session capture means
    it "just works" on Vercel+Render even if FRONTEND_URL isn't set."""
    env = os.environ.get("FRONTEND_URL", "").rstrip("/")
    if env:
        return env
    if request is not None:
        origin = request.session.get("login_origin")
        if origin:
            return origin.rstrip("/")
    return "http://localhost:3000"


def _backend_base(request) -> str:
    scheme = "https" if request.is_secure() else "http"
    return f"{scheme}://{request.get_host()}"


def _fav_list(user) -> list:
    return list(
        Favorite.objects.filter(user=user)
        .order_by("-created_at")
        .values_list("nickname", flat=True)[:50]
    )


def _steam_summary(steamid: str):
    """Persona name + avatar via the Steam Web API (needs STEAM_API_KEY)."""
    key = os.environ.get("STEAM_API_KEY", "")
    if not key:
        return None, None
    try:
        r = requests.get(
            "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/",
            params={"key": key, "steamids": steamid},
            timeout=10,
        )
        players = r.json().get("response", {}).get("players") or []
        p = players[0] if players else {}
        return p.get("personaname"), p.get("avatarfull")
    except Exception:
        return None, None


def steam_login(request):
    """Kick off OpenID: redirect the browser to Steam's login page."""
    # Remember which frontend the user clicked from (Origin/Referer header),
    # so we can send them back there after Steam — no env var required.
    origin = request.META.get("HTTP_ORIGIN")
    if not origin:
        ref = request.META.get("HTTP_REFERER")
        if ref:
            p = urllib.parse.urlparse(ref)
            if p.scheme and p.netloc:
                origin = f"{p.scheme}://{p.netloc}"
    if origin:
        request.session["login_origin"] = origin

    return_to = _backend_base(request) + "/api/auth/steam/return/"
    params = {
        "openid.ns": "http://specs.openid.net/auth/2.0",
        "openid.mode": "checkid_setup",
        "openid.return_to": return_to,
        "openid.realm": _backend_base(request),
        "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
        "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    }
    return HttpResponseRedirect(STEAM_OPENID + "?" + urllib.parse.urlencode(params))


def steam_return(request):
    """Steam sent the user back — verify the assertion and sign them in."""
    params = dict(request.GET.items())
    params["openid.mode"] = "check_authentication"
    try:
        resp = requests.post(STEAM_OPENID, data=params, timeout=10)
        valid = "is_valid:true" in resp.text
    except requests.RequestException:
        valid = False

    claimed = request.GET.get("openid.claimed_id", "")
    m = re.search(r"/openid/id/(\d{15,20})$", claimed)
    if not valid or not m:
        return HttpResponseRedirect(_frontend(request) + "/?login=failed")

    steamid = m.group(1)
    persona, avatar = _steam_summary(steamid)

    user, _created = User.objects.get_or_create(username=f"steam:{steamid}")

    # Auto-promote configured owner SteamID(s) to Django admin. Set
    # ADMIN_STEAM_IDS="7656...,7656..." on the backend. This means you get the
    # /admin/ panel just by signing in with Steam — no separate password, and it
    # survives the free-tier database resets (re-applied on every login).
    admin_ids = {
        s.strip()
        for s in os.environ.get("ADMIN_STEAM_IDS", "").split(",")
        if s.strip()
    }
    should_be_admin = steamid in admin_ids
    if user.is_staff != should_be_admin or user.is_superuser != should_be_admin:
        user.is_staff = should_be_admin
        user.is_superuser = should_be_admin
        user.save(update_fields=["is_staff", "is_superuser"])

    prof, _created = SteamProfile.objects.get_or_create(
        user=user, defaults={"steamid": steamid}
    )
    prof.steamid = steamid
    if persona:
        prof.name = persona
    if avatar:
        prof.avatar = avatar
    prof.save()

    # Build the public profile and auto-link the FACEIT account. Wrapped
    # defensively: a hiccup here must never cost the user their sign-in.
    linked = False
    try:
        profile = ensure_profile(user, steamid=steamid, persona=persona or "")
        linked = profile.faceit_verified
    except Exception:
        pass

    dj_login(request, user)
    # `login=new` tells the frontend to nudge first-timers toward their settings
    # page; `linked=0` means we couldn't find a FACEIT account for this Steam
    # ID, so the UI should offer to set one by hand.
    flag = "ok" if linked else "nolink"
    return HttpResponseRedirect(_frontend(request) + f"/?login={flag}")


def me(request):
    """Who am I? Includes the favorites so the frontend syncs in one call."""
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False})
    prof = getattr(request.user, "steam_profile", None)

    # Users who signed in before profiles existed won't have one yet — build it
    # on the fly so nobody has to log out and back in.
    profile = UserProfile.objects.filter(user=request.user).first()
    if profile is None:
        try:
            profile = ensure_profile(
                request.user,
                steamid=prof.steamid if prof else "",
                persona=prof.name if prof else "",
            )
        except Exception:
            profile = None

    steam_avatar = (prof.avatar if prof else None) or None
    payload = profile_payload(profile) if profile else {}

    return JsonResponse({
        "authenticated": True,
        "steamid": prof.steamid if prof else None,
        "name": payload.get("name") or (prof.name if prof and prof.name else request.user.username),
        # Uploaded picture wins; otherwise fall back to the Steam one.
        "avatar": payload.get("avatar") or steam_avatar,
        "steam_avatar": steam_avatar,
        "favorites": _fav_list(request.user),
        "profile": payload or None,
    })


@csrf_exempt
def logout_view(request):
    dj_logout(request)
    return JsonResponse({"ok": True})


@csrf_exempt
def favorites(request):
    """GET list / POST {nickname} to add / DELETE {nickname} to remove."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Not signed in."}, status=401)

    if request.method == "GET":
        return JsonResponse({"favorites": _fav_list(request.user)})

    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)
    nick = (body.get("nickname") or "").strip()[:100]
    if not nick:
        return JsonResponse({"error": "nickname required."}, status=400)

    if request.method == "POST":
        if not Favorite.objects.filter(user=request.user, nickname__iexact=nick).exists():
            Favorite.objects.create(user=request.user, nickname=nick)
    elif request.method == "DELETE":
        Favorite.objects.filter(user=request.user, nickname__iexact=nick).delete()
    else:
        return JsonResponse({"error": "Method not allowed."}, status=405)

    return JsonResponse({"favorites": _fav_list(request.user)})
