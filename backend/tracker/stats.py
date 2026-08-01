"""
Internal stats dashboard — staff only, server-rendered at /insights/.

A note on what these numbers can and cannot say. Most of the timestamps in this
project are *state*, not *events*: `User.last_login` and
`TrackedPlayer.last_searched` are overwritten every time they happen, so the
history is gone. Only columns written once (`date_joined`, `added_at`,
`created_at`, `detected_at`) can be counted per day and be correct.

So the daily charts below use write-once columns only, and anything derived from
an overwritten column is labelled "last seen", never "count". Counting real
logins or searches over time needs an append-only event row per occurrence —
see the note rendered at the bottom of the page.
"""
from datetime import timedelta

from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth.models import User
from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.shortcuts import render
from django.utils import timezone

from .models import (
    BanRecord,
    Favorite,
    FeedbackItem,
    GameScore,
    PathDay,
    TrackedPlayer,
    UserProfile,
    VisitorDay,
)

DAYS = 30


def _daily(qs, field, days=DAYS):
    """Rows per day for a write-once timestamp column, oldest first.

    Days with no rows are filled with zero so the chart keeps an even x-axis
    instead of silently collapsing quiet days together.
    """
    since = timezone.now() - timedelta(days=days - 1)
    rows = (
        qs.filter(**{f"{field}__gte": since})
        .annotate(d=TruncDate(field))
        .values("d")
        .annotate(n=Count("id"))
    )
    counts = {r["d"]: r["n"] for r in rows if r["d"]}

    today = timezone.localdate()
    series = []
    for i in range(days - 1, -1, -1):
        day = today - timedelta(days=i)
        series.append({"date": day, "n": counts.get(day, 0)})
    return series


def _daily_preaggregated(qs, value_field=None, days=DAYS):
    """Same shape as _daily(), for tables that already store one row per day.

    `value_field` sums a column (PathDay.hits); leaving it None counts rows
    (VisitorDay, one row per unique visitor per day).
    """
    today = timezone.localdate()
    since = today - timedelta(days=days - 1)
    rows = qs.filter(day__gte=since).values("day")
    rows = rows.annotate(n=Sum(value_field)) if value_field else rows.annotate(n=Count("id"))
    counts = {r["day"]: r["n"] or 0 for r in rows}

    return [
        {"date": today - timedelta(days=i), "n": counts.get(today - timedelta(days=i), 0)}
        for i in range(days - 1, -1, -1)
    ]


def _chart(series):
    """Attach a 0-100 bar height to each point, scaled to the busiest day."""
    peak = max((p["n"] for p in series), default=0)
    for p in series:
        p["pct"] = round(p["n"] * 100 / peak) if peak else 0
    return {
        "points": series,
        "peak": peak,
        "total": sum(p["n"] for p in series),
        # end labels come from here so the template doesn't index the list
        "first_date": series[0]["date"] if series else None,
        "last_date": series[-1]["date"] if series else None,
    }


@staff_member_required
def dashboard(request):
    now = timezone.now()
    d1, d7, d30 = (now - timedelta(days=n) for n in (1, 7, 30))

    totals = [
        ("Steam accounts", User.objects.count()),
        ("Public profiles", UserProfile.objects.count()),
        ("Players tracked", TrackedPlayer.objects.count()),
        ("Favorites", Favorite.objects.count()),
        ("Feedback items", FeedbackItem.objects.count()),
        ("Bans recorded", BanRecord.objects.count()),
    ]

    traffic = [
        ("Unique visitors today",
         VisitorDay.objects.filter(day=timezone.localdate()).count()),
        ("Unique visitors, 30d",
         VisitorDay.objects.filter(day__gte=(now - timedelta(days=30)).date())
         .values("visitor").distinct().count()),
        ("Requests, 30d",
         PathDay.objects.filter(day__gte=(now - timedelta(days=30)).date())
         .aggregate(n=Sum("hits"))["n"] or 0),
    ]

    # "Seen" rather than "logged in": last_login is overwritten, so this counts
    # distinct users whose most recent visit falls in the window, not visits.
    seen = [
        ("24 hours", User.objects.filter(last_login__gte=d1).count()),
        ("7 days", User.objects.filter(last_login__gte=d7).count()),
        ("30 days", User.objects.filter(last_login__gte=d30).count()),
    ]

    charts = [
        ("Unique visitors", _chart(_daily_preaggregated(VisitorDay.objects.all()))),
        ("Requests", _chart(_daily_preaggregated(PathDay.objects.all(), "hits"))),
        ("New Steam accounts", _chart(_daily(User.objects.all(), "date_joined"))),
        ("Players searched for the first time",
         _chart(_daily(TrackedPlayer.objects.all(), "added_at"))),
        ("Favorites added", _chart(_daily(Favorite.objects.all(), "created_at"))),
        ("Feedback posted", _chart(_daily(FeedbackItem.objects.all(), "created_at"))),
        ("Game scores submitted", _chart(_daily(GameScore.objects.all(), "created_at"))),
        ("Bans detected", _chart(_daily(BanRecord.objects.all(), "detected_at"))),
    ]

    recent_users = (
        User.objects.select_related("profile", "steam_profile")
        .filter(last_login__isnull=False)
        .order_by("-last_login")[:20]
    )
    newest_users = User.objects.order_by("-date_joined")[:20]
    hot_players = (
        TrackedPlayer.objects.filter(last_searched__isnull=False)
        .order_by("-last_searched")[:20]
    )

    top_routes = (
        PathDay.objects.filter(day__gte=(now - timedelta(days=30)).date())
        .values("route")
        .annotate(n=Sum("hits"))
        .order_by("-n")[:15]
    )

    return render(request, "tracker/stats.html", {
        "totals": totals,
        "traffic": traffic,
        "top_routes": top_routes,
        "seen": seen,
        "charts": charts,
        "recent_users": recent_users,
        "newest_users": newest_users,
        "hot_players": hot_players,
        "days": DAYS,
        "generated": now,
    })
