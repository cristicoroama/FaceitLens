"""Changelog entries for the v4 redesign and the work around it.

Same shape as 0012: a data migration so the entries ship with the deploy,
keyed on title via get_or_create so re-running never duplicates and anything
edited later in the admin stays edited.
"""
from datetime import datetime, timezone as dt_timezone

from django.db import migrations

ENTRIES = [
    (
        "A new look, and a navigation bar that fits",
        "feature",
        True,
        (2026, 8, 3),
        """The left sidebar is gone. Navigation now lives across the top in dropdown menus, so nothing hides below a scrollbar any more — previously half the tools were only reachable by scrolling a column most people never scrolled.
New orange and black theme, with a single button that cycles Light, Dark and Auto. Auto follows your system and switches with it while the tab is open.
Every icon on the site is now from Bootstrap Icons instead of emoji, so they take the colour of what they sit in and look the same on Windows, Mac and Android.""",
    ),
    (
        "Profile covers, direct links and the Challenger badge",
        "feature",
        True,
        (2026, 8, 3),
        """Your FACEIT profile banner now shows behind the player header.
FACEIT Profile and Steam Profile buttons take you straight to the source, and each only appears when that account actually exists.
The level scale under your ELO uses the real FACEIT rank art instead of the numbers 1 to 10.
Challenger players — the top 1,000 of a region's level-10 pool — get the leaderboard badge with their exact position.""",
    ),
    (
        "Share card avatars fixed",
        "fix",
        False,
        (2026, 8, 3),
        """Share cards always fell back to plain initials instead of showing the player's avatar.
FACEIT's image CDN sends no CORS header, which tainted the canvas and made the export fail, so the card silently redrew itself without the picture. Avatars are now served through our own API, and the card keeps them.""",
    ),
    (
        "Wrapped no longer claims stats are from this season",
        "fix",
        False,
        (2026, 8, 3),
        """Wrapped described lifetime totals as "this season" — the match count it showed was every match you have ever played.
The FACEIT API doesn't expose a season-scoped match count, so rather than guess, the wording now says what the numbers actually are.""",
    ),
    (
        "Smurf Detector moved out of Overview",
        "improvement",
        False,
        (2026, 8, 3),
        """The Smurf Detector has its own tab next to Trust.
It used to open at the top of Overview and push the actual stats below the fold for every player, most of whom score zero. Demos and Hubs were also retired from the tab strip.""",
    ),
    (
        "Privacy policy, terms and a proper footer",
        "improvement",
        False,
        (2026, 8, 3),
        """Faceit-Lens now has a privacy policy and terms of service, written against what the code actually stores rather than boilerplate.
Worth knowing: visitor counting uses no cookies and never stores your IP — each visitor is a truncated hash built from a secret that is regenerated daily and never reused, so nothing here can be traced back to you.
The footer also makes it explicit that this is an independent project, not affiliated with FACEIT, Valve, Leetify or Allstar.""",
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
        ("tracker", "0016_visitorsalt_pathday_visitorday"),
    ]

    operations = [migrations.RunPython(seed, unseed)]
