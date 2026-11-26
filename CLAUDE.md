# FaceitLens

FACEIT CS2 stats tracker. Live at https://faceit-lens.com (Vercel), API on Render.

## Layout

- `frontend/`: React 18 + Vite 5 + react-router 6, Tailwind v4 plus a large hand-written `src/index.css`. recharts for charts.
  - `src/App.jsx` holds routing, page modes and the profile tabs (`PRIMARY_TABS`, `MORE_TABS`, `renderTab()`). Pages and tabs are `React.lazy`.
  - `src/api.js` `getJson(path, { ttl, signal, retry, force })` is the only GET helper: in-memory cache, in-flight dedup, one retry on 502/503/504.
  - `src/page-meta.js` (`PAGE_META`, `TOOL_PAGES`) and `src/i18n.js` + `src/i18n-shell.js` (en/ru/pl/uk, `PAGE_META_I18N`) drive titles and prerendered copy.
  - New component styles go in `src/styles/<area>.css`; reuse the tokens in the `:root` block of `index.css` (`--fs-*`, `--r-*`, `--win`, `--loss`, `--rs-1..5`, `--focus-ring`).
  - `api/` are Vercel functions: `render.js` server-renders `/player/:nick` (canonical, JSON-LD, inlined `#__PLAYER__` JSON), `share.js`, `og.js`, `sitemap-players.js`.
  - `scripts/prerender.mjs` bakes every `TOOL_PAGES` route in 4 languages plus `spa.html` and `404.html`; `scripts/seo-check.mjs` must pass.
- `backend/`: Django app `tracker`.
  - `faceit.py` wraps the FACEIT Data API (`_get` has pooling, 429/5xx retry, `FaceitRateLimited`/`FaceitUnavailable`). Views turn these into JSON 503s via `_faceit_error()`; unexpected errors go through `_internal_error()` and never echo exception text.
  - Feature modules: `community.py`, `lobby.py`, `demo_views.py`, `demo_queue.py`, `demo_coach.py`, `ai.py`, `pickem.py`, `profiles.py`, `notifications.py`.
  - Most `/api/` endpoints are wrapped in `require_api_key`, which lets through requests whose Origin/Referer is in the `CORS_ORIGINS` env var.
- `browser_extension/`, `discord_bot/`: separate clients of the same API.

## Commands

```bash
cd frontend && npm ci && npm run build   # vite build, prerender, seo-check
cd frontend && npm run dev
cd backend && python manage.py check && python manage.py migrate && python manage.py runserver
```

There is no automated test suite. Verify backend changes with `manage.py check` and the Django test client; local checks of site-only endpoints need `CORS_ORIGINS=https://faceit-lens.com`.

## Background jobs (Render cron / worker)

- `snapshot_elo` daily: ELO snapshots, `PlayerMeta`, level-up and ELO-swing notifications.
- `check_bans`, `check_teammate_bans` daily; `weekly_digest` weekly.
- `parse_demos --queue --watch 20` as a worker: processes on-demand demo parse requests.

Env: `FACEIT_API_KEY`, `STEAM_API_KEY`, `ANTHROPIC_API_KEY` (AI features fall back to rule-based output without it), `CORS_ORIGINS`, `DATABASE_URL`.

## Conventions

- No comments or docstrings in new code; match existing naming.
- New one-segment routes need only `TOOL_PAGES` + `PAGE_META` (+ `PAGE_META_I18N` for ru/pl/uk, or seo-check fails). Routes with two or more segments also need a rewrite in `frontend/vercel.json`.
- Do not automate actions on faceit.com (auto-accept, auto-veto): FACEIT terms.
