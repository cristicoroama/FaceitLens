"""
Cookieless traffic counting.

A visitor is `sha256(daily_salt + ip + user_agent)`, truncated. The salt is
regenerated every day and never reused, so the same person on two different days
produces two unrelated hashes and nothing here can be traced back to a person or
an IP. That is the same construction Plausible and GoatCounter use, and it is
why this needs no cookie and no consent banner.

Nothing in here is allowed to break a request: every path is wrapped, and a
failure means we lose a data point, never a response.
"""
import hashlib
import secrets

from django.core.cache import cache
from django.db.models import F
from django.utils import timezone

from .models import PathDay, VisitorDay, VisitorSalt

# Server-to-server and infrastructure traffic isn't a visitor.
SKIP_ROUTE_PREFIXES = ("api/allstar/webhook", "insights", "admin")
BOT_MARKERS = (
    "bot", "crawler", "spider", "slurp", "curl/", "wget/", "python-requests",
    "go-http-client", "axios/", "headlesschrome", "monitor", "uptime",
)
SALT_TTL = 36 * 60 * 60


def _client_ip(request):
    fwd = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def _daily_salt(day):
    """Today's salt, created once and reused. Cached to avoid a query per hit."""
    key = f"vsalt:{day.isoformat()}"
    salt = cache.get(key)
    if salt:
        return salt
    row, _ = VisitorSalt.objects.get_or_create(
        day=day, defaults={"salt": secrets.token_hex(32)}
    )
    cache.set(key, row.salt, SALT_TTL)
    return row.salt


def visitor_hash(request, day):
    raw = f"{_daily_salt(day)}|{_client_ip(request)}|{request.META.get('HTTP_USER_AGENT', '')}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def _is_bot(request):
    ua = request.META.get("HTTP_USER_AGENT", "").lower()
    if not ua:
        return True                      # no UA at all is a script, not a person
    return any(m in ua for m in BOT_MARKERS)


class TrafficMiddleware:
    """Counts unique visitors per day and request volume per URL route."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            self._record(request, response)
        except Exception:
            pass                         # analytics must never surface an error
        return response

    def _record(self, request, response):
        if request.method in ("OPTIONS", "HEAD"):
            return                       # CORS preflight and health probes
        match = getattr(request, "resolver_match", None)
        if match is None or not match.route:
            return                       # unrouted 404s aren't traffic
        route = match.route
        if route.startswith(SKIP_ROUTE_PREFIXES):
            return
        if _is_bot(request):
            return

        day = timezone.localdate()

        # One DB write per visitor per day, not per request: cache.add only
        # succeeds the first time this visitor is seen today.
        vh = visitor_hash(request, day)
        if cache.add(f"seen:{day.isoformat()}:{vh}", 1, SALT_TTL):
            VisitorDay.objects.get_or_create(day=day, visitor=vh)

        updated = PathDay.objects.filter(day=day, route=route).update(hits=F("hits") + 1)
        if not updated:
            PathDay.objects.get_or_create(day=day, route=route, defaults={"hits": 1})
