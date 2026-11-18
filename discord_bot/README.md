# FaceitLens Discord Bot

Commands: `/elo`, `/stats` (with the generated profile card), `/season`, `/roast`, `/compare`,
`/link`, `/unlink`, `/leaderboard` (weekly ELO race between linked members), `/pickem <code>`.

Every reply has an "Open profile" button and a "Join FaceitLens Discord" button.

The bot talks to the FaceitLens backend, not to FACEIT directly, so it shares the backend cache.

## Env vars

| Var | Value |
| --- | --- |
| `DISCORD_TOKEN` | Bot token |
| `FACEITLENS_API` | Backend URL, e.g. `https://faceitlens.onrender.com` (no `/api`) |
| `FACEITLENS_API_KEY` | An API key from Django admin → Api keys (needed when API keys are enforced) |
| `DATA_PATH` | Optional path for `links.json`. On Render, point it at a persistent disk or links reset on redeploy |

## Run locally
```bash
cd discord_bot
pip install -r requirements.txt
set DISCORD_TOKEN=...
set FACEITLENS_API=https://faceitlens.onrender.com
set FACEITLENS_API_KEY=fl_...
python bot.py
```

## Invite
Developer portal → OAuth2 → URL Generator → scopes `bot` + `applications.commands`,
permissions `Send Messages` + `Embed Links`. Put the invite link on top.gg and discordbotlist.com.

## Host on Render
New → Background Worker → Root Directory `discord_bot` → Build `pip install -r requirements.txt`
→ Start `python bot.py` → add the env vars above.
