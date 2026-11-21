"""Hide a player everywhere and erase what is stored about them (GDPR Art. 17/18/21).

    python manage.py suppress_player --steamid 7656119... --nickname oldnick
    python manage.py suppress_player --steamid 7656119... --hide-only      # restriction while verifying
    python manage.py suppress_player --steamid 7656119... --verified       # mark ownership verified

Resolves the FACEIT account from the SteamID through the FACEIT API without
creating any profile, search record or cache entry on this site.
"""
from django.core.management.base import BaseCommand, CommandError

from tracker import faceit, privacy
from tracker.models import NicknameHistory, PlayerSuppression


class Command(BaseCommand):
    help = "Suppress a player and purge stored data."

    def add_arguments(self, parser):
        parser.add_argument("--steamid", default="")
        parser.add_argument("--player-id", default="")
        parser.add_argument("--nickname", action="append", default=[])
        parser.add_argument("--hide-only", action="store_true")
        parser.add_argument("--verified", action="store_true")
        parser.add_argument("--note", default="")

    def handle(self, *args, **o):
        steamid = o["steamid"].strip()
        player_id = o["player_id"].strip()
        names = {n.strip().lower() for n in o["nickname"] if n.strip()}
        if not (steamid or player_id or names):
            raise CommandError("Give --steamid, --player-id or --nickname.")

        if steamid and not player_id:
            try:
                p = faceit._get("/players", params={"game": faceit.GAME, "game_player_id": steamid})
                player_id = p.get("player_id") or ""
                if p.get("nickname"):
                    names.add(p["nickname"].lower())
            except faceit.FaceitError as exc:
                self.stderr.write(f"FACEIT lookup by SteamID failed: {exc}")
        if player_id:
            names.update(n.lower() for n in NicknameHistory.objects.filter(player_id=player_id).values_list("nickname", flat=True))

        row = (PlayerSuppression.objects.filter(steamid=steamid).first() if steamid else None) or \
              (PlayerSuppression.objects.filter(player_id=player_id).first() if player_id else None) or \
              PlayerSuppression()
        row.steamid = steamid or row.steamid
        row.player_id = player_id or row.player_id
        row.nicknames = "\n".join(sorted(set(row.nickname_list()) | names))
        if o["note"]:
            row.note = o["note"][:200]
        if o["verified"]:
            row.verified = True
        row.save()
        privacy.refresh()
        self.stdout.write(f"Suppressed: player_id={row.player_id or '-'} steamid={row.steamid or '-'} "
                          f"nicknames={', '.join(row.nickname_list()) or '-'} verified={row.verified}")

        if o["hide_only"]:
            self.stdout.write("Hide-only: nothing deleted yet.")
            return
        report = privacy.purge(row.player_id, row.steamid, row.nickname_list())
        for k, v in report.items():
            self.stdout.write(f"  {k}: {v}")
        self.stdout.write("Done.")
