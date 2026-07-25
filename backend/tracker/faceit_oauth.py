"""
Sign in with FACEIT — FACEIT Connect (OAuth2 Authorization Code + PKCE).

Why this exists: proving you own a FACEIT account is not something a user can
do by typing their nickname into a form. Either Steam vouches for you (it hands
us a signed SteamID64 that FACEIT can map to an account), or FACEIT itself
vouches for you — which is what this module is. Anything else is a claim, and
claims let people put "donk666" on their profile.

Two entry points, same result:
  * A visitor who isn't signed in gets an account created for them.
  * A visitor already signed in through Steam gets their FACEIT account
    attached to the account they already have.

Endpoints (wired in tracker/urls.py under /api/auth/):
  GET /api/auth/faceit/login/   -> 302 to FACEIT's consent screen
  GET /api/auth/faceit/return/  -> verifies, links or signs in, 302 to frontend
  POST /api/auth/faceit/unlink/ -> detach the FACEIT account

Environment:
  FACEIT_CLIENT_ID       from the FACEIT Developer Portal -> App Studio
  FACEIT_CLIENT_SECRET   same place; keep it secret
  FRONTEND_URL           where to send the user afterwards

Endpoints below come from https://api.faceit.com/auth/v1/openid_configuration
"""
from __future__ import annotations

import base64
import hashlib
import os
import secrets
import urllib.parse

import requests
from django.contrib.auth import login as dj_login
from django.contrib.auth.models import User
from django.http import HttpResponseRedirect, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .auth import (
    _backend_base,
    _frontend,
    ensure_profile,
    record_elo_snapshot,
    unique_handle,
)
from .models import UserProfile

AUTHORIZE_URL = "https://accounts.faceit.com"
TOKEN_URL = "https://api.faceit.com/auth/v1/oauth/token"
USERINFO_URL = "https://api.faceit.com/auth/v1/resources/userinfo"

SESSION_VERIFIER = "faceit_pkce_verifier"
SESSION_STATE = "faceit_oauth_state"


def _client():
    return (
        os.environ.get("FACEIT_CLIENT_ID", "").strip(),
        os.environ.get("FACEIT_CLIENT_SECRET", "").strip(),
    )


def is_configured() -> bool:
    """Whether FACEIT sign-in is switched on for this deployment."""
    cid, secret = _client()
    return bool(cid and secret)


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _make_pkce():
    """A fresh PKCE verifier and its S256 challenge.

    PKCE stops an attacker who intercepts the redirect (a malicious app
    registered on the same URL scheme, a shared machine, a leaky proxy) from
    trading the authorization code for a token: without the original verifier,
    which never leaves our server, the code is useless.
    """
    verifier = _b64url(secrets.token_bytes(64))
    challenge = _b64url(hashlib.sha256(verifier.encode()).digest())
    return verifier, challenge


def faceit_login(request):
    """Kick off the flow: redirect the browser to FACEIT's consent screen."""
    client_id, _ = _client()
    if not client_id:
        return HttpResponseRedirect(_frontend(request) + "/?faceit=unconfigured")

    # Remember where they came from, same as the Steam flow.
    origin = request.META.get("HTTP_ORIGIN")
    if not origin:
        ref = request.META.get("HTTP_REFERER")
        if ref:
            p = urllib.parse.urlparse(ref)
            if p.scheme and p.netloc:
                origin = f"{p.scheme}://{p.netloc}"
    if origin:
        request.session["login_origin"] = origin

    verifier, challenge = _make_pkce()
    state = secrets.token_urlsafe(24)
    request.session[SESSION_VERIFIER] = verifier
    request.session[SESSION_STATE] = state

    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": _backend_base(request) + "/api/auth/faceit/return/",
        "scope": "openid profile",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "redirect_popup": "true",
    }
    return HttpResponseRedirect(AUTHORIZE_URL + "?" + urllib.parse.urlencode(params))


def _exchange_code(request, code: str) -> dict | None:
    """Trade the one-time code for tokens (server to server)."""
    client_id, client_secret = _client()
    verifier = request.session.pop(SESSION_VERIFIER, "")
    if not verifier:
        return None

    try:
        resp = requests.post(
            TOKEN_URL,
            # FACEIT advertises client_secret_basic, so the credentials go in
            # the Authorization header rather than the body.
            auth=(client_id, client_secret),
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": _backend_base(request) + "/api/auth/faceit/return/",
                "code_verifier": verifier,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15,
        )
        if resp.status_code != 200:
            return None
        return resp.json()
    except (requests.RequestException, ValueError):
        return None


