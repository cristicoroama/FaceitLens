"""Seed the changelog with everything built so far.

Written as a data migration so the site has real content the moment it
deploys, rather than an empty "What's New" page. Uses get_or_create on the
title, so re-running it never duplicates, and anything you edit later in the
admin stays edited.
"""
from datetime import datetime, timezone as dt_timezone

from django.db import migrations

ENTRIES = [
    (
        "Accounts, profiles and real ELO history",
        "feature",
        True,
        (2026, 7, 25),
        """Sign in with Steam and your FACEIT account links itself — no codes to paste anywhere.
Claim your own page at faceit-lens.com/u/yourname, with a picture, a bio and a link you can share.
Your ELO is now recorded once a day, so your progress chart is a real timeline instead of a guess from your last 30 matches.
See how far you are from the next level, your peak, your best day and how long you've gone without dropping.""",
    ),
    (
        "Pro settings for 180+ players",
        "feature",
        False,
        (2026, 7, 22),
        """Sensitivity, DPI, resolution and crosshair codes for the whole professional scene.
Full gear list too: mouse, keyboard, headset, monitor, mousepad, chair and GPU.
Search by name or team to find the setup you're looking for.""",
    ),
    (
        "Smurf Detector and Account Trust Score",
        "feature",
        False,
        (2026, 7, 20),
        """Spot smurfs before the match starts, using account age, level progression and performance mismatch.
A confirmed FACEIT ban for smurfing overrides everything else — no guessing needed.
Verified and premium accounts count in your favour, so legitimate players stop getting flagged.""",
    ),
    (
        "Match Room Analyzer",
        "feature",
        False,
        (2026, 7, 18),
        """Paste a FACEIT match room link and get all ten players scanned at once.
Win prediction based on both teams' real form, not just their ELO.""",
    ),
    (
        "Live platform status",
        "feature",
        False,
        (2026, 7, 15),
        """See at a glance whether FACEIT is having problems, straight from their official status feed.
CS2 matchmaking and Steam services status, from Valve's own API.
A feed of recently banned players as they're detected.""",
    ),
    (
        "Compare, Watchlist and Clubs",
        "feature",
        False,
        (2026, 7, 12),
        """Put up to five players side by side and see who actually carries.
Keep a watchlist of players you care about, synced across your devices when signed in.
Search FACEIT clubs and browse their members.""",
    ),
    (
        "A complete redesign",
        "improvement",
        False,
        (2026, 7, 8),
        """Every page rebuilt from scratch with a glass and aurora look.
Eight colour themes to pick from.
Map thumbnails, animated stat rings and a share card you can download as an image.""",
    ),
]


def seed(apps, schema_editor):
    ChangelogEntry = apps.get_model("tracker", "ChangelogEntry")
    for title, kind, highlight, (y, m, d), body in ENTRIES:
        ChangelogEntry.objects.get_or_create(
            title=title,
            defaults={
                "kind": kind,
                "highlight": highlight,
                "body": body.strip(),
                "published": True,
                "published_at": datetime(y, m, d, 12, 0, tzinfo=dt_timezone.utc),
            },
        )


def unseed(apps, schema_editor):
    ChangelogEntry = apps.get_model("tracker", "ChangelogEntry")
    ChangelogEntry.objects.filter(title__in=[e[0] for e in ENTRIES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0011_changelogentry"),
    ]

    operations = [migrations.RunPython(seed, unseed)]
