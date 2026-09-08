"""
CS2 collectibles: definition index -> medal / coin name and icon.

Several sources hand us medals as bare definition indexes and nothing else —
CSRep's player payload returns `medals: [5270, 996, 874, ...]` — which is
unreadable on a page. This resolves those numbers into the name and artwork
Valve ships for them.

The table is vendored at tracker/data/collectibles.json and rebuilt by
`manage.py refresh_collectibles`. It is read once and held in memory: it is
~140 KB, it changes only when Valve adds medals, and a profile view should not
pay disk I/O for it on every request.

Data source: https://github.com/ByMykel/CSGO-API (MIT, (c) 2023 ByMykel).
"""
from __future__ import annotations

import json
import os

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "collectibles.json")

_CACHE: dict | None = None
_PREFIX = ""


def load() -> dict:
    """The raw index -> {n, i} table. Empty dict when the file is absent.

    A missing or unreadable file is not an error worth raising: the medal grid
    simply falls back to showing the ids, which is what it did before this
    table existed. A profile page must not 500 because a data file was not
    regenerated.
    """
    global _CACHE, _PREFIX
    if _CACHE is not None:
        return _CACHE

    try:
        with open(DATA_PATH, encoding="utf-8") as fh:
            blob = json.load(fh)
        _CACHE = blob.get("items") or {}
        _PREFIX = blob.get("_prefix") or ""
    except (OSError, ValueError):
        _CACHE = {}
        _PREFIX = ""
    return _CACHE


def resolve(ids: list) -> list:
    """Turn definition indexes into [{id, name, image}], order preserved.

    Unknown ids are kept rather than dropped: a medal we cannot label is still
    a medal the player owns, and silently shrinking the count would misreport
    the profile. They fall back to "Medal #<id>" so the grid shows a card with
    a readable caption instead of a blank tile — which is also the visible
    signal that the table wants regenerating after a CS2 update.
    """
    table = load()
    out = []
    for raw in ids or []:
        hit = table.get(str(raw))
        image = (hit or {}).get("i") or ""
        if image and not image.startswith("http"):
            image = _PREFIX + image
        out.append({
            "id": raw,
            "name": (hit or {}).get("n") or f"Medal #{raw}",
            "known": bool(hit),
            "image": image or None,
        })
    return out
