"""
Re-scan tracked players for new FACEIT bans and record them into the recent-bans
feed. Run on a schedule (e.g. Render Cron) to keep the feed fresh:

    python manage.py check_bans --limit 300

Without a schedule the feed still fills up passively whenever a banned player is
looked up (see views._record_bans).
"""
from django.core.management.base import BaseCommand

from tracker import faceit
from tracker.models import TrackedPlayer, BanRecord


class Command(BaseCommand):
    help = "Re-check tracked players for FACEIT bans and log new ones."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=300)

    def handle(self, *args, **opts):
        limit = opts["limit"]
        players = TrackedPlayer.objects.order_by("-last_searched")[:limit]
        checked = 0
        found = 0
        for tp in players:
            checked += 1
            try:
                bans = faceit.get_player_bans(tp.player_id)
            except Exception:
                continue
            for b in (bans or []):
                btype = (b.get("reason") or b.get("type") or "ban").strip()[:64]
                _, created = BanRecord.objects.get_or_create(
                    player_id=tp.player_id,
                    ban_type=btype,
                    defaults={"nickname": tp.nickname, "reason": btype},
                )
                if created:
                    found += 1
                    self.stdout.write(f"  + {tp.nickname}: {btype}")
        self.stdout.write(self.style.SUCCESS(f"Checked {checked} players, {found} new bans."))
