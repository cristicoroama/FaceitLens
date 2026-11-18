"""FACEIT webhook receiver: POST /api/webhooks/faceit/?token=<FACEIT_WEBHOOK_TOKEN>

Configure in the FACEIT developer portal (App → Webhooks → User subscription)
with events match_status_configuring, match_status_ready, match_status_finished,
match_status_aborted, match_status_cancelled. Add the same token either as the
`token` query parameter in the callback URL or as a custom header
`X-Webhook-Token`. The player list comes from `manage.py faceit_webhook_ids`.
"""
import hmac
import json
import os
import time
from datetime import timedelta

from django.core.cache import cache
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from .models import LiveMatchState

STARTING = {"match_status_configuring", "match_object_created"}
LIVE = {"match_status_ready"}
DONE = {"match_status_finished", "match_status_aborted", "match_status_cancelled"}
MAX_AGE = timedelta(hours=2)


def _authorized(request):
    secret = os.environ.get("FACEIT_WEBHOOK_TOKEN", "")
    if not secret:
        return False
    got = request.headers.get("X-Webhook-Token") or request.GET.get("token") or ""
    return hmac.compare_digest(got, secret)


def _players(payload):
    out = []
    for t in payload.get("teams") or []:
        for p in t.get("roster") or []:
            pid = p.get("id") or p.get("player_id")
            if pid:
                out.append(pid)
    return out


def _card(event, payload):
    teams = payload.get("teams") or []
    entity = payload.get("entity") or {}
    started = payload.get("started_at") or payload.get("created_at")
    ts = None
    if isinstance(started, (int, float)):
        ts = int(started // 1000 if started > 10 ** 11 else started)
    elif isinstance(started, str):
        try:
            from datetime import datetime
            ts = int(datetime.fromisoformat(started.replace("Z", "+00:00")).timestamp())
        except ValueError:
            ts = None
    mid = payload.get("id") or payload.get("match_id")
    return {
        "match_id": mid,
        "state": "live" if event in LIVE else "starting",
        "map": None,
        "competition": entity.get("name"),
        "teams": [t.get("name") for t in teams if t.get("name")],
        "started_at": ts or int(time.time()),
        "faceit_url": f"https://www.faceit.com/en/cs2/room/{mid}" if mid else None,
    }


@csrf_exempt
def faceit_webhook(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only."}, status=405)
    if not _authorized(request):
        return JsonResponse({"error": "Unauthorized."}, status=401)
    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)
    event = body.get("event") or ""
    payload = body.get("payload") or {}
    mid = payload.get("id") or payload.get("match_id")
    players = _players(payload)
    if not mid or not players:
        return JsonResponse({"ok": True, "ignored": True})
    if event in DONE:
        LiveMatchState.objects.filter(match_id=mid).delete()
        for pid in players:
            cache.delete(f"live2:{pid}")
        return JsonResponse({"ok": True})
    if event in STARTING or event in LIVE:
        card = _card(event, payload)
        for pid in players:
            LiveMatchState.objects.update_or_create(
                player_id=pid, match_id=mid, defaults={"state": card["state"], "payload": card},
            )
            cache.delete(f"live2:{pid}")
    LiveMatchState.objects.filter(updated_at__lt=timezone.now() - MAX_AGE).delete()
    return JsonResponse({"ok": True})


def webhook_live(player_id):
    row = (LiveMatchState.objects
           .filter(player_id=player_id, updated_at__gte=timezone.now() - MAX_AGE)
           .order_by("-updated_at").first())
    return row.payload if row else None
