# FaceitLens Discord Bot

Commands: `/profile` (tabs: overview, maps, matches, teammates, trust), `/last` (scoreboard image), `/maps` (map image), `/lobby <room link>`, `/h2h`, `/elo`, `/stats` (with the generated profile card), `/season`, `/roast`, `/compare`,
`/link`, `/unlink`, `/leaderboard` (weekly ELO race between linked members), `/pickem <code>`.

Every reply has an "Open profile" button and a "Join FaceitLens Discord" button.

The bot talks to the FaceitLens backend, not to FACEIT directly, so it shares the backend cache.

## Env vars

| Var | Value |
| --- | --- |
| `DISCORD_TOKEN` | Bot token |
| `FACEITLENS_API` | Backend URL, e.g. `https://faceitlens.onrender.com` (no `/api`) |
| `FACEITLENS_API_KEY` | An API key from Django admin → Api keys (needed when API keys are enforced) |
| `DISCORD_BOT_SECRET` | Long random string, same value as on the backend (Render env). Needed for `/verify` level roles |
| `DATA_PATH` | Optional local copy of the bot's data. The real copy is saved in the backend database (needs `DISCORD_BOT_SECRET`), so no Render disk is needed |

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

## Verified level roles
1. User signs in on faceit-lens.com, links FACEIT (Settings), presses **Get my code**.
2. In Discord: `/verify CODE`. The bot gives `FACEIT Level N` (creates the 10 roles on first use, in FACEIT colours).
3. Every 3 hours the bot refreshes levels and posts level-ups in a channel named `#level-ups` if it exists.

The bot needs the **Manage Roles** permission and its own role must sit above the `FACEIT Level` roles.
Invite URL permissions: Send Messages, Embed Links, Manage Roles.

## Tracking players in a server
- `/track add <nick>` · `/track remove <nick>` · `/track list` (add/remove/channel need **Manage Server**)
- `/elos` — anyone can post the ELO table of the tracked players (level, ELO, change today, last 5 matches).
- `/track channel #faceit` — every 10 minutes the bot posts a line when a tracked player finishes a match:
  result, map, score, K-D and the ELO change. `/track channel` with no channel turns it off.
- Up to 25 players per server.
