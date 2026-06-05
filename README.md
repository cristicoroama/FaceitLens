# FaceitLens

An open-source FACEIT CS2 stats tracker. Django backend + React (Vite) frontend.

Features:
- Player lookup by FACEIT nickname (ELO, level, win rate, K/D, HS%, streaks)
- Recent match history
- Approximate ELO progression chart (reconstructed from match results)
- 1v1 side-by-side player comparison

## 1. Backend (terminal 1)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt

set FACEIT_API_KEY=your-key-here   # Windows (cmd)
# PowerShell: $env:FACEIT_API_KEY="your-key-here"

python manage.py migrate
python manage.py runserver         # runs on :8000
```

Test: open http://localhost:8000/api/player/s1mple/ in the browser.

## 2. Frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev                        # runs on :3000
```

Open http://localhost:3000

## Notes

- The FACEIT API key must be of type "Server side".
- The ELO chart is approximate: FACEIT does not expose per-match ELO, so the
  curve is reconstructed from win/loss results using a fixed +/-25 per match.
