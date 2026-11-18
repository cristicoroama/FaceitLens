"""Print the FACEIT player IDs to paste into the webhook User subscription.

    python manage.py faceit_webhook_ids --limit 500

Takes every favorited/watchlisted player plus linked FaceitLens accounts, most
recently searched first, and also caches the list so /api/live/ keeps polling
those players.
"""
from django.core.cache import cache
from django.core.management.base import BaseCommand

from tracker.models import Favorite, TrackedPlayer, UserProfile


class Command(BaseCommand):
    help = "List FACEIT player IDs for the webhook subscription."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=500)

    def handle(self, *args, **opts):
        nicks = {n.lower() for n in Favorite.objects.values_list("nickname", flat=True)}
        ids = []
        for pid in UserProfile.objects.exclude(faceit_player_id="").values_list("faceit_player_id", flat=True):
            if pid not in ids:
                ids.append(pid)
        for tp in TrackedPlayer.objects.order_by("-last_searched"):
            if tp.nickname.lower() in nicks and tp.player_id not in ids:
                ids.append(tp.player_id)
            if len(ids) >= opts["limit"]:
                break
        ids = ids[: opts["limit"]]
        cache.set("webhook:ids", set(ids), 30 * 24 * 60 * 60)
        self.stdout.write("\n".join(ids))
        self.stderr.write(f"{len(ids)} player IDs")
