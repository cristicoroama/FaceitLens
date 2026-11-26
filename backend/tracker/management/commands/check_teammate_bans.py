from django.core.management.base import BaseCommand

from tracker import community, faceit
from tracker.models import UserProfile


class Command(BaseCommand):
    help = "Check recent opponents and teammates of linked members for new FACEIT bans."

    def add_arguments(self, parser):
        parser.add_argument("--matches", type=int, default=50)
        parser.add_argument("--recheck-days", type=int, default=3)
        parser.add_argument("--sleep", type=float, default=0.3)
        parser.add_argument("--max-calls", type=int, default=600)
        parser.add_argument("--limit", type=int, default=200)

    def handle(self, *args, **opts):
        if not faceit.FACEIT_API_KEY:
            self.stderr.write("FACEIT_API_KEY is not set; nothing to do.")
            return
        budget = {"left": opts["max_calls"]}
        profiles = (
            UserProfile.objects.exclude(faceit_player_id="")
            .select_related("user")
            .order_by("-updated_at")[: opts["limit"]]
        )
        totals = {"members": 0, "found": 0, "notified": 0, "calls": 0}
        for profile in profiles:
            if budget["left"] <= 0:
                self.stdout.write("Call budget exhausted; the rest waits for the next run.")
                break
            try:
                res = community.scan_encounter_bans(
                    profile,
                    matches=min(100, opts["matches"]),
                    recheck_days=opts["recheck_days"],
                    sleep=opts["sleep"],
                    budget=budget,
                )
            except Exception as exc:
                self.stderr.write(f"  {profile.faceit_nickname}: {exc}")
                continue
            totals["members"] += 1
            for k in ("found", "notified", "calls"):
                totals[k] += res[k]
            if res["found"]:
                self.stdout.write(f"  {profile.faceit_nickname}: {res['found']} new banned encounter(s)")
        self.stdout.write(self.style.SUCCESS(
            f"Scanned {totals['members']} member(s), {totals['calls']} ban lookups, "
            f"{totals['found']} new, {totals['notified']} notification(s)."
        ))
