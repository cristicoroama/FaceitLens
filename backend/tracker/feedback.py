"""
Public feedback board: bug reports, ideas and questions, with votes and replies.

Why it exists: most people who hit a bug will never open a GitHub issue. They
also won't email. But they will click a button on the site they're already on.
Votes turn a pile of requests into a priority list.

Access rules:
  * Reading is public — the board doubles as a roadmap, and it should be
    indexable and shareable.
  * Posting, voting and commenting require a Steam sign-in. That's enough
    friction to stop drive-by spam without asking anyone to register anything.

Endpoints (wired under /api/feedback/):
  GET    /api/feedback/                 list (?kind= &status= &sort=top|new &q=)
  POST   /api/feedback/                 create an item
  GET    /api/feedback/<id>/            one item with its comments
  POST   /api/feedback/<id>/vote/       toggle my vote
  POST   /api/feedback/<id>/comment/    add a comment
  GET    /api/feedback/meta/            the filter options + whether I'm signed in
"""
from __future__ import annotations

import json
import re
from datetime import timedelta

from django.db.models import Count, Exists, OuterRef
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from .models import FeedbackComment, FeedbackItem, FeedbackVote

# Same control-character strip as profiles: no zero-width or bidi tricks in
# titles, which would otherwise let someone fake a "staff" badge visually.
_CONTROL = re.compile("[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]")

MAX_TITLE = 120
MAX_BODY = 4000
MAX_COMMENT = 2000

# A signed-in user can post this many items / comments per hour. Generous for
# anyone real, tight enough that a bored person can't flood the board.
RATE_ITEMS_PER_HOUR = 6
RATE_COMMENTS_PER_HOUR = 30


def _clean(text: str, limit: int) -> str:
    text = _CONTROL.sub("", text or "")
    # Collapse runs of blank lines so nobody can push the page apart.
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()[:limit]


