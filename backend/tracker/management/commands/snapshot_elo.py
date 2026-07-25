"""
Daily ELO snapshot. Run via a Render Cron Job:

    python manage.py snapshot_elo

Two groups get snapshotted:

  * Signed-up users with a linked FACEIT account — these are guaranteed a
    reading every single day, which is what makes their progress chart a real
    history rather than a reconstruction from the last 30 matches.
  * Players anyone has looked up recently (TrackedPlayer), so popular profiles
    build history too. Cold entries are skipped by default so the job doesn't
    grow without bound as the site gets more traffic.

Options:
    --days N     only snapshot tracked players searched in the last N days
                 (default 45; members are always included)
    --members    members only — a fast job you can run more often
    --dry-run    show what would happen, write nothing
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from tracker import faceit
from tracker.models import EloSnapshot, TrackedPlayer, UserProfile


class Command(BaseCommand):
    help = "Snapshot today's ELO for members and recently searched players."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=45)
        parser.add_argument("--members", action="store_true")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        today = date.today()
        dry = options["dry_run"]

        # player_id -> label, members added first so they win any duplicate.
        targets: dict[str, str] = {}

        for p in UserProfile.objects.exclude(faceit_player_id=""):
            targets[p.faceit_player_id] = f"@{p.handle} ({p.faceit_nickname})"
        member_count = len(targets)

        if not options["members"]:
            cutoff = timezone.now() - timedelta(days=options["days"])
            for tp in TrackedPlayer.objects.filter(last_searched__gte=cutoff):
                targets.setdefault(tp.player_id, tp.nickname)

        self.stdout.write(
            f"{len(targets)} player(s) to snapshot for {today} "
            f"({member_count} member(s), {len(targets) - member_count} searched)."
        )

        saved = skipped = failed = 0
        for player_id, label in targets.items():
            try:
                player = faceit._get(f"/players/{player_id}")
                elo = (player.get("games") or {}).get(faceit.GAME, {}).get("faceit_elo")
                if elo is None:
                    skipped += 1
                    continue
                if dry:
                    self.stdout.write(f"  would save {label}: {elo}")
                else:
                    EloSnapshot.objects.update_or_create(
                        player_id=player_id, date=today, defaults={"elo": elo}
                    )
                saved += 1
            except Exception as exc:
                failed += 1
                self.stderr.write(f"  {label}: {exc}")

        verb = "Would snapshot" if dry else "Snapshotted"
        msg = f"{verb} {saved} player(s) for {today}."
        if skipped:
            msg += f" Skipped {skipped} with no CS2 ELO."
        if failed:
            msg += f" {failed} failed."
        self.stdout.write(self.style.SUCCESS(msg))
