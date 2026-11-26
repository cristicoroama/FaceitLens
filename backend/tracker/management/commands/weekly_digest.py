import time
from datetime import date

from django.core.management.base import BaseCommand

from tracker import community, faceit, notifications
from tracker.models import UserProfile


class Command(BaseCommand):
    help = "Create a weekly summary notification for every member with a linked FACEIT account."

    def add_arguments(self, parser):
        parser.add_argument("--sleep", type=float, default=0.5)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        year, week, _ = date.today().isocalendar()
        sent = skipped = 0
        has_key = bool(faceit.FACEIT_API_KEY)
        for profile in UserProfile.objects.exclude(faceit_player_id="").select_related("user"):
            try:
                digest = community.build_digest(profile)
            except Exception as exc:
                self.stderr.write(f"  {profile.faceit_nickname}: {exc}")
                continue
            if not digest["parts"]:
                skipped += 1
                continue
            body = "; ".join(digest["parts"]) + "."
            if opts["dry_run"]:
                self.stdout.write(f"  {profile.faceit_nickname}: {body}")
            else:
                sent += notifications.deliver(
                    [profile.user_id],
                    "digest",
                    "Your week on FACEIT",
                    body[:1].upper() + body[1:],
                    f"/player/{profile.faceit_nickname}",
                    f"digest:{profile.user_id}:{year}-W{week:02d}",
                )
            if has_key and opts["sleep"]:
                time.sleep(opts["sleep"])
        self.stdout.write(self.style.SUCCESS(f"Sent {sent} digest(s), {skipped} with nothing to report."))
