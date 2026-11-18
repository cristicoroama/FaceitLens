"""
FaceitLens Discord bot.

Slash commands:
  /elo <nick>            ELO, level and last-10 form
  /stats <nick>          full card with the generated profile image
  /season <nick>         Season 9 report + Season 10 placements
  /roast <nick>          AI roast
  /compare <a> <b>       head to head
  /link <nick>           link your FACEIT nickname in this server
  /unlink                remove your link
  /leaderboard           this week's ELO race between linked members
  /pickem <code>         a FaceitLens Pick'em league table

Env:
  DISCORD_TOKEN          bot token
  FACEITLENS_API         https://<render-service>.onrender.com   (no trailing /api)
  FACEITLENS_API_KEY     optional, sent as X-API-Key
  DATA_PATH              optional, where links are stored (default ./links.json)
"""
import asyncio
import json
import os
import time

import discord
import requests
from discord import app_commands

DISCORD_TOKEN = os.environ["DISCORD_TOKEN"]
API = os.environ.get("FACEITLENS_API", "").rstrip("/")
API_KEY = os.environ.get("FACEITLENS_API_KEY", "")
DATA_PATH = os.environ.get("DATA_PATH", os.path.join(os.path.dirname(__file__), "links.json"))
SITE = "https://faceit-lens.com"
INVITE = "https://discord.gg/p5GeaTEYdt"
ORANGE = 0xFF5500
FOOTER = "faceit-lens.com · join the FaceitLens Discord for leaderboards and support"


def _get(path, timeout=25):
    headers = {"X-API-Key": API_KEY} if API_KEY else {}
    r = requests.get(f"{API}{path}", headers=headers, timeout=timeout)
    try:
        data = r.json()
    except ValueError:
        data = {}
    if r.status_code != 200:
        raise RuntimeError(data.get("error") or f"API error {r.status_code}")
    return data


async def fetch(path, timeout=25):
    return await asyncio.to_thread(_get, path, timeout)


def player(nick):
    return f"/api/player/{requests.utils.quote(nick)}/"


def load_links():
    try:
        with open(DATA_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_links(data):
    tmp = DATA_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f)
    os.replace(tmp, DATA_PATH)


def profile_url(nick):
    return f"{SITE}/player/{requests.utils.quote(nick)}"


def buttons(nick=None, extra=None):
    v = discord.ui.View()
    if nick:
        v.add_item(discord.ui.Button(label="Open profile", url=profile_url(nick)))
    if extra:
        v.add_item(extra)
    v.add_item(discord.ui.Button(label="Join FaceitLens Discord", url=INVITE))
    return v


def form_line(p):
    rm = p.get("recent_matches") or []
    marks = []
    for m in rm[:10]:
        if m.get("won") is True:
            marks.append("🟩")
        elif m.get("won") is False:
            marks.append("🟥")
    return "".join(marks) or "—"


def base_embed(p, title=None):
    e = discord.Embed(title=title or p.get("nickname"), url=profile_url(p.get("nickname")), color=ORANGE)
    if p.get("avatar"):
        e.set_thumbnail(url=p["avatar"])
    e.set_footer(text=FOOTER)
    return e


intents = discord.Intents.default()
client = discord.Client(intents=intents)
tree = app_commands.CommandTree(client)


async def fail(interaction, msg):
    await interaction.followup.send(f"⚠️ {msg}", ephemeral=True)


@tree.command(name="elo", description="FACEIT ELO, level and recent form")
@app_commands.describe(nickname="FACEIT nickname")
async def elo(interaction: discord.Interaction, nickname: str):
    await interaction.response.defer()
    try:
        p = await fetch(player(nickname))
    except Exception as exc:
        return await fail(interaction, str(exc))
    e = base_embed(p)
    e.add_field(name="ELO", value=f"**{p.get('elo') or '—'}**")
    e.add_field(name="Level", value=str(p.get("skill_level") or "—"))
    s = p.get("stats") or {}
    e.add_field(name="Win rate", value=f"{s.get('win_rate') or '—'}%")
    e.add_field(name="Last 10", value=form_line(p), inline=False)
    await interaction.followup.send(embed=e, view=buttons(p.get("nickname")))