def _userinfo(access_token: str) -> dict | None:
    try:
        resp = requests.get(
            USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15,
        )
        if resp.status_code != 200:
            return None
        return resp.json()
    except (requests.RequestException, ValueError):
        return None


def _attach(profile: UserProfile, player_id: str, nickname: str) -> None:
    """Record a proven FACEIT link and start the ELO history."""
    profile.faceit_player_id = player_id
    profile.faceit_nickname = nickname
    profile.faceit_verified = True
    if not profile.handle:
        profile.handle = unique_handle(nickname, taken_by_user_id=profile.user_id)
    profile.save()

    try:
        from .faceit import _get, GAME
        player = _get(f"/players/{player_id}") or {}
        elo = ((player.get("games") or {}).get(GAME) or {}).get("faceit_elo")
        record_elo_snapshot(player_id, elo)

        from django.utils import timezone
        from .models import TrackedPlayer
        TrackedPlayer.objects.update_or_create(
            player_id=player_id,
            defaults={"nickname": nickname, "last_searched": timezone.now()},
        )
    except Exception:
        pass


def faceit_return(request):
    """FACEIT sent the user back — verify and link or sign in."""
    frontend = _frontend(request)

    if request.GET.get("error"):
        return HttpResponseRedirect(frontend + "/?faceit=denied")

    code = request.GET.get("code", "")
    state = request.GET.get("state", "")
    expected = request.session.pop(SESSION_STATE, None)

    # The state check is what stops someone tricking a logged-in user into
    # completing an attacker's authorization and binding the wrong account.
    if not code or not state or state != expected:
        return HttpResponseRedirect(frontend + "/?faceit=failed")

    tokens = _exchange_code(request, code)
    if not tokens or not tokens.get("access_token"):
        return HttpResponseRedirect(frontend + "/?faceit=failed")

    info = _userinfo(tokens["access_token"])
    if not info:
        return HttpResponseRedirect(frontend + "/?faceit=failed")

    # FACEIT returns the player id as `guid`; nickname keys have varied across
    # versions of the API, so accept the ones we've seen.
    player_id = info.get("guid") or info.get("sub") or ""
    nickname = (
        info.get("nickname")
        or info.get("preferred_username")
        or info.get("given_name")
        or ""
    )
    if not player_id:
        return HttpResponseRedirect(frontend + "/?faceit=failed")

    # Fill in a missing nickname from the Data API rather than giving up.
    if not nickname:
        try:
            from .faceit import _get
            nickname = (_get(f"/players/{player_id}") or {}).get("nickname") or ""
        except Exception:
            pass
    if not nickname:
        return HttpResponseRedirect(frontend + "/?faceit=failed")

    # Someone else already proved they own this FACEIT account. That's either a
    # duplicate sign-in or an attempt to take it over; either way, refuse.
    clash = UserProfile.objects.filter(
        faceit_player_id=player_id, faceit_verified=True
    ).first()

    if request.user.is_authenticated:
        # Already signed in (via Steam) — attach FACEIT to that account.
        if clash and clash.user_id != request.user.id:
            return HttpResponseRedirect(frontend + "/settings?faceit=taken")
        profile = ensure_profile(request.user)
        _attach(profile, player_id, nickname)
        return HttpResponseRedirect(frontend + "/settings?faceit=linked")

    # Not signed in — sign them in as the owner of this FACEIT account.
    if clash:
        dj_login(request, clash.user)
        return HttpResponseRedirect(frontend + "/?faceit=ok")

    user, _created = User.objects.get_or_create(username=f"faceit:{player_id}")
    profile = ensure_profile(user, persona=nickname)
    _attach(profile, player_id, nickname)
    dj_login(request, user)
    return HttpResponseRedirect(frontend + "/?faceit=ok")


@csrf_exempt
def faceit_unlink(request):
    """Detach the FACEIT account from the signed-in user."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Not signed in."}, status=401)
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)

    profile = UserProfile.objects.filter(user=request.user).first()
    if profile:
        profile.faceit_nickname = ""
        profile.faceit_player_id = ""
        profile.faceit_verified = False
        profile.save(update_fields=[
            "faceit_nickname", "faceit_player_id", "faceit_verified", "updated_at",
        ])
    return JsonResponse({"ok": True})


def faceit_config(request):
    """Lets the frontend hide the button when the app isn't configured yet."""
    return JsonResponse({"enabled": is_configured()})
