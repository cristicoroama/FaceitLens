"""
Allstar.gg Partner API client — auto-generated CS2 highlight clips.

Phase 1 (this file): fetch and display a player's existing clips.
Docs: https://developer.allstar.gg  (host: prt.allstar.gg, auth: X-Api-Key header)

Config comes from the environment (set on the server after partner onboarding):
    ALLSTAR_API_KEY      secret key (server-side)
    ALLSTAR_PUBLIC_KEY   semi-public key (allowed for /user/clips + /{game}/clips)
    ALLSTAR_PARTNER_ID   'platform' value for the iframe player
    ALLSTAR_USE_CASE     partner-specific useCase value for the iframe player

Everything degrades gracefully: if it isn't configured or Allstar errors/limits
(429), we simply return no clips instead of breaking the profile.
"""

import os

import requests
from django.core.cache import cache


HOST = "https://prt.allstar.gg"
API_KEY = os.environ.get("ALLSTAR_API_KEY", "")
PUBLIC_KEY = os.environ.get("ALLSTAR_PUBLIC_KEY", "")
PARTNER_ID = os.environ.get("ALLSTAR_PARTNER_ID", "")
USE_CASE = os.environ.get("ALLSTAR_USE_CASE", "")

# Phase 2 (clip generation via webhook):
#   ALLSTAR_WEBHOOK_URL   our public endpoint Allstar POSTs events to
#   ALLSTAR_WEBHOOK_AUTH  the exact Authorization header value we expect from Allstar
WEBHOOK_URL = os.environ.get("ALLSTAR_WEBHOOK_URL", "")
WEBHOOK_AUTH = os.environ.get("ALLSTAR_WEBHOOK_AUTH", "")

CLIPS_TTL = 300  # 5 min — clips take ~30 min to appear, no need to hammer the API


def is_configured():
    return bool(API_KEY or PUBLIC_KEY)


def can_generate():
    """Clip generation needs a secret key and a configured webhook."""
    return bool(API_KEY and WEBHOOK_AUTH)


def _read_key():
    # Prefer the public key for read-only clip fetches; fall back to the secret.
    return PUBLIC_KEY or API_KEY


def _normalize(clip):
    """Map an Allstar clip object to a compact, front-end-friendly dict."""
    cid = clip.get("_id") or clip.get("id")
    if not cid:
        return None
    extra = {
        d.get("key"): d.get("value")
        for d in (clip.get("additionalData") or [])
        if isinstance(d, dict)
    }
    return {
        "id": cid,
        "title": clip.get("clipTitle") or "Highlight",
        "clip_url": clip.get("clipUrl") or f"https://allstar.gg/iframe?clip={cid}",
        "thumb": clip.get("clipImageThumbURL") or clip.get("clipSnapshotURL"),
        "status": clip.get("status"),
        "on_demand": bool(clip.get("onDemand")),
        "length": clip.get("clipLength"),
        "created": clip.get("createdDate"),
        "map": extra.get("CS_Map"),
        "kills": extra.get("CS_Kill Count"),
        "weapons": extra.get("CS_Weapons"),
    }


def get_user_clips(user_id, limit=12):
    """Fetch a user's clips from Allstar. `user_id` is the SteamID64 for CS.

    Returns a list of normalized clip dicts (possibly empty). Never raises.
    """
    key = _read_key()
    if not key or not user_id:
        return []

    cache_key = f"allstar:clips:{user_id}:{limit}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        resp = requests.get(
            f"{HOST}/user/clips",
            headers={"X-Api-Key": key},
            params={"userId": user_id, "limit": limit},
            timeout=10,
        )
        if resp.status_code != 200:  # includes 429 (rate limited) -> just no clips
            return []
        payload = resp.json()
    except (requests.RequestException, ValueError):
        return []

    raw = (payload.get("data") or {}).get("clips") or []
    clips = [c for c in (_normalize(x) for x in raw) if c]
    cache.set(cache_key, clips, CLIPS_TTL)
    return clips


# --------------------------------------------------------------------------- #
# Phase 2: request a clip + receive webhook events
# --------------------------------------------------------------------------- #
def request_potg(demo_url, steamid="", match_id="", webhook_url=None):
    """Ask Allstar to make a CS play-of-the-game clip from a demo.

    :return: (ok: bool, info: dict|str) — info carries requestId on success.
    """
    if not API_KEY or not demo_url:
        return False, "not configured or missing demo url"
    body = {
        "demoUrl": demo_url,
        "webhookUrl": webhook_url or WEBHOOK_URL or None,
        "metadata": [
            {"key": "steamid", "value": str(steamid)},
            {"key": "faceit_match", "value": str(match_id)},
        ],
    }
    body = {k: v for k, v in body.items() if v}
    try:
        resp = requests.post(
            f"{HOST}/cs/clip/potg",
            headers={"X-Api-Key": API_KEY, "Content-Type": "application/json"},
            json=body,
            timeout=15,
        )
        if resp.status_code >= 400:
            return False, f"{resp.status_code}: {resp.text[:200]}"
        return True, (resp.json() if resp.content else {})
    except (requests.RequestException, ValueError) as exc:
        return False, str(exc)


def webhook_auth_ok(header_value):
    """True when the webhook Authorization header matches our configured secret."""
    return bool(WEBHOOK_AUTH) and header_value == WEBHOOK_AUTH


def parse_webhook_event(data):
    """Flatten an Allstar webhook event body into AllstarClip field values."""
    extra = {
        d.get("key"): d.get("value")
        for d in (data.get("additionalData") or [])
        if isinstance(d, dict)
    }
    return {
        "clip_id": data.get("_id") or "",
        "request_id": data.get("requestId") or "",
        "steamid": str(data.get("steamid") or ""),
        "status": data.get("status") or "",
        "on_demand": data.get("status") == "OnDemand" or bool(data.get("onDemand")),
        "title": data.get("clipTitle") or "",
        "clip_url": data.get("clipUrl") or "",
        "thumb": data.get("clipImageThumbURL") or "",
        "snapshot": data.get("clipSnapshotURL") or "",
        "demo_url": data.get("demoUrl") or "",
        "round_number": data.get("roundNumber"),
        "length": data.get("clipLength"),
        "cs_map": extra.get("CS_Map") or "",
        "kills": str(extra.get("CS_Kill Count") or ""),
        "weapons": extra.get("CS_Weapons") or "",
        "headshots": str(extra.get("CS_Headshots") or ""),
        "error_message": data.get("message") or "",
    }


def clip_to_dict(row):
    """AllstarClip model row -> the same shape the frontend expects from the API."""
    return {
        "id": row.clip_id or row.request_id,
        "title": row.title or "Highlight",
        "clip_url": row.clip_url or (f"https://allstar.gg/iframe?clip={row.clip_id}" if row.clip_id else ""),
        "thumb": row.thumb or row.snapshot,
        "status": row.status,
        "on_demand": row.on_demand,
        "length": row.length,
        "map": row.cs_map,
        "kills": row.kills,
        "weapons": row.weapons,
    }