@tree.command(name="stats", description="Full FACEIT stats card")
@app_commands.describe(nickname="FACEIT nickname")
async def stats(interaction: discord.Interaction, nickname: str):
    await interaction.response.defer()
    try:
        p = await fetch(player(nickname))
    except Exception as exc:
        return await fail(interaction, str(exc))
    s = p.get("stats") or {}
    e = base_embed(p)
    e.add_field(name="ELO", value=str(p.get("elo") or "—"))
    e.add_field(name="Level", value=str(p.get("skill_level") or "—"))
    e.add_field(name="Matches", value=str(s.get("matches") or "—"))
    e.add_field(name="Win rate", value=f"{s.get('win_rate') or '—'}%")
    e.add_field(name="K/D", value=str(s.get("avg_kd") or "—"))
    e.add_field(name="HS", value=f"{s.get('avg_hs') or '—'}%")
    e.set_image(url=f"{SITE}/og/{requests.utils.quote(p.get('nickname') or nickname)}.png?t={int(time.time() // 3600)}")
    await interaction.followup.send(embed=e, view=buttons(p.get("nickname")))


@tree.command(name="season", description="Season 9 report and Season 10 placements")
@app_commands.describe(nickname="FACEIT nickname")
async def season(interaction: discord.Interaction, nickname: str):
    await interaction.response.defer()
    try:
        p = await fetch(player(nickname))
    except Exception as exc:
        return await fail(interaction, str(exc))
    ins = p.get("insights") or {}
    r = ins.get("season_report") or {}
    pl = ins.get("placement") or {}
    e = base_embed(p, f"{p.get('nickname')} · Season {r.get('season', 9)}")
    if r.get("matches"):
        ch = (r.get("elo") or {}).get("change")
        est = " (est.)" if (r.get("elo") or {}).get("estimated") else ""
        e.description = f"**{r.get('title')}**"
        e.add_field(name="Matches", value=f"{r['matches']} ({r['wins']}W {r['losses']}L)")
        e.add_field(name="Win rate", value=f"{r.get('win_rate')}%")
        e.add_field(name="ELO", value=f"{'+' if ch and ch > 0 else ''}{ch}{est}")
        e.add_field(name="K/D · ADR", value=f"{r.get('kd')} · {r.get('adr')}")
        if r.get("best_map"):
            e.add_field(name="Best map", value=f"{r['best_map']['map']} ({r['best_map']['win_rate']}%)")
        e.add_field(name="Streaks", value=f"{r.get('longest_win_streak')}W / {r.get('longest_loss_streak')}L")
    else:
        e.description = "No matches this season."
    if pl.get("status") in ("in_progress", "done"):
        marks = "".join("🟩" if x == "W" else "🟥" for x in pl.get("results") or [])
        e.add_field(name=f"Season {pl['season']} placements {pl['played']}/{pl['need']}", value=marks or "—", inline=False)
    elif pl.get("status") == "upcoming":
        e.add_field(name=f"Season {pl['season']}", value=f"Starts <t:{pl['starts_at']}:R>", inline=False)
    await interaction.followup.send(embed=e, view=buttons(p.get("nickname")))


@tree.command(name="roast", description="Let the AI roast a FACEIT player")
@app_commands.describe(nickname="FACEIT nickname")
async def roast(interaction: discord.Interaction, nickname: str):
    await interaction.response.defer()
    try:
        r = await fetch(f"/api/roast/{requests.utils.quote(nickname)}/", timeout=60)
    except Exception as exc:
        return await fail(interaction, str(exc))
    e = discord.Embed(title=f"🔥 Roasting {nickname}", description=(r.get("roast") or "")[:4000], color=ORANGE,
                      url=profile_url(nickname))
    e.set_footer(text=FOOTER)
    await interaction.followup.send(embed=e, view=buttons(nickname))


@tree.command(name="compare", description="Head to head between two players")
@app_commands.describe(a="First nickname", b="Second nickname")
async def compare(interaction: discord.Interaction, a: str, b: str):
    await interaction.response.defer()
    try:
        pa, pb = await asyncio.gather(fetch(player(a)), fetch(player(b)))
    except Exception as exc:
        return await fail(interaction, str(exc))

    def num(v):
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    rows = [
        ("ELO", pa.get("elo"), pb.get("elo")),
        ("Win rate %", (pa.get("stats") or {}).get("win_rate"), (pb.get("stats") or {}).get("win_rate")),
        ("K/D", (pa.get("stats") or {}).get("avg_kd"), (pb.get("stats") or {}).get("avg_kd")),
        ("HS %", (pa.get("stats") or {}).get("avg_hs"), (pb.get("stats") or {}).get("avg_hs")),
        ("Matches", (pa.get("stats") or {}).get("matches"), (pb.get("stats") or {}).get("matches")),
    ]
    lines = []
    score = [0, 0]
    for label, x, y in rows:
        nx, ny = num(x), num(y)
        mark = ""
        if nx is not None and ny is not None and nx != ny:
            if nx > ny:
                score[0] += 1
                mark = "◀"
            else:
                score[1] += 1
                mark = "▶"
        lines.append(f"`{label:<11}` **{x or '—'}** {mark} **{y or '—'}**")
    e = discord.Embed(title=f"{pa.get('nickname')} vs {pb.get('nickname')}", description="\n".join(lines), color=ORANGE)
    e.add_field(name="Verdict", value=f"{pa.get('nickname')} {score[0]} – {score[1]} {pb.get('nickname')}")
    e.set_footer(text=FOOTER)
    await interaction.followup.send(embed=e, view=buttons())


