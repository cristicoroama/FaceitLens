"""
Download + parse FACEIT demos into real per-player stats.

    # one match
    python manage.py parse_demos --match <match_id>

    # a player's most recent matches (skips ones already parsed)
    python manage.py parse_demos --player s1mple --limit 10

    # a local .dem you already have (no download, no API key needed)
    python manage.py parse_demos --file path/to/match.dem --match <id>

This is meant to run on a WORKER (a small VPS or your own machine), NOT inside
the web request cycle — a demo is ~100-300 MB and parsing takes seconds.
"""
import os
import time

from django.core.management.base import BaseCommand, CommandError

from tracker import demo_parser, demo_stats, faceit


class Command(BaseCommand):
    help = "Download and parse FACEIT CS2 demos into real per-player stats."

    def add_arguments(self, parser):
        parser.add_argument("--match", help="FACEIT match id to parse")
        parser.add_argument("--player", help="FACEIT nickname; parses recent matches")
        parser.add_argument("--limit", type=int, default=10, help="matches for --player")
        parser.add_argument("--file", help="parse a local .dem instead of downloading")
        parser.add_argument("--force", action="store_true", help="re-parse even if stored")

    def handle(self, *args, **opts):
        api_key = os.environ.get("FACEIT_API_KEY", "")

        if opts["file"]:
            if not opts["match"]:
                raise CommandError("--file also needs --match <id> to key the result")
            self._parse_local(opts["file"], opts["match"])
            return

        if opts["match"]:
            self._parse_match(opts["match"], api_key, opts["force"])
            return

        if opts["player"]:
            if not api_key:
                raise CommandError("FACEIT_API_KEY is not set")
            self._parse_player(opts["player"], api_key, opts["limit"], opts["force"])
            return

        raise CommandError("Give one of --match, --player or --file")

    # -- helpers ---------------------------------------------------------- #
    def _store(self, data):
        demo_stats.store_match(data)
        top = max(data["players"].values(), key=lambda p: p["rating"])
        self.stdout.write(self.style.SUCCESS(
            f"  ✓ {data['map']} · {data['rounds']}r · top {top['name']} "
            f"{top['rating']} rating"
        ))

    def _parse_local(self, path, match_id):
        self.stdout.write(f"Parsing local demo {path} ...")
        data = demo_parser.stats_from_demo(path)
        data["match_id"] = match_id
        self._store(data)

    def _parse_match(self, match_id, api_key, force):
        from tracker.models import ParsedMatch
        if not force and ParsedMatch.objects.filter(match_id=match_id).exists():
            self.stdout.write(f"{match_id}: already parsed (use --force to redo)")
            return
        if not api_key:
            raise CommandError("FACEIT_API_KEY is not set")
        self.stdout.write(f"Parsing match {match_id} ...")
        t0 = time.time()
        data = demo_parser.stats_for_match(match_id, api_key)
        self._store(data)
        self.stdout.write(f"  ({time.time() - t0:.1f}s)")

    def _parse_player(self, nickname, api_key, limit, force):
        from tracker.models import ParsedMatch
        player = faceit.get_player_by_nickname(nickname)
        pid = player["player_id"]
        history = faceit.get_player_history(pid, limit=limit)
        self.stdout.write(f"{nickname}: {len(history)} recent matches")
        for m in history:
            mid = m.get("match_id")
            if not mid:
                continue
            if not force and ParsedMatch.objects.filter(match_id=mid).exists():
                self.stdout.write(f"{mid}: skip (parsed)")
                continue
            try:
                self.stdout.write(f"{mid}: downloading + parsing ...")
                data = demo_parser.stats_for_match(mid, api_key)
                self._store(data)
            except Exception as exc:  # noqa: BLE001 - keep going on the next match
                self.stdout.write(self.style.WARNING(f"  ! {mid}: {exc}"))
