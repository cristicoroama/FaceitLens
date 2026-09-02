import hashlib
import json
import re
import time

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .models import SupportTicket, TicketMessage
from .profiles import _client_ip

TICKETS_PER_IP_PER_DAY = 5
TICKET_WINDOW = 24 * 60 * 60
MIN_FORM_SECONDS = 4
MAX_BODY = 5000
MAX_SUBJECT = 160
LOOKUP_PER_IP_PER_HOUR = 20

VALID_CATEGORIES = {c[0] for c in SupportTicket.CATEGORY}

_URL_RE = re.compile(r"https?://", re.I)


def _ip_hash(request):
    ip = _client_ip(request) or ""
    return hashlib.sha256(f"support|{ip}".encode()).hexdigest()[:32]


def _spam_score(subject, body, category):
    score = 0
    text = f"{subject}\n{body}"
    links = len(_URL_RE.findall(text))
    if category != "api" and links >= 3:
        score += 2
    elif links >= 6:
        score += 2
    if len(body) < 25:
        score += 1
    letters = [c for c in text if c.isalpha()]
    if letters and sum(1 for c in letters if c.isupper()) / len(letters) > 0.6:
        score += 1
    if re.search(r"(.)\1{9,}", text):
        score += 1
    return score


@csrf_exempt
@require_POST
def create_ticket(request):
    try:
        data = json.loads(request.body or "{}")
    except ValueError:
        return JsonResponse({"error": "Send JSON."}, status=400)

    if (data.get("website") or "").strip():
        return JsonResponse({"ref": "FL-000000", "status": "open"}, status=201)

    started = data.get("started_at")
    try:
        elapsed = time.time() - (float(started) / 1000.0)
    except (TypeError, ValueError):
        elapsed = MIN_FORM_SECONDS
    if elapsed < MIN_FORM_SECONDS:
        return JsonResponse(
            {"error": "That was too quick — take a moment and send it again."},
            status=429,
        )

    email = (data.get("email") or "").strip().lower()
    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({"error": "Enter a valid email address."}, status=400)

    subject = (data.get("subject") or "").strip()[:MAX_SUBJECT]
    body = (data.get("body") or "").strip()[:MAX_BODY]
    category = (data.get("category") or "support").strip()
    if category not in VALID_CATEGORIES:
        category = "support"
    if len(subject) < 4:
        return JsonResponse({"error": "Give the ticket a subject."}, status=400)
    if len(body) < 15:
        return JsonResponse({"error": "Describe the problem in a bit more detail."}, status=400)

    ip_hash = _ip_hash(request)
    key = f"support:rate:{ip_hash}"
    try:
        used = cache.incr(key)
    except ValueError:
        cache.set(key, 1, TICKET_WINDOW)
        used = 1
    if used > TICKETS_PER_IP_PER_DAY:
        return JsonResponse(
            {"error": "You've opened several tickets today. Reply to an existing one instead."},
            status=429,
            headers={"Retry-After": str(TICKET_WINDOW)},
        )

    if _spam_score(subject, body, category) >= 3:
        return JsonResponse(
            {"error": "That looks like spam to our filter. Rephrase it and try again."},
            status=400,
        )

    rpm = data.get("api_expected_rpm")
    try:
        rpm = max(0, min(100000, int(rpm))) if rpm not in (None, "") else None
    except (TypeError, ValueError):
        rpm = None

    ticket = SupportTicket.objects.create(
        email=email,
        category=category,
        subject=subject,
        body=body,
        api_use_case=(data.get("api_use_case") or "").strip()[:MAX_BODY] if category == "api" else "",
        api_expected_rpm=rpm if category == "api" else None,
        api_project_url=(data.get("api_project_url") or "").strip()[:200] if category == "api" else "",
        ip_hash=ip_hash,
        user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:300],
    )
    return JsonResponse(
        {"ref": ticket.ref, "status": ticket.status, "created_at": ticket.created_at.isoformat()},
        status=201,
    )


@require_GET
def lookup_ticket(request):
    ref = (request.GET.get("ref") or "").strip().upper()
    email = (request.GET.get("email") or "").strip().lower()
    if not ref or not email:
        return JsonResponse({"error": "Both a ticket reference and the email are required."}, status=400)

    key = f"support:lookup:{_ip_hash(request)}"
    try:
        used = cache.incr(key)
    except ValueError:
        cache.set(key, 1, 60 * 60)
        used = 1
    if used > LOOKUP_PER_IP_PER_HOUR:
        return JsonResponse({"error": "Too many lookups. Try again later."}, status=429)

    ticket = SupportTicket.objects.filter(ref=ref, email=email).first()
    if not ticket:
        return JsonResponse({"error": "No ticket matches that reference and email."}, status=404)

    return JsonResponse({
        "ref": ticket.ref,
        "subject": ticket.subject,
        "category": ticket.category,
        "status": ticket.status,
        "created_at": ticket.created_at.isoformat(),
        "updated_at": ticket.updated_at.isoformat(),
        "body": ticket.body,
        "messages": [
            {
                "body": m.body,
                "from_staff": m.from_staff,
                "created_at": m.created_at.isoformat(),
            }
            for m in ticket.messages.all()
        ],
        "api_keys": [
            {"key": k.key, "label": k.label, "rate_per_minute": k.rate_per_minute}
            for k in ticket.api_keys.filter(active=True)
        ],
    })


@csrf_exempt
@require_POST
def reply_ticket(request):
    try:
        data = json.loads(request.body or "{}")
    except ValueError:
        return JsonResponse({"error": "Send JSON."}, status=400)

    ref = (data.get("ref") or "").strip().upper()
    email = (data.get("email") or "").strip().lower()
    body = (data.get("body") or "").strip()[:MAX_BODY]
    if len(body) < 2:
        return JsonResponse({"error": "Write something first."}, status=400)

    ticket = SupportTicket.objects.filter(ref=ref, email=email).first()
    if not ticket:
        return JsonResponse({"error": "No ticket matches that reference and email."}, status=404)
    if ticket.status in ("resolved", "rejected"):
        return JsonResponse({"error": "This ticket is closed. Open a new one."}, status=409)

    key = f"support:reply:{_ip_hash(request)}"
    try:
        used = cache.incr(key)
    except ValueError:
        cache.set(key, 1, 60 * 60)
        used = 1
    if used > 20:
        return JsonResponse({"error": "Too many replies. Try again later."}, status=429)

    TicketMessage.objects.create(ticket=ticket, body=body, from_staff=False)
    if ticket.status == "waiting":
        ticket.status = "open"
        ticket.save(update_fields=["status", "updated_at"])
    return JsonResponse({"ok": True, "status": ticket.status}, status=201)
