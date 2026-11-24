"""Verified FACEIT level roles in Discord.

Site (signed in, FACEIT linked through OAuth):
  GET    /api/discord/code/      {linked, faceit_verified}
  POST   /api/discord/code/      one-time code for /verify in Discord
  DELETE /api/discord/code/      unlink Discord

Bot (header X-Bot-Secret = DISCORD_BOT_SECRET):
  POST /api/discord/claim/       {code, discord_id} -> verified FACEIT player
  POST /api/discord/unlink/      {discord_id}
  GET  /api/discord/levels/?ids= current level/ELO for verified player ids
"""
import hmac
import json
import os
import secrets
from datetime import timedelta

from django.core.cache import cache
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from . import faceit
from .models import DiscordLink, DiscordLinkCode, UserProfile

CODE_TTL = timedelta(minutes=15)
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _body(request):
    try:
        return json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return {}


def _bot_ok(request):
    secret = os.environ.get("DISCORD_BOT_SECRET", "")
    got = request.headers.get("X-Bot-Secret", "")
    return bool(secret) and hmac.compare_digest(got, secret)


def _player(player_id):
    key = f"dlvl:{player_id}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    try:
        p = faceit._get(f"/players/{player_id}")
    except faceit.FaceitError:
        return None
    cs2 = (p.get("games") or {}).get(faceit.GAME) or {}
    out = {"player_id": player_id, "nickname": p.get("nickname"),
           "level": cs2.get("skill_level"), "elo": cs2.get("faceit_elo")}
    cache.set(key, out, 10 * 60)
    return out


@csrf_exempt
def code(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Sign in first."}, status=401)
    prof = UserProfile.objects.filter(user=request.user).first()
    verified = bool(prof and prof.faceit_verified and prof.faceit_player_id)
    if request.method == "GET":
        return JsonResponse({"linked": DiscordLink.objects.filter(user=request.user).exists(),
                             "faceit_verified": verified})
    if request.method == "DELETE":
        DiscordLink.objects.filter(user=request.user).delete()
        return JsonResponse({"linked": False, "faceit_verified": verified})
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)
    if not verified:
        return JsonResponse({"error": "Link your FACEIT account above first."}, status=400)
    DiscordLinkCode.objects.filter(user=request.user).delete()
    DiscordLinkCode.objects.filter(expires_at__lt=timezone.now()).delete()
    for _ in range(10):
        c = "".join(secrets.choice(ALPHABET) for _ in range(6))
        if not DiscordLinkCode.objects.filter(code=c).exists():
            break
    row = DiscordLinkCode.objects.create(code=c, user=request.user, expires_at=timezone.now() + CODE_TTL)
    return JsonResponse({"code": row.code, "expires_at": row.expires_at.isoformat()})


@csrf_exempt
def claim(request):
    if request.method != "POST" or not _bot_ok(request):
        return JsonResponse({"error": "Unauthorized."}, status=401)
    b = _body(request)
    c = (b.get("code") or "").strip().upper()
    discord_id = str(b.get("discord_id") or "").strip()
    if not c or not discord_id.isdigit():
        return JsonResponse({"error": "Bad request."}, status=400)
    row = DiscordLinkCode.objects.filter(code=c, expires_at__gte=timezone.now()).select_related("user").first()
    if not row:
        return JsonResponse({"error": "That code is wrong or expired. Get a new one on faceit-lens.com/settings."}, status=404)
    user = row.user
    row.delete()
    prof = UserProfile.objects.filter(user=user).first()
    if not (prof and prof.faceit_verified and prof.faceit_player_id):
        return JsonResponse({"error": "This FaceitLens account has no verified FACEIT link."}, status=400)
    from . import privacy
    if privacy.is_suppressed(player_id=prof.faceit_player_id):
        return JsonResponse({"error": "This account can't be linked."}, status=400)
    DiscordLink.objects.filter(discord_id=discord_id).exclude(user=user).delete()
    DiscordLink.objects.update_or_create(user=user, defaults={"discord_id": discord_id})
    info = _player(prof.faceit_player_id) or {"player_id": prof.faceit_player_id,
                                               "nickname": prof.faceit_nickname, "level": None, "elo": None}
    return JsonResponse(info)


@csrf_exempt
def unlink(request):
    if request.method != "POST" or not _bot_ok(request):
        return JsonResponse({"error": "Unauthorized."}, status=401)
    discord_id = str(_body(request).get("discord_id") or "")
    DiscordLink.objects.filter(discord_id=discord_id).delete()
    return JsonResponse({"ok": True})


def levels(request):
    if not _bot_ok(request):
        return JsonResponse({"error": "Unauthorized."}, status=401)
    from . import privacy
    ids = [i for i in (request.GET.get("ids") or "").split(",") if i][:200]
    linked = set(UserProfile.objects.filter(
        faceit_player_id__in=ids, faceit_verified=True, user__discord_link__isnull=False,
    ).values_list("faceit_player_id", flat=True))
    out = {}
    for pid in ids:
        if pid not in linked or privacy.is_suppressed(player_id=pid):
            out[pid] = None
            continue
        out[pid] = _player(pid)
    return JsonResponse({"players": out})


@csrf_exempt
def state(request):
    """GET/POST /api/discord/state/ - the bot's own storage (tracked players, links)."""
    if not _bot_ok(request):
        return JsonResponse({"error": "Unauthorized."}, status=401)
    from .models import BotState
    if request.method == "GET":
        row = BotState.objects.filter(key="main").first()
        return JsonResponse({"data": row.data if row else None})
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)
    if len(request.body or b"") > 2_000_000:
        return JsonResponse({"error": "Too large."}, status=413)
    data = _body(request).get("data")
    if not isinstance(data, dict):
        return JsonResponse({"error": "Bad request."}, status=400)
    BotState.objects.update_or_create(key="main", defaults={"data": data})
    return JsonResponse({"ok": True})
