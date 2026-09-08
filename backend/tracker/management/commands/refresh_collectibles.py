"""
Rebuild the CS2 collectible lookup: definition index -> medal name + icon.

CSRep returns a player's medals as bare definition indexes ([5270, 996, 874,
...]) and publishes no table to read them with, so on their own they are
unprintable. Valve does not serve that table either. This pulls it from the
community CSGO-API project and trims it to the two fields a medal grid needs.

    python manage.py refresh_collectibles

Vendored rather than fetched at request time: it changes only when Valve ships
new medals (a few times a year), and a profile page should not depend on a
third-party CDN being up to draw a coin. Re-run after a major CS2 update; the
command reports how many entries changed so an empty diff is obvious.

Source: https://github.com/ByMykel/CSGO-API (MIT, (c) 2023 ByMykel)
The MIT notice ships alongside the data in tracker/data/COLLECTIBLES_LICENSE.
"""
import json
import os

import requests
from django.core.management.base import BaseCommand

from tracker.collectibles import DATA_PATH, load

SOURCE_URL = (
    "https://raw.githubusercontent.com/ByMykel/CSGO-API"
    "/main/public/api/en/collectibles.json"
)

# Every icon but a handful sits under this host, so it is stored once rather
# than 500-odd times. tracker.collectibles puts it back on read.
IMAGE_PREFIX = "https://community.akamai.steamstatic.com/economy/image/"


class Command(BaseCommand):
    help = "Rebuild the CS2 collectible (medal/coin) name+icon lookup."

    def add_arguments(self, parser):
        parser.add_argument(
            "--url", default=SOURCE_URL,
            help="Override the source URL (for a mirror or a pinned commit).",
        )

    def handle(self, *args, **opts):
        before = load()

        self.stdout.write(f"Fetching {opts['url']} ...")
        try:
            r = requests.get(opts["url"], timeout=60,
                             headers={"User-Agent": "Faceit-Lens collectibles refresh"})
            r.raise_for_status()
            rows = r.json()
        except requests.RequestException as exc:
            self.stderr.write(self.style.ERROR(f"Fetch failed: {exc}"))
            return
        except ValueError as exc:
            self.stderr.write(self.style.ERROR(f"Source was not JSON: {exc}"))
            return

        rows = rows if isinstance(rows, list) else list(rows.values())
        items = {}
        for c in rows:
            idx = str(c.get("def_index") or "").strip()
            name = c.get("name")
            if not idx or not name:
                continue
            image = c.get("image") or ""
            items[idx] = {
                "n": name,
                "i": image[len(IMAGE_PREFIX):] if image.startswith(IMAGE_PREFIX) else image,
            }

        if not items:
            self.stderr.write(self.style.ERROR("Source returned no usable rows; keeping the existing file."))
            return

        os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
        with open(DATA_PATH, "w", encoding="utf-8") as fh:
            json.dump(
                {
                    "_source": SOURCE_URL,
                    "_license": "MIT (c) 2023 ByMykel — see COLLECTIBLES_LICENSE",
                    "_prefix": IMAGE_PREFIX,
                    "items": items,
                },
                fh, ensure_ascii=False, separators=(",", ":"),
            )

        added = len(set(items) - set(before))
        removed = len(set(before) - set(items))
        size_kb = os.path.getsize(DATA_PATH) / 1024
        self.stdout.write(self.style.SUCCESS(
            f"Wrote {len(items)} collectibles ({size_kb:.0f} KB) — "
            f"{added} new, {removed} gone."
        ))
