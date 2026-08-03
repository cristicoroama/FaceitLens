"""
One honest User-Agent for every outbound request.

Pretending to be a browser buys us nothing: Steam's profile pages, the
inventory JSON and Leetify's public API all answer identically with a spoofed
string, an honest one, or none at all. What it does do is make legitimate
traffic look like evasion, which is exactly the wrong signal to send to the
providers we depend on.

Identifying the project and a contact address is what Liquipedia's API terms
explicitly require, and it's what lets any provider reach us before they reach
for a block.
"""
from __future__ import annotations

import os

VERSION = "1.0"
SITE = "https://faceit-lens.com"

# Overridable so a fork doesn't send traffic under this project's contact.
CONTACT = os.environ.get("CONTACT_EMAIL", "coroamamh@gmail.com")

USER_AGENT = f"FaceitLens/{VERSION} (CS2 stats tracker; +{SITE}; {CONTACT})"
HEADERS = {"User-Agent": USER_AGENT}


def headers(**extra) -> dict:
    """The base UA header plus any per-request additions."""
    h = dict(HEADERS)
    h.update(extra)
    return h
