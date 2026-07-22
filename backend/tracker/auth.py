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

from .models import Favorite, SteamProfile

STEAM_OPENID = "https://steamcommunity.com/openid/login"


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

    dj_login(request, user)
    return HttpResponseRedirect(_frontend(request) + "/?login=ok")


def me(request):
    """Who am I? Includes the favorites so the frontend syncs in one call."""
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False})
    prof = getattr(request.user, "steam_profile", None)
    return JsonResponse({
        "authenticated": True,
        "steamid": prof.steamid if prof else None,
        "name": (prof.name if prof and prof.name else request.user.username),
        "avatar": (prof.avatar if prof else None) or None,
        "favorites": _fav_list(request.user),
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
