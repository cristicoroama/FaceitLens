"""Drop every FACEIT link that was never actually proven.

Typing a nickname into settings used to attach that account to your profile.
It was marked unverified, but the public page still rendered the real player's
ELO, avatar and stats — so anyone could put "donk666" on their profile and it
looked convincing. Linking now requires signing in through Steam or FACEIT.

This clears the claims made under the old rules. Verified links (established
through Steam) are untouched. Nobody loses anything they actually owned: their
next sign-in re-links them automatically.
"""
from django.db import migrations


def clear_unverified(apps, schema_editor):
    UserProfile = apps.get_model("tracker", "UserProfile")
    UserProfile.objects.filter(faceit_verified=False).exclude(
        faceit_nickname=""
    ).update(faceit_nickname="", faceit_player_id="")


def noop(apps, schema_editor):
    """Nothing to restore — these links were never trustworthy."""


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0012_seed_changelog"),
    ]

    operations = [migrations.RunPython(clear_unverified, noop)]
