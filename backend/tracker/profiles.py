"""
User profiles: a stable handle, an editable identity, an uploaded avatar and a
public page at /u/<handle>.

Design notes worth keeping in mind:

* The FACEIT link is established at Steam sign-in (see auth.link_faceit_account)
  and is genuine proof of ownership, because Steam signs the SteamID64 and
  FACEIT tells us which account registered it. Users whose Steam isn't attached
  to FACEIT can still type a nickname here, but they don't get the badge.

* Avatars are stored in the database, not on disk. Render wipes the filesystem
  on every deploy, so disk-backed uploads would silently vanish. Each picture is
  re-encoded to a 256px WebP (~12KB), which keeps this comfortably small even
  with thousands of users.

* Everything a user can type is length-capped and stripped of control
  characters, and public profiles carry a report button feeding a queue in the
  Django admin.

Endpoints (wired under /api/):
  GET   /api/profile/me/              -> my profile
  PATCH /api/profile/me/              -> update name / bio / handle / privacy / faceit
  POST  /api/profile/avatar/          -> upload a picture (multipart or base64)
  DELETE/api/profile/avatar/          -> remove it
  GET   /api/profile/handle/?h=x      -> is this handle free?
  GET   /api/profile/<handle>/        -> the public profile (+ live FACEIT stats)
  POST  /api/profile/report/          -> flag a profile
  GET   /api/avatar/<handle>/         -> the picture itself
  GET   /api/profiles/                -> recently joined public profiles
"""
from __future__ import annotations

import base64
import binascii
import io
import json
import re

from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from .auth import (
    RESERVED_HANDLES,
    link_faceit_account,
    profile_payload,
    slugify_handle,
)
from .models import ProfileReport, UserProfile

MAX_UPLOAD_BYTES = 6 * 1024 * 1024   # reject anything silly before decoding
AVATAR_PX = 256

# Characters that would let someone break layout or fake a verified badge with
# zero-width / bidi trickery in their display name.
_CONTROL = re.compile("[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]")


def _clean(text: str, limit: int) -> str:
    return _CONTROL.sub("", (text or "")).strip()[:limit]


def _client_ip(request):
    fwd = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _body(request) -> dict:
    try:
        return json.loads(request.body or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


def _get_profile(request):
    """The signed-in user's profile, created if this is their first visit."""
    if not request.user.is_authenticated:
        return None
    profile = UserProfile.objects.filter(user=request.user).first()
    if profile is None:
        from .auth import ensure_profile
        steam = getattr(request.user, "steam_profile", None)
        profile = ensure_profile(
            request.user,
            steamid=steam.steamid if steam else "",
            persona=steam.name if steam else "",
        )
    return profile


def _handle_available(handle: str, exclude_user_id=None) -> bool:
    if handle in RESERVED_HANDLES or not (3 <= len(handle) <= 30):
        return False
    qs = UserProfile.objects.filter(handle__iexact=handle)
    if exclude_user_id:
        qs = qs.exclude(user_id=exclude_user_id)
    return not qs.exists()


# --------------------------------------------------------------------------
# My profile
# --------------------------------------------------------------------------

@csrf_exempt
def my_profile(request):
    """GET my profile, or PATCH to change it."""
    profile = _get_profile(request)
    if profile is None:
        return JsonResponse({"error": "Not signed in."}, status=401)

    if request.method == "GET":
        return JsonResponse({"profile": profile_payload(profile)})

    if request.method not in ("PATCH", "POST"):
        return JsonResponse({"error": "Method not allowed."}, status=405)

    body = _body(request)
    errors = {}

    if "handle" in body:
        wanted = slugify_handle(body.get("handle") or "")
        if wanted != profile.handle:
            if not (3 <= len(wanted) <= 30):
                errors["handle"] = "Between 3 and 30 characters (letters, numbers, - and _)."
            elif not _handle_available(wanted, exclude_user_id=request.user.id):
                errors["handle"] = "That handle is taken."
            else:
                profile.handle = wanted

    if "display_name" in body:
        profile.display_name = _clean(body.get("display_name"), 40)

    if "bio" in body:
        profile.bio = _clean(body.get("bio"), 200)

    if "is_public" in body:
        profile.is_public = bool(body.get("is_public"))

    # Unlinking is always allowed. Linking, however, is not something you can
    # do by typing a name: proving you own a FACEIT account requires signing in
    # through Steam or FACEIT (see faceit_oauth.py). Anything typed here would
    # be an unverifiable claim, and the old behaviour let anyone put "donk666"
    # on their page.
    if "faceit_nickname" in body:
        nick = _clean(body.get("faceit_nickname"), 100)
        if not nick:
            profile.faceit_nickname = ""
            profile.faceit_player_id = ""
            profile.faceit_verified = False
        elif nick.lower() != (profile.faceit_nickname or "").lower():
            errors["faceit_nickname"] = (
                "Link your FACEIT account by signing in with FACEIT — "
                "nicknames can't be claimed by typing them."
            )

    if errors:
        return JsonResponse({"errors": errors}, status=400)

    profile.save()
    return JsonResponse({"profile": profile_payload(profile), "ok": True})


@csrf_exempt
def relink_faceit(request):
    """Re-run the Steam -> FACEIT lookup on demand.

    The automatic link happens at sign-in, which leaves a gap: someone who
    connects Steam to their FACEIT account *after* signing up here would have
    to log out and back in for us to notice. This lets them just press a
    button instead.
    """
    profile = _get_profile(request)
    if profile is None:
        return JsonResponse({"error": "Not signed in."}, status=401)

    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)

    if profile.faceit_verified:
        return JsonResponse({
            "ok": True, "found": True, "already": True,
            "profile": profile_payload(profile),
        })

    steam = getattr(request.user, "steam_profile", None)
    if not steam or not steam.steamid:
        return JsonResponse({
            "ok": False, "found": False, "reason": "no_steam",
            "message": "Your account isn't signed in through Steam.",
        })

    from .auth import link_faceit_account

    found = link_faceit_account(profile, steam.steamid)
    if not found:
        return JsonResponse({
            "ok": False, "found": False, "reason": "not_found",
            "message": (
                "No FACEIT account is registered to your Steam ID. Connect Steam "
                "in your FACEIT settings, then try again."
            ),
        })

    # Someone else already proved they own this account — don't hand it over.
    clash = (
        UserProfile.objects
        .filter(faceit_player_id=profile.faceit_player_id, faceit_verified=True)
        .exclude(user_id=request.user.id)
        .exists()
    )
    if clash:
        return JsonResponse({
            "ok": False, "found": False, "reason": "taken",
            "message": "That FACEIT account is already linked to another profile.",
        })

    profile.save()
    return JsonResponse({
        "ok": True, "found": True, "already": False,
        "profile": profile_payload(profile),
    })