@tree.command(name="link", description="Link your FACEIT nickname for /leaderboard")
@app_commands.describe(nickname="Your FACEIT nickname")
async def link(interaction: discord.Interaction, nickname: str):
    await interaction.response.defer(ephemeral=True)
    if not interaction.guild:
        return await fail(interaction, "Use this inside a server.")
    try:
        p = await fetch(player(nickname))
    except Exception as exc:
        return await fail(interaction, str(exc))
    data = load_links()
    data.setdefault(str(interaction.guild.id), {})[str(interaction.user.id)] = p.get("nickname")
    save_links(data)
    await interaction.followup.send(f"Linked to **{p.get('nickname')}** ({p.get('elo')} ELO).", ephemeral=True)


@tree.command(name="unlink", description="Remove your FACEIT link in this server")
async def unlink(interaction: discord.Interaction):
    data = load_links()
    data.get(str(interaction.guild_id), {}).pop(str(interaction.user.id), None)
    save_links(data)
    await interaction.response.send_message("Unlinked.", ephemeral=True)


@tree.command(name="leaderboard", description="This week's ELO race between linked members")
async def leaderboard(interaction: discord.Interaction):
    await interaction.response.defer()
    links = load_links().get(str(interaction.guild_id), {})
    if not links:
        return await interaction.followup.send("Nobody is linked yet. Use `/link <nickname>`.", view=buttons())
    nicks = list(dict.fromkeys(links.values()))[:25]
    results = await asyncio.gather(*(fetch(player(n)) for n in nicks), return_exceptions=True)
    since = time.time() - 7 * 86400
    rows = []
    for n, p in zip(nicks, results):
        if isinstance(p, Exception):
            continue
        ms = [m for m in p.get("all_matches") or [] if (m.get("finished_at") or 0) >= since]
        w = sum(1 for m in ms if m.get("won"))
        rows.append((p.get("nickname") or n, len(ms), w, (w - (len(ms) - w)) * 25, p.get("elo")))
    rows.sort(key=lambda r: (-r[3], -r[1]))
    medals = ["🥇", "🥈", "🥉"]
    lines = []
    for i, (n, m, w, d, elo) in enumerate(rows):
        tag = medals[i] if i < 3 else f"`{i + 1:>2}`"
        sign = "+" if d > 0 else ""
        lines.append(f"{tag} **{n}** · {sign}{d} ELO · {w}-{m - w} · now {elo}")
    e = discord.Embed(title="This week on FACEIT", description="\n".join(lines) or "No matches this week.", color=ORANGE)
    e.set_footer(text="ELO change estimated at ±25 per match · " + FOOTER)
    await interaction.followup.send(embed=e, view=buttons())


@tree.command(name="pickem", description="Show a FaceitLens Pick'em league")
@app_commands.describe(code="League code from faceit-lens.com/pickem")
async def pickem(interaction: discord.Interaction, code: str):
    await interaction.response.defer()
    try:
        lg = await fetch(f"/api/pickem/league/{requests.utils.quote(code.upper())}/")
    except Exception as exc:
        return await fail(interaction, str(exc))
    lines = []
    for r in lg.get("rows", [])[:20]:
        per = " · ".join("—" if x is None else str(x) for x in r.get("stages") or [])
        lines.append(f"`{r['position']:>2}` **{r['name']}** — {r['total']} pts  ({per})")
    e = discord.Embed(title=f"{lg.get('name')} · {lg.get('event')}", description="\n".join(lines) or "No picks yet.",
                      color=ORANGE, url=f"{SITE}/pickem?league={lg.get('code')}")
    e.set_footer(text=FOOTER)
    join = discord.ui.Button(label="Join this league", url=f"{SITE}/pickem?league={lg.get('code')}")
    await interaction.followup.send(embed=e, view=buttons(extra=join))


@client.event
async def on_ready():
    await tree.sync()
    print(f"Logged in as {client.user}")


if __name__ == "__main__":
    if not API:
        raise SystemExit("Set FACEITLENS_API to your backend URL, e.g. https://faceitlens.onrender.com")
    client.run(DISCORD_TOKEN)
