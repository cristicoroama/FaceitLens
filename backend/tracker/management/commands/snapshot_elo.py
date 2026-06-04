"""
Daily ELO snapshot. Run via a Render Cron Job:
    python manage.py snapshot_elo
Saves the current ELO of every tracked player so the ELO chart can show
a real history over time instead of an approximation.
"""
from datetime import date
from django.core.management.base import BaseCommand

from tracker import faceit
from tracker.models import TrackedPlayer, EloSnapshot


class Command(BaseCommand):
    help = "Snapshot current ELO for all tracked players."

    def handle(self, *args, **options):
        today = date.today()
        count = 0
        for tp in TrackedPlayer.objects.all():
            try:
                player = faceit._get(f"/players/{tp.player_id}")
                elo = player.get("games", {}).get(faceit.GAME, {}).get("faceit_elo")
                if elo is None:
                    continue
                EloSnapshot.objects.update_or_create(
                    player_id=tp.player_id, date=today, defaults={"elo": elo}
                )
                count += 1
            except Exception as exc:
                self.stderr.write(f"  {tp.nickname}: {exc}")
        self.stdout.write(self.style.SUCCESS(f"Snapshotted {count} players for {today}."))
