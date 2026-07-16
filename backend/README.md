# FaceitLens — Backend

FACEIT CS2 stats tracker API (Django).

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

## API key

Create a free "Server side" API key at https://developers.faceit.com
and set it in the environment before starting the server:

```bash
set FACEIT_API_KEY=your-key          # Windows (cmd)
# PowerShell: $env:FACEIT_API_KEY="your-key"
```

## Run

```bash
python manage.py migrate
python manage.py runserver           # runs on :8000
```

Test: open http://localhost:8000/api/player/s1mple/ in the browser.

## Real stats (demo parsing)

The FACEIT Data API only exposes per-match aggregates. The *real* numbers that
sites like csrep.gg show — HLTV Rating 2.0, KAST, opening duels, clutches,
trades, utility — come from **parsing the match demos**. That's what the
`parse_demos` worker does (via `demoparser2`).

```bash
# parse one match by id
python manage.py parse_demos --match <match_id>

# parse a player's recent matches (skips already-parsed ones)
python manage.py parse_demos --player s1mple --limit 10

# parse a local .dem you already have (no download / no API key)
python manage.py parse_demos --file path/to/match.dem --match <id>
```

Parsed results are stored (`ParsedMatch` / `DemoPlayerStat`) and surfaced at
`/api/player/<nickname>/real/`, shown under the **★ Real (Demos)** profile tab.

**Run this on a worker, not the web process** — a demo is ~100–300 MB and
parsing takes seconds, so it will block/OOM a small web dyno. A cheap VPS or a
cron box that periodically runs `parse_demos --player <nick>` for tracked
players is the pattern csrep/Leetify use.