@csrf_exempt
def check_handle(request):
    """Live availability check while the user types."""
    wanted = slugify_handle(request.GET.get("h", ""))
    exclude = request.user.id if request.user.is_authenticated else None
    return JsonResponse({
        "handle": wanted,
        "available": _handle_available(wanted, exclude_user_id=exclude),
    })


# --------------------------------------------------------------------------
# Avatar
# --------------------------------------------------------------------------

def _encode_avatar(raw: bytes) -> bytes:
    """Re-encode arbitrary uploaded bytes into a small square WebP.

    Decoding through Pillow and re-encoding is also the security win here: we
    never store what the user actually sent, so an SVG with script in it or a
    polyglot file can't survive the round trip.
    """
    from PIL import Image

    img = Image.open(io.BytesIO(raw))
    img.load()

    # Flatten transparency onto a neutral dark background matching the theme,
    # so PNGs with alpha don't render as black blobs.
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        bg = Image.new("RGBA", img.size, (13, 15, 28, 255))
        img = Image.alpha_composite(bg, img)
    img = img.convert("RGB")

    # Centre-crop to a square, then resize.
    w, h = img.size
    side = min(w, h)
    img = img.crop(((w - side) // 2, (h - side) // 2,
                    (w - side) // 2 + side, (h - side) // 2 + side))
    img = img.resize((AVATAR_PX, AVATAR_PX), Image.LANCZOS)

    out = io.BytesIO()
    img.save(out, format="WEBP", quality=82, method=4)
    return out.getvalue()


@csrf_exempt
def avatar_upload(request):
    """POST a picture (multipart 'avatar' or JSON {image: dataURL}); DELETE to clear."""
    profile = _get_profile(request)
    if profile is None:
        return JsonResponse({"error": "Not signed in."}, status=401)

    if request.method == "DELETE":
        profile.avatar = None
        profile.avatar_updated = None
        profile.save(update_fields=["avatar", "avatar_updated", "updated_at"])
        return JsonResponse({"ok": True, "profile": profile_payload(profile)})

    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)

    raw = b""
    upload = request.FILES.get("avatar")
    if upload is not None:
        if upload.size > MAX_UPLOAD_BYTES:
            return JsonResponse({"error": "Image too large (max 6MB)."}, status=400)
        raw = upload.read()
    else:
        data_url = (_body(request).get("image") or "").strip()
        if "," in data_url:
            data_url = data_url.split(",", 1)[1]
        if not data_url:
            return JsonResponse({"error": "No image supplied."}, status=400)
        if len(data_url) > MAX_UPLOAD_BYTES * 4 // 3 + 1024:
            return JsonResponse({"error": "Image too large (max 6MB)."}, status=400)
        try:
            raw = base64.b64decode(data_url, validate=True)
        except (binascii.Error, ValueError):
            return JsonResponse({"error": "Could not read that image."}, status=400)

    if not raw:
        return JsonResponse({"error": "No image supplied."}, status=400)

    try:
        encoded = _encode_avatar(raw)
    except ImportError:
        return JsonResponse(
            {"error": "Image processing unavailable on the server."}, status=503
        )
    except Exception:
        return JsonResponse(
            {"error": "That file doesn't look like an image."}, status=400
        )

    profile.avatar = encoded
    profile.avatar_updated = timezone.now()
    profile.save(update_fields=["avatar", "avatar_updated", "updated_at"])
    return JsonResponse({"ok": True, "profile": profile_payload(profile)})


def avatar_serve(request, handle):
    """Serve the stored WebP. Immutable + cache-busted by ?v= on the URL."""
    profile = UserProfile.objects.filter(handle__iexact=handle).first()
    if profile is None or not profile.avatar:
        return HttpResponse(status=404)

    data = profile.avatar
    if isinstance(data, memoryview):     # psycopg returns memoryview
        data = data.tobytes()

    resp = HttpResponse(data, content_type="image/webp")
    resp["Cache-Control"] = "public, max-age=31536000, immutable"
    resp["Content-Length"] = str(len(data))
    return resp


# --------------------------------------------------------------------------
# Public profile
# --------------------------------------------------------------------------

def _live_faceit(profile: UserProfile) -> dict | None:
    """A compact live snapshot of the linked FACEIT account.

    Only ever returned for VERIFIED links. An unverified link is just a claim
    someone typed, and rendering another player's ELO, avatar and stats on
    their page is impersonation whether or not a badge says "unverified" — most
    visitors don't read badges. Verified means Steam or FACEIT itself vouched
    for the link.
    """
    if not profile.faceit_nickname or not profile.faceit_verified:
        return None
    try:
        from .faceit import get_player_by_nickname
        player = get_player_by_nickname(profile.faceit_nickname) or {}
    except Exception:
        return None
    if not player:
        return None

    cs2 = (player.get("games") or {}).get("cs2") or {}

    # Free data point: someone opened this profile, so we know today's ELO.
    from .auth import record_elo_snapshot
    record_elo_snapshot(player.get("player_id"), cs2.get("faceit_elo"))

    stats = None
    try:
        from .faceit import get_player_stats
        raw = (get_player_stats(player.get("player_id")) or {}).get("lifetime") or {}
        stats = {
            "matches": raw.get("Matches"),
            "winrate": raw.get("Win Rate %"),
            "kd": raw.get("Average K/D Ratio"),
            "hs": raw.get("Average Headshots %"),
        }
    except Exception:
        pass

    return {
        "nickname": player.get("nickname"),
        "player_id": player.get("player_id"),
        "avatar": player.get("avatar") or "",
        "country": player.get("country") or "",
        "level": cs2.get("skill_level"),
        "elo": cs2.get("faceit_elo"),
        "stats": stats,
    }


def public_profile(request, handle):
    """The page behind /u/<handle>."""
    profile = UserProfile.objects.filter(handle__iexact=handle).first()

    # Convenience: /u/<faceit-nickname> finds the owner too, so old links and
    # guessed URLs land somewhere useful instead of a 404.
    if profile is None:
        profile = UserProfile.objects.filter(faceit_nickname__iexact=handle).first()
        if profile is not None and profile.is_public:
            return JsonResponse({
                "redirect": profile.handle,
                "profile": profile_payload(profile),
            })

    if profile is None:
        return JsonResponse({"error": "No such profile."}, status=404)

    is_owner = request.user.is_authenticated and profile.user_id == request.user.id
    if not profile.is_public and not is_owner:
        return JsonResponse({"error": "This profile is private."}, status=403)

    payload = profile_payload(profile)
    payload["joined"] = profile.created_at.date().isoformat()
    payload["is_owner"] = is_owner
    payload["faceit"] = _live_faceit(profile)

    # Their watchlist doubles as "players I follow" on the public page.
    from .models import Favorite
    payload["favorites"] = list(
        Favorite.objects.filter(user=profile.user)
        .order_by("-created_at")
        .values_list("nickname", flat=True)[:12]
    )
    return JsonResponse({"profile": payload})


def profile_directory(request):
    """Recently joined public profiles — a small 'community' feed."""
    rows = (
        UserProfile.objects.filter(is_public=True)
        .exclude(faceit_nickname="")
        .order_by("-created_at")[:40]
    )
    return JsonResponse({
        "profiles": [
            {
                "handle": p.handle,
                "name": p.name,
                "bio": p.bio,
                "faceit_nickname": p.faceit_nickname,
                "verified": p.faceit_verified,
                "avatar": (
                    f"/api/avatar/{p.handle}/" if p.has_avatar else None
                ),
            }
            for p in rows
        ]
    })


# --------------------------------------------------------------------------
# ELO progress
# --------------------------------------------------------------------------

# FACEIT skill-level thresholds (level 1 starts at 100; level 10 is open-ended).
LEVEL_FLOORS = [100, 501, 751, 901, 1051, 1201, 1351, 1531, 1751, 2001]


def _level_for(elo: int) -> int:
    level = 1
    for i, floor in enumerate(LEVEL_FLOORS, start=1):
        if elo >= floor:
            level = i
    return level


def _change_over(points, days):
    """ELO gained since `days` ago, using the oldest reading in that window.

    Returns None when there's no reading old enough — better to show nothing
    than to invent a change from a single data point.
    """
    if len(points) < 2:
        return None
    from datetime import date, timedelta
    cutoff = date.today() - timedelta(days=days)
    window = [p for p in points if p["d"] >= cutoff]
    if len(window) < 2:
        return None
    return window[-1]["elo"] - window[0]["elo"]


def elo_progress(request, handle):
    """Long-run ELO history for a member, plus the numbers worth calling out.

    This is the payoff of having accounts: because members are snapshotted
    every day, this is a genuine timeline, not the usual reconstruction from
    the last 30 matches that every tracker shows.
    """
    profile = UserProfile.objects.filter(handle__iexact=handle).first()
    if profile is None:
        return JsonResponse({"error": "No such profile."}, status=404)

    is_owner = request.user.is_authenticated and profile.user_id == request.user.id
    if not profile.is_public and not is_owner:
        return JsonResponse({"error": "This profile is private."}, status=403)

    if not profile.faceit_player_id:
        return JsonResponse({"points": [], "stats": None, "tracking": False})

    from .models import EloSnapshot
    rows = list(
        EloSnapshot.objects.filter(player_id=profile.faceit_player_id)
        .order_by("date")
        .values_list("date", "elo")
    )
    points = [{"d": d, "elo": e} for d, e in rows]
    series = [{"date": d.isoformat(), "elo": e} for d, e in rows]

    if not points:
        return JsonResponse({"points": [], "stats": None, "tracking": True})

    current = points[-1]["elo"]
    peak = max(points, key=lambda p: p["elo"])
    low = min(points, key=lambda p: p["elo"])

    # Biggest single-day move, and the current run of non-losing days.
    best_day = worst_day = None
    streak = 0
    for prev, cur in zip(points, points[1:]):
        delta = cur["elo"] - prev["elo"]
        if best_day is None or delta > best_day["delta"]:
            best_day = {"date": cur["d"].isoformat(), "delta": delta}
        if worst_day is None or delta < worst_day["delta"]:
            worst_day = {"date": cur["d"].isoformat(), "delta": delta}
    for prev, cur in zip(reversed(points[:-1]), reversed(points[1:])):
        if cur["elo"] >= prev["elo"]:
            streak += 1
        else:
            break

    level = _level_for(current)
    next_floor = LEVEL_FLOORS[level] if level < 10 else None

    stats = {
        "current": current,
        "level": level,
        "change_7d": _change_over(points, 7),
        "change_30d": _change_over(points, 30),
        "change_90d": _change_over(points, 90),
        "peak": {"elo": peak["elo"], "date": peak["d"].isoformat()},
        "low": {"elo": low["elo"], "date": low["d"].isoformat()},
        "best_day": best_day if best_day and best_day["delta"] > 0 else None,
        "worst_day": worst_day if worst_day and worst_day["delta"] < 0 else None,
        "streak": streak,
        "days_tracked": len(points),
        "since": points[0]["d"].isoformat(),
        "to_next_level": (next_floor - current) if next_floor else None,
        "next_level": (level + 1) if next_floor else None,
    }

    return JsonResponse({
        "points": series,
        "stats": stats,
        "tracking": True,
        "nickname": profile.faceit_nickname,
    })


@csrf_exempt
def report_profile(request):
    """Flag a profile for review. Lands in the Django admin queue."""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)

    body = _body(request)
    handle = slugify_handle(body.get("handle") or "")
    profile = UserProfile.objects.filter(handle__iexact=handle).first()
    if profile is None:
        return JsonResponse({"error": "No such profile."}, status=404)

    reason = body.get("reason") or "other"
    valid = {c[0] for c in ProfileReport.REASON_CHOICES}
    if reason not in valid:
        reason = "other"

    ip = _client_ip(request)
    # One open report per person per profile is plenty; this stops someone
    # spamming the queue with a hundred reports on a rival.
    already = ProfileReport.objects.filter(
        profile=profile, reporter_ip=ip, handled=False
    ).exists()
    if not already:
        ProfileReport.objects.create(
            profile=profile,
            reason=reason,
            detail=_clean(body.get("detail"), 300),
            reporter_ip=ip,
        )
    return JsonResponse({"ok": True})
