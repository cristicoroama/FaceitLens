# FaceitLens Discord Bot

Slash command `/faceit <nickname>` posts a player's CS2 stats as an embed.

Separate from the web app. Run it anywhere (locally or a Render Background Worker).

## Run locally
```bash
cd discord_bot
pip install -r requirements.txt
set DISCORD_TOKEN=your-bot-token       # Windows
set FACEIT_API_KEY=your-faceit-key
python bot.py
```

## Get a Discord token
1. https://discord.com/developers/applications -> New Application
2. Bot -> Reset Token -> copy
3. OAuth2 -> URL Generator -> scopes: bot, applications.commands -> invite to your server

## Host on Render (free)
New + -> Background Worker -> Root Directory: discord_bot ->
Build: pip install -r requirements.txt -> Start: python bot.py ->
add DISCORD_TOKEN and FACEIT_API_KEY env vars.
