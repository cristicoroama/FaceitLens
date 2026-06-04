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
