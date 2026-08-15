"""Changelog entry for the stream overlay.

Same shape as 0012, 0017 and 0018: a data migration so the entry ships with
the deploy, keyed on title via get_or_create so re-running never duplicates
and anything edited later in the admin stays edited.

This one also demotes the world map from the pinned slot. The popup sorts
highlighted entries to the top, so leaving two pinned would show the older
one directly under the new one and dilute both.
"""
from datetime import datetime, timezone as dt_timezone

from django.db import migrations

PREVIOUS_HIGHLIGHT = "A world map of where the best players are"

ENTRIES = [
    (
        "A free stream overlay for OBS",
        "feature",
        True,
        (2026, 8, 15),
        """Streaming? There is now a live ELO card you can drop straight into OBS. It shows your current rating and level, your record since the stream started, and the map you are on right now, updating by itself every ten seconds.
Setting it up takes about thirty seconds. Open Stream overlay in the menu, copy your link, and add it in OBS as a Browser source at 420 by 200. Nothing to install, nothing to keep running next to the game, and no account needed by anyone watching.
You choose what appears. ELO and level, session record, live match and the small faceit-lens.com credit are each a separate toggle, so the card can be as bare as a single number if that is all you want on screen. The credit is yours to turn off too. There is no watermark here that you have to pay to remove.
Your link carries a private token rather than your nickname, because OBS loads the page without being signed in and the token is the only thing standing between a stranger and your live ELO. If it ever ends up visible on stream, regenerate it and the old one stops working immediately.
The session counter resets whenever you want it to, so a fresh stream starts from 0-0 instead of inheriting yesterday's losses.""",
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
        ("tracker", "0019_streamoverlay"),
    ]

    operations = [migrations.RunPython(seed, unseed)]
