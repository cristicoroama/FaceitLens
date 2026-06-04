# Deploying FaceitLens

Backend on Render, frontend on Vercel. Both free.

## Backend (Render)

1. Push your repo to GitHub (already done).
2. On https://render.com -> New + -> Web Service -> connect your repo.
3. Settings:
   - Root Directory: backend
   - Language: Python 3
   - Build Command: bash build.sh
   - Start Command: gunicorn faceitlens.wsgi
   - Instance Type: Free
4. Environment variables (Environment tab):
   - FACEIT_API_KEY = your Server-side key
   - SECRET_KEY = any long random string
   - DEBUG = False
   - ALLOWED_HOSTS = <your-service>.onrender.com
   - CORS_ORIGINS = https://<your-frontend>.vercel.app   (add after step below)
5. Deploy. You get a URL like https://faceitlens.onrender.com
   Test: https://faceitlens.onrender.com/api/player/s1mple/

Note: the free tier sleeps after 15 min idle; first request then takes ~1 min.

## Frontend (Vercel)

1. On https://vercel.com -> Add New -> Project -> import your repo.
2. Settings:
   - Root Directory: frontend
   - Framework Preset: Vite
   - Build Command: npm run build
   - Output Directory: dist
3. Environment variable:
   - VITE_API_URL = https://<your-service>.onrender.com
4. Deploy. You get https://<your-frontend>.vercel.app
5. Go back to Render and set CORS_ORIGINS to that Vercel URL, then redeploy.

Done. Share the Vercel link.

## ELO snapshot cron (optional, for the real ELO chart)

On Render -> New + -> Cron Job:
- Root Directory: backend
- Build Command: bash build.sh
- Command: python manage.py snapshot_elo
- Schedule: 0 3 * * *   (every day at 03:00 UTC)
- Same environment variables as the web service (FACEIT_API_KEY, SECRET_KEY, etc.)

It snapshots the ELO of every player that has been searched. After a few days
the chart switches automatically from the approximate curve to the real one.

Note: SQLite on Render is ephemeral (resets on redeploy). For snapshots that
survive long term, add a Render Postgres instance and point DATABASE_URL at it.

## Postgres (persistent ELO snapshots)

On Render -> New + -> Postgres -> Free. Copy its "Internal Database URL".
Then on your Web Service AND the Cron Job -> Environment -> add:
  DATABASE_URL = <the internal database URL>
Redeploy. Migrations create the tables automatically (build.sh runs migrate).
Now ELO snapshots survive redeploys.

## Per-player Open Graph (Discord previews)

The share link is /p/<nickname> (handled by frontend/api/share.js).
On Vercel -> Settings -> Environment Variables add:
  BACKEND_URL = https://<your-service>.onrender.com
Redeploy. Sharing faceit-lens.vercel.app/p/LorduKiki on Discord now shows
the player's name, ELO and win rate. The "Share" button copies this link.

## AI Analysis (Anthropic)

The "AI Analysis" button calls the Anthropic API from the backend.
On Render -> your Web Service -> Environment, add:
  ANTHROPIC_API_KEY = <your Anthropic API key>
Optional:
  ANTHROPIC_MODEL = claude-haiku-4-5-20251001   (default; a small, cheap model)

Each analysis is cached per player for 12h, so repeat views don't re-bill.
The key stays on the backend and is never exposed to the browser.
If ANTHROPIC_API_KEY is missing, the button returns a friendly "not configured" message.
