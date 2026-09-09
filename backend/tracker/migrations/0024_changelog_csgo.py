"""Changelog entry for the CS:GO career view.

Same shape as 0012, 0017, 0018 and 0020: a data migration so the entry ships
with the deploy, keyed on title via get_or_create so re-running never
duplicates and anything edited later in the admin stays edited.

Demotes the stream overlay from the pinned slot for the same reason 0020
demoted the world map — the popup sorts highlighted entries to the top, and
two pinned entries put the older one directly under the new one and dilute
both.
"""
from datetime import datetime, timezone as dt_timezone

from django.db import migrations

PREVIOUS_HIGHLIGHT = "A free stream overlay for OBS"

ENTRIES = [
    (
        "Your CS:GO career is back on your profile",
        "feature",
        True,
        (2026, 9, 9),
        """FACEIT kept CS:GO as a separate game when CS2 launched, so every match you played before the switch quietly stopped counting. On an older account that is often the larger half of your record — thousands of matches that no longer appeared anywhere.
They are back. Your profile now has a Game history panel listing both titles with the match count for each, and clicking CS:GO switches the page to that record: win rate, average K/D, headshots, longest and current win streak, your last results, and every map you played with its win rate and K/D.
Click CS2 to switch back. Nothing about your current profile changes.
One thing worth knowing before you look: CS:GO ended before FACEIT started recording ADR, entry duels and utility, so the CS:GO view is shorter than the CS2 one. That is everything FACEIT kept, not everything we could find — the page says so where it matters, rather than leaving you to wonder what went missing.""",
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
    ChangelogEntry.objects.filter(
        title=PREVIOUS_HIGHLIGHT, highlight=True
    ).update(highlight=False)


def unseed(apps, schema_editor):
    ChangelogEntry = apps.get_model("tracker", "ChangelogEntry")
    ChangelogEntry.objects.filter(title__in=[e[0] for e in ENTRIES]).delete()
    ChangelogEntry.objects.filter(title=PREVIOUS_HIGHLIGHT).update(highlight=True)


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0023_support_tickets_and_api_keys"),
    ]

    operations = [migrations.RunPython(seed, unseed)]
