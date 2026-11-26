from __future__ import annotations

import gc
import re
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import DemoParseRequest, ParsedMatch

MATCH_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9-]{7,63}$")
MAX_ATTEMPTS = 3
STALE_PROCESSING_MINUTES = 30
QUEUE_CAPACITY = 200
ACTIVE_STATUSES = ("queued", "processing")


def valid_match_id(match_id: str) -> bool:
    return bool(MATCH_ID_RE.match(match_id or ""))


def latest_request(match_id: str):
    return DemoParseRequest.objects.filter(match_id=match_id).order_by("-created_at").first()


def queue_position(req) -> int | None:
    if req is None or req.status != "queued":
        return None
    return DemoParseRequest.objects.filter(status="queued", created_at__lt=req.created_at).count() + 1


def request_payload(req) -> dict:
    if req is None:
        return {"status": "none"}
    return {
        "status": req.status,
        "error": req.error or None,
        "attempts": req.attempts,
        "position": queue_position(req),
        "requested_at": req.created_at.isoformat() if req.created_at else None,
        "started_at": req.started_at.isoformat() if req.started_at else None,
        "finished_at": req.finished_at.isoformat() if req.finished_at else None,
    }


def queue_full() -> bool:
    return DemoParseRequest.objects.filter(status="queued").count() >= QUEUE_CAPACITY


def enqueue(match_id: str, ip: str = "", user=None):
    if ParsedMatch.objects.filter(match_id=match_id).exists():
        return None, False
    with transaction.atomic():
        existing = (
            DemoParseRequest.objects.select_for_update()
            .filter(match_id=match_id).order_by("-created_at").first()
        )
        if existing and existing.status in ACTIVE_STATUSES:
            return existing, False
        if existing and existing.status == "failed":
            if existing.attempts >= MAX_ATTEMPTS:
                return existing, False
            existing.status = "queued"
            existing.error = ""
            existing.save(update_fields=["status", "error", "updated_at"])
            return existing, True
        req = DemoParseRequest.objects.create(
            match_id=match_id,
            requested_ip=(ip or "")[:64],
            requested_by=user if getattr(user, "is_authenticated", False) else None,
        )
        return req, True


def requeue_stale() -> int:
    cutoff = timezone.now() - timedelta(minutes=STALE_PROCESSING_MINUTES)
    return DemoParseRequest.objects.filter(status="processing", started_at__lt=cutoff).update(
        status="queued"
    )


def claim_next():
    for req in DemoParseRequest.objects.filter(status="queued").order_by("created_at")[:10]:
        claimed = DemoParseRequest.objects.filter(pk=req.pk, status="queued").update(
            status="processing", started_at=timezone.now()
        )
        if claimed:
            req.refresh_from_db()
            return req
    return None


def process(req, parse_fn, store_fn) -> bool:
    req.attempts += 1
    req.save(update_fields=["attempts", "updated_at"])
    if ParsedMatch.objects.filter(match_id=req.match_id).exists():
        _finish(req, "done")
        return True
    try:
        data = parse_fn(req.match_id)
        store_fn(data)
    except Exception as exc:
        _finish(req, "failed", f"{type(exc).__name__}: {exc}"[:500])
        return False
    finally:
        gc.collect()
    _finish(req, "done")
    return True


def _finish(req, status, error=""):
    req.status = status
    req.error = error
    req.finished_at = timezone.now()
    req.save(update_fields=["status", "error", "finished_at", "updated_at"])
