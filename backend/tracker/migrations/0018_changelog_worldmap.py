"""Changelog entry for the world map.

Same shape as 0012 and 0017: a data migration so the entry ships with the
deploy, keyed on title via get_or_create so re-running never duplicates and
anything edited later in the admin stays edited.
"""
from datetime import datetime, timezone as dt_timezone

from django.db import migrations

ENTRIES = [
    (
        "A world map of where the best players are",
        "feature",
        True,
        (2026, 8, 5),
        """Leaderboards now has a World Map: every country shaded by how strong its CS2 scene is, from grey for none up to full orange for the deepest.
Switch between two readings of it. Players counts how many of a region's top 1,000 come from each country — the raw size of a scene. Avg ELO shows how strong those players are instead, so a small country with a brilliant top doesn't disappear behind a big one. Countries with fewer than five ranked players are left grey rather than given an average that two people could swing by hundreds of points.
Hover any country for its player count, average ELO and current number one; click it to open that region's ladder already filtered to it. Zoom buttons jump to Europe, the Americas, Asia and Oceania, because at world scale the countries with the best scenes are the ones too small to see.
FACEIT publishes no per-country statistics, so this is counted from the regional ELO ladders directly — the top 1,000 of each — and refreshed a few times a day.""",
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
        ("tracker", "0017_changelog_redesign"),
    ]

    operations = [migrations.RunPython(seed, unseed)]
