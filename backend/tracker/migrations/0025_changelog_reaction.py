"""Changelog entry for the reaction test minigame.

Same shape as 0012, 0017, 0018, 0020 and 0024: a data migration so the entry
ships with the deploy, keyed on title via get_or_create so re-running never
duplicates and anything edited later in the admin stays edited.

Unlike those, this one does NOT take the pinned slot, and leaves the CS:GO
career entry where it is. Pinning sorts an entry to the top of the popup, and
a minigame does not deserve to push a feature people were waiting years for
out of that position. It still leads the list by date, which is the right
amount of attention for it.
"""
from datetime import datetime, timezone as dt_timezone

from django.db import migrations

ENTRIES = [
    (
        "Find out how fast your reflexes actually are",
        "feature",
        False,
        (2026, 9, 10),
        """There is a new game in the Games section: a reaction test. The panel sits red, turns green after a random pause, and the clock starts the instant it does. Click. It tells you how many milliseconds that took.
You play five rounds and the score is the average, not your best one. A single fast click is mostly luck — five of them is a number you can actually compare against someone else's.
Click before it turns green and the round is void rather than scored, so mashing the button gets you nowhere.
There is a leaderboard, and it is the first one on the site where a lower number wins.
Worth knowing before you take your time personally: what you are measuring is you plus your monitor plus your mouse plus the browser, and a 144Hz screen genuinely reads faster than a 60Hz one. Treat it as something to beat your own score at rather than proof of anything about your aim.""",
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
        ("tracker", "0024_changelog_csgo"),
    ]

    operations = [migrations.RunPython(seed, unseed)]
