"""Create a throwaway stream overlay pointed at any FACEIT nickname.

Why this exists
---------------
The overlay is deliberately impossible to point at someone else's account
through the site: the FACEIT link is proven through Steam, and every endpoint
reads `profile.faceit_player_id` rather than anything the user typed. That is
the whole fix for the impersonation bug, and it stays.

But it also means there is no way to *test* the overlay without owning an
account that has played matches. This command is the escape hatch, kept where
it belongs — a local admin tool, not a route on the website.

    python manage.py demo_overlay donk666
    python manage.py demo_overlay donk666 --delete

Every profile it creates is marked private, is owned by a dedicated inactive
user, and is named so it is obvious in the admin. `--delete` removes it again.

Nothing here bypasses the token: the URL it prints still carries a secret, and
still only works for the one account it was made for.
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from tracker.models import StreamOverlay, UserProfile

USER_PREFIX = "demo-overlay-"
SITE = "http://localhost:5173"


class Command(BaseCommand):
    help = "Create a demo stream overlay for a FACEIT nickname (local testing)."

    def add_arguments(self, parser):
        parser.add_argument("nickname", help="FACEIT nickname, e.g. donk666")
        parser.add_argument("--delete", action="store_true",
                            help="Remove the demo profile for this nickname.")
        parser.add_argument("--site", default=SITE,
                            help=f"Base URL to print. Default {SITE}")

    @transaction.atomic
    def handle(self, *args, **opts):
        nickname = opts["nickname"].strip()
        handle = f"{USER_PREFIX}{nickname.lower()}"[:30]
        User = get_user_model()

        if opts["delete"]:
            n, _ = User.objects.filter(username=handle).delete()
            self.stdout.write(self.style.SUCCESS(
                f"Deleted the demo profile for {nickname}." if n
                else f"No demo profile for {nickname}."))
            return

        from tracker import faceit

        try:
            player = faceit.get_player_by_nickname(nickname)
        except Exception as exc:
            raise CommandError(f"FACEIT lookup failed: {exc}") from exc
        if not player or not player.get("player_id"):
            raise CommandError(f"FACEIT has no player called {nickname!r}.")

        cs2 = (player.get("games") or {}).get(faceit.GAME) or {}
        if not cs2:
            raise CommandError(f"{nickname} has no CS2 account on FACEIT.")

        user, _ = User.objects.get_or_create(
            username=handle,
            defaults={"is_active": False},   # cannot be signed into
        )
        profile, _ = UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "handle": handle,
                "display_name": f"{nickname} (demo)",
                "faceit_nickname": player.get("nickname") or nickname,
                "faceit_player_id": player["player_id"],
                # Verified in the sense the endpoints need — this really is the
                # account FACEIT returned. It is not a claim of ownership, and
                # the profile is private so it never appears in the directory.
                "faceit_verified": True,
                "is_public": False,
            },
        )

        ov, created = StreamOverlay.objects.get_or_create(
            profile=profile, defaults={"token": StreamOverlay.new_token()},
        )

        base = opts["site"].rstrip("/")
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"{'Created' if created else 'Reusing'} overlay for "
            f"{profile.faceit_nickname} — level {cs2.get('skill_level')}, "
            f"{cs2.get('faceit_elo')} ELO"))
        self.stdout.write("")
        self.stdout.write(f"  Overlay : {base}/overlay/{ov.token}")
        self.stdout.write(f"  API     : {base.replace('5173', '8000')}/api/overlay/{ov.token}/")
        self.stdout.write("")
        self.stdout.write(self.style.WARNING(
            f"  Remove it with:  python manage.py demo_overlay {nickname} --delete"))
        self.stdout.write("")
