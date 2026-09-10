"""
Fan-out from "something happened" to "these people wanted to know".

Detection already lived in two places — the `check_bans` cron and the
`_record_bans` call on every profile view — and neither told anyone. Both now
call in here instead of growing their own copy of the same fan-out.

Everything is best-effort. A notification is a nicety; a profile page or a
cron run must never fail because writing one did.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)


def _humanise_ban(ban_type: str) -> str:
    """"BAN_EVASION" / "smurfing" -> "Ban evasion" / "Smurfing"."""
    text = (ban_type or "ban").replace("_", " ").strip()
    return text[:1].upper() + text[1:].lower() if text.isupper() else text.capitalize()


def notify_ban(nickname: str, ban_type: str) -> int:
    """Tell everyone who follows `nickname` that they picked up a ban.

    Returns how many people were notified, for the cron's own reporting.

    Matched on nickname rather than player_id because that is what Favorite
    stores, and case-insensitively because a favourite is whatever the user
    typed into the search box, not what FACEIT returned.
    """
    if not nickname:
        return 0

    try:
        from .models import Favorite, Notification

        watchers = (
            Favorite.objects.filter(nickname__iexact=nickname)
            .values_list("user_id", flat=True)
            .distinct()
        )
        if not watchers:
            return 0

        # player + ban type, not a timestamp: the same ban seen again by either
        # detector has to collapse onto the same row.
        key = f"ban:{nickname.lower()}:{(ban_type or '').lower()}"[:140]

        # Who already knows. Asked explicitly rather than inferred from
        # bulk_create's return value: with ignore_conflicts that comes back
        # holding every object passed in, inserted or not, so counting it would
        # report a fresh notification every night for a ban from months ago.
        already = set(
            Notification.objects.filter(dedupe=key, user_id__in=watchers)
            .values_list("user_id", flat=True)
        )
        fresh = [uid for uid in watchers if uid not in already]
        if not fresh:
            return 0

        label = _humanise_ban(ban_type)
        Notification.objects.bulk_create(
            [
                Notification(
                    user_id=uid,
                    kind="ban",
                    title=f"{nickname} picked up a ban",
                    body=f"{label} — recorded on their FACEIT account.",
                    link=f"/player/{nickname}",
                    dedupe=key,
                )
                for uid in fresh
            ],
            # Still ignore_conflicts: the check above is not a lock, and the
            # cron and a profile view can land on the same ban at once. The
            # unique constraint is what actually guarantees one row per user.
            ignore_conflicts=True,
        )
        return len(fresh)
    except Exception:
        log.exception("notify_ban failed for %s", nickname)
        return 0
