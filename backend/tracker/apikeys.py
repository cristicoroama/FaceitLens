import functools
import os

from django.core.cache import cache
from django.db.models import F
from django.http import JsonResponse
from django.utils import timezone

from .models import ApiKey
from .profiles import _client_ip

API_KEYS_ENFORCED = os.environ.get("API_KEYS_ENFORCED", "1") not in ("0", "false", "False")
KEY_CACHE_TTL = 5 * 60
USAGE_FLUSH_EVERY = 25

DOCS_URL = "https://faceit-lens.com/docs"
REQUEST_URL = "https://faceit-lens.com/support?category=api"


SITE_ORIGINS = {
    o.strip().rstrip("/")
    for o in os.environ.get("CORS_ORIGINS", "").split(",")
    if o.strip()
}


def _from_own_site(request):
    origin = (request.META.get("HTTP_ORIGIN") or "").strip().rstrip("/")
    if origin:
        return origin in SITE_ORIGINS
    referer = (request.META.get("HTTP_REFERER") or "").strip()
    if referer:
        return any(referer.startswith(o + "/") or referer == o for o in SITE_ORIGINS)
    return False


def _presented_key(request):
    header = request.META.get("HTTP_X_API_KEY", "").strip()
    if header:
        return header
    auth = request.META.get("HTTP_AUTHORIZATION", "").strip()
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return (request.GET.get("key") or "").strip()


def _load_key(raw):
    if not raw or len(raw) > 128:
        return None
    cache_key = f"apikey:{raw}"
    hit = cache.get(cache_key)
    if hit is not None:
        return hit or None
    obj = ApiKey.objects.filter(key=raw, active=True).first()
    if not obj:
        cache.set(cache_key, False, 60)
        return None
    payload = {
        "id": obj.id,
        "label": obj.label,
        "rate_per_minute": obj.rate_per_minute,
        "rate_per_day": obj.rate_per_day,
    }
    cache.set(cache_key, payload, KEY_CACHE_TTL)
    return payload


def _deny(message, status=401, **extra):
    body = {"error": message, "docs": DOCS_URL, "request_access": REQUEST_URL}
    body.update(extra)
    return JsonResponse(body, status=status)


def _count(bucket, limit, window):
    try:
        used = cache.incr(bucket)
    except ValueError:
        cache.set(bucket, 1, window)
        used = 1
    return used, used > limit


def _flush_usage(key_id):
    counter = f"apikey:uses:{key_id}"
    try:
        pending = cache.incr(counter)
    except ValueError:
        cache.set(counter, 1, 24 * 60 * 60)
        pending = 1
    if pending >= USAGE_FLUSH_EVERY:
        cache.set(counter, 0, 24 * 60 * 60)
        ApiKey.objects.filter(id=key_id).update(
            request_count=F("request_count") + pending, last_used_at=timezone.now()
        )


def require_api_key(view):
    @functools.wraps(view)
    def wrapped(request, *args, **kwargs):
        if not API_KEYS_ENFORCED or _from_own_site(request):
            return view(request, *args, **kwargs)

        raw = _presented_key(request)
        if not raw:
            return _deny(
                "This endpoint needs an API key. Send it as the X-API-Key header.",
                status=401,
            )

        key = _load_key(raw)
        if not key:
            return _deny("That API key is not valid or has been revoked.", status=401)

        minute_used, over_minute = _count(
            f"apikey:rpm:{key['id']}:{int(timezone.now().timestamp() // 60)}",
            key["rate_per_minute"],
            120,
        )
        if over_minute:
            return _deny(
                "Rate limit reached for this key (per minute).",
                status=429,
                limit=key["rate_per_minute"],
                window="minute",
            )

        day_used, over_day = _count(
            f"apikey:rpd:{key['id']}:{timezone.now().date().isoformat()}",
            key["rate_per_day"],
            26 * 60 * 60,
        )
        if over_day:
            return _deny(
                "Daily quota reached for this key.",
                status=429,
                limit=key["rate_per_day"],
                window="day",
            )

        request.api_key = key
        _flush_usage(key["id"])

        response = view(request, *args, **kwargs)
        try:
            response["X-RateLimit-Limit"] = str(key["rate_per_minute"])
            response["X-RateLimit-Remaining"] = str(max(0, key["rate_per_minute"] - minute_used))
            response["X-RateLimit-Daily-Remaining"] = str(max(0, key["rate_per_day"] - day_used))
        except (TypeError, AttributeError):
            pass
        return response

    return wrapped
