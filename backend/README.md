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

### On-demand parse queue (worker)

Visitors can ask for a match demo to be parsed with `POST /api/match/<match_id>/parse/`
(rate-limited per IP, deduplicated) and poll `GET /api/match/<match_id>/demo/`.
There is no Celery/Redis queue: requests are rows in `DemoParseRequest`, and the
existing worker/cron drains them. Running `parse_demos` with no arguments processes
the queue.

```bash
# one pass over the queue (cron, e.g. every minute)
python manage.py parse_demos --queue --max 5

# long-running Render background worker
python manage.py parse_demos --queue --watch 20
```

Needs `FACEIT_API_KEY`. Requests stuck in `processing` for 30 minutes are requeued;
a failed match is retried up to 3 times when someone asks again.
Related endpoints: `GET /api/player/<nickname>/demo-matches/` (per-match stats incl.
utility/economy) and `GET /api/player/<nickname>/coach/` (`?ai=1` adds an LLM-phrased
summary when `ANTHROPIC_API_KEY` is set).
