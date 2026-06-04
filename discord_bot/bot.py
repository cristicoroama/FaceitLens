"""
FaceitLens Discord bot.
Slash command: /faceit <nickname> -> shows a player's CS2 stats.

This is a SEPARATE program from the web app. It needs its own hosting
(e.g. a Render Background Worker) and a Discord bot token.

Setup:
  1. https://discord.com/developers/applications -> New Application
  2. Bot -> Reset Token -> copy it
  3. Enable "applications.commands" scope, invite the bot to your server
  4. Set env vars DISCORD_TOKEN and FACEIT_API_KEY
  5. pip install -r requirements.txt && python bot.py
"""
import os
import requests
import discord
from discord import app_commands

DISCORD_TOKEN = os.environ["DISCORD_TOKEN"]
FACEIT_API_KEY = os.environ["FACEIT_API_KEY"]
BASE = "https://open.faceit.com/data/v4"
HEADERS = {"Authorization": f"Bearer {FACEIT_API_KEY}"}


def get_stats(nickname):
    p = requests.get(f"{BASE}/players", params={"nickname": nickname}, headers=HEADERS, timeout=10)
    if p.status_code != 200:
        return None
    player = p.json()
    cs2 = player.get("games", {}).get("cs2", {})
    pid = player["player_id"]
    s = requests.get(f"{BASE}/players/{pid}/stats/cs2", headers=HEADERS, timeout=10)
    life = s.json().get("lifetime", {}) if s.status_code == 200 else {}
    return {
        "nickname": player.get("nickname"),
        "avatar": player.get("avatar"),
        "elo": cs2.get("faceit_elo"),
        "level": cs2.get("skill_level"),
        "matches": life.get("Matches"),
        "win_rate": life.get("Win Rate %"),
        "kd": life.get("Average K/D Ratio"),
    }


intents = discord.Intents.default()
client = discord.Client(intents=intents)
tree = app_commands.CommandTree(client)


@tree.command(name="faceit", description="Show FACEIT CS2 stats for a player")
@app_commands.describe(nickname="FACEIT nickname")
async def faceit(interaction: discord.Interaction, nickname: str):
    await interaction.response.defer()
    data = get_stats(nickname)
    if not data:
        await interaction.followup.send(f"Player **{nickname}** not found.")
        return
    embed = discord.Embed(title=data["nickname"], color=0xFF5500)
    if data["avatar"]:
        embed.set_thumbnail(url=data["avatar"])
    embed.add_field(name="ELO", value=str(data["elo"] or "—"))
    embed.add_field(name="Level", value=str(data["level"] or "—"))
    embed.add_field(name="Matches", value=str(data["matches"] or "—"))
    embed.add_field(name="Win Rate", value=f'{data["win_rate"] or "—"}%')
    embed.add_field(name="Avg K/D", value=str(data["kd"] or "—"))
    embed.set_footer(text="FaceitLens")
    await interaction.followup.send(embed=embed)


@client.event
async def on_ready():
    await tree.sync()
    print(f"Logged in as {client.user}")


if __name__ == "__main__":
    client.run(DISCORD_TOKEN)
