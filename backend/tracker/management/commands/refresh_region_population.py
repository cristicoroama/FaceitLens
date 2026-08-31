"""Measure how many players each region has ranked, and cache it.

The profile page reads this figure from the cache to turn a bare position
("#52,240") into a percentile ("better than 93.4% of Europe"). It never
computes it on demand: finding the number is a doubling probe plus a bisection
over the rankings endpoint — about 41 requests for a region the size of
Europe — and no page load should pay for that.

Five regions, so budget roughly 200 requests per run.

So something has to fill the cache. Run this daily, alongside snapshot_elo:

    python manage.py refresh_region_population

On Render, add it to the existing cron job's command, or make a second one:

    Command: python manage.py refresh_region_population
    Schedule: 0 4 * * *      (an hour after the ELO snapshot)

If it never runs, nothing breaks — the percentile line simply doesn't appear.
"""
from django.core.management.base import BaseCommand
from django.core.cache import cache

from ...faceit import REGIONS, get_region_population


class Command(BaseCommand):
    help = "Measure and cache the ranked-player count for each region."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-measure even if a cached figure is still fresh.",
        )
        parser.add_argument(
            "--region",
            help="Only this region (EU, NA, SA, SEA, OCE). Default: all.",
        )

    def handle(self, *args, **opts):
        regions = [opts["region"].upper()] if opts.get("region") else list(REGIONS)

        for region in regions:
            if region not in REGIONS:
                self.stderr.write(f"  {region}: not a FACEIT region, skipping")
                continue

            if opts.get("force"):
                # Drop both the value and any stale lock, so the search below
                # is actually allowed to run.
                cache.delete(f"faceit:pop:{region}")
                cache.delete(f"faceit:pop:{region}:lock")

            before = get_region_population(region)
            if before and not opts.get("force"):
                self.stdout.write(f"  {region}: {before:,} (cached, still fresh)")
                continue

            total = get_region_population(region, compute=True)
            if total:
                self.stdout.write(self.style.SUCCESS(f"  {region}: {total:,} players"))
            else:
                # Not an error worth failing on: a region can be genuinely
                # empty, and the search deliberately refuses to guess when the
                # API looks like it capped the offset.
                self.stdout.write(f"  {region}: could not measure (left unset)")