def _body(request) -> dict:
    try:
        return json.loads(request.body or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


def _author(user) -> dict:
    """Public identity of a poster, reusing their profile handle when they have one."""
    if user is None:
        return {"name": "Deleted user", "handle": None, "avatar": None}

    profile = getattr(user, "profile", None)
    steam = getattr(user, "steam_profile", None)

    avatar = None
    if profile and profile.has_avatar:
        avatar = f"/api/avatar/{profile.handle}/"
    elif steam and steam.avatar:
        avatar = steam.avatar

    return {
        "name": (profile.name if profile else None) or (steam.name if steam else None) or "Player",
        "handle": profile.handle if profile else None,
        "avatar": avatar,
        "staff": bool(user.is_staff),
    }


def _item_json(item, voted=False, with_comments=False) -> dict:
    data = {
        "id": item.id,
        "title": item.title,
        "body": item.body,
        "kind": item.kind,
        "kind_label": item.get_kind_display(),
        "status": item.status,
        "status_label": item.get_status_display(),
        "pinned": item.pinned,
        "votes": getattr(item, "n_votes", None) if getattr(item, "n_votes", None) is not None else item.vote_count,
        "voted": voted,
        "comments": getattr(item, "n_comments", None),
        "author": _author(item.author),
        "created_at": item.created_at.isoformat(),
    }
    if with_comments:
        data["comment_list"] = [
            {
                "id": c.id,
                "body": c.body,
                "staff_reply": c.staff_reply,
                "author": _author(c.author),
                "created_at": c.created_at.isoformat(),
            }
            for c in item.comments.filter(hidden=False).select_related("author")
        ]
    return data


def _rate_ok(user, model, limit: int) -> bool:
    since = timezone.now() - timedelta(hours=1)
    return model.objects.filter(author=user, created_at__gte=since).count() < limit


# --------------------------------------------------------------------------

@csrf_exempt
def feedback_list(request):
    """GET the board, or POST a new item."""
    if request.method == "POST":
        return _create_item(request)
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed."}, status=405)

    qs = (
        FeedbackItem.objects.filter(hidden=False)
        .select_related("author")
        .annotate(n_votes=Count("votes", distinct=True),
                  n_comments=Count("comments", distinct=True))
    )

    kind = request.GET.get("kind")
    if kind in dict(FeedbackItem.KIND_CHOICES):
        qs = qs.filter(kind=kind)

    status = request.GET.get("status")
    if status == "closed":
        qs = qs.filter(status__in=["done", "declined", "duplicate"])
    elif status == "active":
        qs = qs.exclude(status__in=["done", "declined", "duplicate"])
    elif status in dict(FeedbackItem.STATUS_CHOICES):
        qs = qs.filter(status=status)

    q = (request.GET.get("q") or "").strip()[:80]
    if q:
        from django.db.models import Q
        qs = qs.filter(Q(title__icontains=q) | Q(body__icontains=q))

    # Mark which ones I've already voted on, in the same query.
    if request.user.is_authenticated:
        qs = qs.annotate(
            i_voted=Exists(
                FeedbackVote.objects.filter(item=OuterRef("pk"), user=request.user)
            )
        )

    sort = request.GET.get("sort", "top")
    if sort == "new":
        qs = qs.order_by("-pinned", "-created_at")
    elif sort == "discussed":
        qs = qs.order_by("-pinned", "-n_comments", "-created_at")
    else:
        qs = qs.order_by("-pinned", "-n_votes", "-created_at")

    rows = list(qs[:150])
    return JsonResponse({
        "items": [
            _item_json(i, voted=bool(getattr(i, "i_voted", False)))
            for i in rows
        ],
        "count": len(rows),
        "authenticated": request.user.is_authenticated,
    })


def _create_item(request):
    if not request.user.is_authenticated:
        return JsonResponse(
            {"error": "Sign in with Steam to post."}, status=401
        )
    if not _rate_ok(request.user, FeedbackItem, RATE_ITEMS_PER_HOUR):
        return JsonResponse(
            {"error": "You've posted a lot recently — try again in a bit."},
            status=429,
        )

    body = _body(request)
    title = _clean(body.get("title"), MAX_TITLE)
    text = _clean(body.get("body"), MAX_BODY)
    kind = body.get("kind")
    if kind not in dict(FeedbackItem.KIND_CHOICES):
        kind = "idea"

    errors = {}
    if len(title) < 6:
        errors["title"] = "Give it a title of at least 6 characters."
    if len(text) < 10:
        errors["body"] = "Add a bit more detail — at least 10 characters."
    if errors:
        return JsonResponse({"errors": errors}, status=400)

    item = FeedbackItem.objects.create(
        author=request.user, title=title, body=text, kind=kind
    )
    # Posting implies you want it, so it starts with your vote.
    FeedbackVote.objects.get_or_create(item=item, user=request.user)

    return JsonResponse({"item": _item_json(item, voted=True), "ok": True}, status=201)


def feedback_detail(request, item_id):
    """One item plus its comment thread."""
    item = (
        FeedbackItem.objects.filter(id=item_id, hidden=False)
        .select_related("author")
        .annotate(n_votes=Count("votes", distinct=True))
        .first()
    )
    if item is None:
        return JsonResponse({"error": "Not found."}, status=404)

    voted = (
        request.user.is_authenticated
        and FeedbackVote.objects.filter(item=item, user=request.user).exists()
    )
    return JsonResponse({
        "item": _item_json(item, voted=voted, with_comments=True),
        "authenticated": request.user.is_authenticated,
    })


@csrf_exempt
def feedback_vote(request, item_id):
    """Toggle my vote on an item."""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Sign in with Steam to vote."}, status=401)

    item = FeedbackItem.objects.filter(id=item_id, hidden=False).first()
    if item is None:
        return JsonResponse({"error": "Not found."}, status=404)

    vote, created = FeedbackVote.objects.get_or_create(item=item, user=request.user)
    if not created:
        vote.delete()

    return JsonResponse({
        "ok": True, "voted": created, "votes": item.votes.count(),
    })


@csrf_exempt
def feedback_comment(request, item_id):
    """Add a comment to an item."""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Sign in with Steam to comment."}, status=401)
    if not _rate_ok(request.user, FeedbackComment, RATE_COMMENTS_PER_HOUR):
        return JsonResponse(
            {"error": "Slow down a moment — try again shortly."}, status=429
        )

    item = FeedbackItem.objects.filter(id=item_id, hidden=False).first()
    if item is None:
        return JsonResponse({"error": "Not found."}, status=404)

    text = _clean(_body(request).get("body"), MAX_COMMENT)
    if len(text) < 2:
        return JsonResponse({"errors": {"body": "Write something first."}}, status=400)

    comment = FeedbackComment.objects.create(
        item=item, author=request.user, body=text,
        # Staff replies are flagged here rather than trusted from the client.
        staff_reply=bool(request.user.is_staff),
    )
    return JsonResponse({
        "ok": True,
        "comment": {
            "id": comment.id,
            "body": comment.body,
            "staff_reply": comment.staff_reply,
            "author": _author(comment.author),
            "created_at": comment.created_at.isoformat(),
        },
    }, status=201)


def feedback_meta(request):
    """Filter options and counts, so the UI doesn't hardcode the vocabulary."""
    counts = dict(
        FeedbackItem.objects.filter(hidden=False)
        .values_list("status")
        .annotate(n=Count("id"))
    )
    return JsonResponse({
        "kinds": [{"key": k, "label": v} for k, v in FeedbackItem.KIND_CHOICES],
        "statuses": [
            {"key": k, "label": v, "count": counts.get(k, 0)}
            for k, v in FeedbackItem.STATUS_CHOICES
        ],
        "authenticated": request.user.is_authenticated,
        "total": sum(counts.values()),
    })
