# FaceitLens — Frontend

React + Vite. Talks to the Django backend via a /api -> localhost:8000 proxy.

## Setup

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

The backend must be running in parallel on :8000 with FACEIT_API_KEY set.

## Structure

- src/App.jsx               — search + fetch + state, compare mode
- src/components/
    PlayerHeader.jsx        — avatar, name, ELO, level
    StatsGrid.jsx           — K/D, win rate, HS%, streaks
    MatchHistory.jsx        — recent matches
    EloChart.jsx            — ELO progression chart (recharts)
    CompareView.jsx         — side-by-side 1v1 comparison
- src/index.css             — dark esports theme (FACEIT orange accent)
