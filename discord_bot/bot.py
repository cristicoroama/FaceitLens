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
  /elos                  ELO table of the players tracked in this server
  /track add|remove|list|channel   manage tracked players and the auto-update channel (Manage Server)
  /verify <code>         verified FACEIT level role (code from faceit-lens.com/settings)
  /unverify              remove your level role

Env:
  DISCORD_TOKEN          bot token
  FACEITLENS_API         https://<render-service>.onrender.com   (no trailing /api)
  FACEITLENS_API_KEY     optional, sent as X-API-Key
  DATA_PATH              optional, where links are stored (default ./links.json)
  DISCORD_BOT_SECRET     same value as on the backend, for /verify and role refresh
"""
import asyncio
import json
import os
import time

import discord
import requests
from discord import app_commands
from discord.ext import tasks

DISCORD_TOKEN = os.environ["DISCORD_TOKEN"]
API = os.environ.get("FACEITLENS_API", "").rstrip("/")
API_KEY = os.environ.get("FACEITLENS_API_KEY", "")
BOT_SECRET = os.environ.get("DISCORD_BOT_SECRET", "")
LEVEL_COLORS = {1: 0xEEEEEE, 2: 0x1CE400, 3: 0x1CE400, 4: 0xFFC800, 5: 0xFFC800, 6: 0xFFC800,
                7: 0xFFC800, 8: 0xFF6309, 9: 0xFF6309, 10: 0xFE1F00}
ROLE_PREFIX = "FACEIT Level "
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


def _bot(method, path, body=None):
    headers = {"X-Bot-Secret": BOT_SECRET}
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    r = requests.request(method, f"{API}{path}", json=body, headers=headers, timeout=25)
    try:
        data = r.json()
    except ValueError:
        data = {}
    if r.status_code != 200:
        raise RuntimeError(data.get("error") or f"API error {r.status_code}")
    return data


async def bot_call(method, path, body=None):
    return await asyncio.to_thread(_bot, method, path, body)


async def level_role(guild, level):
    name = f"{ROLE_PREFIX}{level}"
    role = discord.utils.get(guild.roles, name=name)
    if role is None:
        role = await guild.create_role(name=name, colour=discord.Colour(LEVEL_COLORS.get(level, 0x999999)),
                                       hoist=True, reason="FaceitLens verified level roles")
    return role


async def apply_level(member, level):
    if not level:
        return
    target = await level_role(member.guild, int(level))
    stale = [r for r in member.roles if r.name.startswith(ROLE_PREFIX) and r != target]
    if stale:
        await member.remove_roles(*stale, reason="FaceitLens level update")
    if target not in member.roles:
        await member.add_roles(target, reason="FaceitLens level update")


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


MAX_TRACKED = 25


def tracked(data, gid):
    return data.setdefault("_track", {}).setdefault(str(gid), {"channel": None, "players": {}})


async def elo_rows(nicks):
    if not nicks:
        return []
    q = ",".join(requests.utils.quote(n) for n in nicks)
    return (await fetch(f"/api/elo/?nicks={q}")).get("players", [])


def form(row):
    return "".join("🟩" if m.get("win") else "🟥" for m in reversed(row.get("last") or [])) or "—"


def today():
    return time.strftime("%Y-%m-%d", time.gmtime())


track = app_commands.Group(name="track", description="Players this server follows")


@track.command(name="add", description="Track a FACEIT player in this server")
@app_commands.describe(nickname="FACEIT nickname")
@app_commands.default_permissions(manage_guild=True)
async def track_add(interaction: discord.Interaction, nickname: str):
    await interaction.response.defer(ephemeral=True)
    if not interaction.guild:
        return await fail(interaction, "Use this inside a server.")
    data = load_links()
    t = tracked(data, interaction.guild.id)
    if len(t["players"]) >= MAX_TRACKED:
        return await fail(interaction, f"This server already tracks {MAX_TRACKED} players.")
    rows = await elo_rows([nickname])
    if not rows or not rows[0].get("found"):
        return await fail(interaction, f"No FACEIT player called **{nickname}** (nicknames are case-sensitive).")
    r = rows[0]
    t["players"][r["nickname"].lower()] = {
        "nick": r["nickname"], "elo": r.get("elo"), "day": today(), "day_elo": r.get("elo"),
        "last_match": (r.get("last") or [{}])[0].get("match_id"),
    }
    save_links(data)
    await interaction.followup.send(f"Tracking **{r['nickname']}** · Level {r.get('level')} · {r.get('elo')} ELO.", ephemeral=True)


@track.command(name="remove", description="Stop tracking a player")
@app_commands.describe(nickname="FACEIT nickname")
@app_commands.default_permissions(manage_guild=True)
async def track_remove(interaction: discord.Interaction, nickname: str):
    data = load_links()
    t = tracked(data, interaction.guild_id)
    gone = t["players"].pop(nickname.lower(), None)
    save_links(data)
    await interaction.response.send_message(
        f"Removed **{gone['nick']}**." if gone else f"**{nickname}** wasn't tracked.", ephemeral=True)


@track.command(name="list", description="Players tracked in this server")
async def track_list(interaction: discord.Interaction):
    t = tracked(load_links(), interaction.guild_id)
    names = ", ".join(p["nick"] for p in t["players"].values()) or "nobody yet — use `/track add`"
    ch = f"<#{t['channel']}>" if t.get("channel") else "off"
    await interaction.response.send_message(f"**Tracked ({len(t['players'])}/{MAX_TRACKED}):** {names}\n**Auto updates:** {ch}",
                                            ephemeral=True)


@track.command(name="channel", description="Post match results of tracked players in a channel")
@app_commands.describe(channel="Channel for updates (leave empty to turn updates off)")
@app_commands.default_permissions(manage_guild=True)
async def track_channel(interaction: discord.Interaction, channel: discord.TextChannel = None):
    data = load_links()
    t = tracked(data, interaction.guild_id)
    t["channel"] = channel.id if channel else None
    save_links(data)
    await interaction.response.send_message(
        f"Match updates will be posted in {channel.mention}." if channel else "Auto updates turned off.", ephemeral=True)


tree.add_command(track)


@tree.command(name="elos", description="ELO table of the players tracked in this server")
async def elos(interaction: discord.Interaction):
    await interaction.response.defer()
    data = load_links()
    t = tracked(data, interaction.guild_id)
    if not t["players"]:
        return await interaction.followup.send("Nobody is tracked yet. An admin can add players with `/track add`.", view=buttons())
    rows = [r for r in await elo_rows([p["nick"] for p in t["players"].values()]) if r.get("found")]
    rows.sort(key=lambda r: -(r.get("elo") or 0))
    lines = []
    for i, r in enumerate(rows, 1):
        st = t["players"].get(r["nickname"].lower(), {})
        if st.get("day") != today():
            st["day"], st["day_elo"] = today(), r.get("elo")
        d = (r.get("elo") or 0) - (st.get("day_elo") or r.get("elo") or 0)
        delta = f" ({'+' if d > 0 else ''}{d} today)" if d else ""
        lines.append(f"`{i:>2}` **[{r['nickname']}]({profile_url(r['nickname'])})** · Lvl {r.get('level')} · "
                     f"**{r.get('elo')}**{delta}  {form(r)}")
    save_links(data)
    e = discord.Embed(title="FACEIT ELO", description="\n".join(lines), color=ORANGE)
    e.set_footer(text=FOOTER)
    await interaction.followup.send(embed=e, view=buttons())


@tasks.loop(minutes=10)
async def post_match_updates():
    if not API:
        return
    data = load_links()
    changed = False
    for gid, t in list(data.get("_track", {}).items()):
        if not t.get("channel") or not t.get("players"):
            continue
        channel = client.get_channel(int(t["channel"]))
        if channel is None:
            continue
        try:
            rows = await elo_rows([p["nick"] for p in t["players"].values()])
        except Exception:
            continue
        for r in rows:
            if not r.get("found"):
                continue
            st = t["players"].get(r["nickname"].lower())
            if not st:
                continue
            last = (r.get("last") or [{}])[0]
            mid = last.get("match_id")
            if mid and mid != st.get("last_match") and st.get("last_match") is not None:
                old, new = st.get("elo"), r.get("elo")
                diff = (new - old) if (old is not None and new is not None) else None
                res = "won" if last.get("win") else "lost"
                kd = f" · {last.get('kills')}-{last.get('deaths')}" if last.get("kills") is not None else ""
                elo_txt = f" · ELO {old} → **{new}** ({'+' if diff and diff > 0 else ''}{diff})" if diff is not None else f" · **{new}** ELO"
                e = discord.Embed(
                    description=f"{'🟩' if last.get('win') else '🟥'} **[{r['nickname']}]({profile_url(r['nickname'])})** {res} on "
                                f"**{(last.get('map') or '?').replace('de_', '').title()}** {last.get('score') or ''}{kd}{elo_txt}",
                    color=0x3DD67F if last.get("win") else 0xFF5A5A)
                try:
                    await channel.send(embed=e)
                except discord.Forbidden:
                    break
            if mid:
                st["last_match"] = mid
            st["elo"] = r.get("elo")
            changed = True
    if changed:
        save_links(data)


@tree.command(name="verify", description="Get your verified FACEIT level role")
@app_commands.describe(code="Code from faceit-lens.com/settings")
async def verify(interaction: discord.Interaction, code: str):
    await interaction.response.defer(ephemeral=True)
    if not interaction.guild:
        return await fail(interaction, "Use this inside a server.")
    try:
        info = await bot_call("POST", "/api/discord/claim/", {"code": code, "discord_id": str(interaction.user.id)})
    except Exception as exc:
        return await fail(interaction, str(exc))
    data = load_links()
    v = data.setdefault("_verified", {}).setdefault(str(interaction.guild.id), {})
    v[str(interaction.user.id)] = {"player_id": info["player_id"], "level": info.get("level")}
    save_links(data)
    try:
        await apply_level(interaction.user, info.get("level"))
    except discord.Forbidden:
        return await fail(interaction, "Verified, but I can't manage roles here. An admin must give me Manage Roles "
                                       "and move my role above the level roles.")
    await interaction.followup.send(
        f"Verified as **{info.get('nickname')}** · Level {info.get('level')} · {info.get('elo')} ELO. "
        "Your role updates automatically when you level up.", ephemeral=True)


@tree.command(name="unverify", description="Remove your FACEIT level role")
async def unverify(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)
    data = load_links()
    data.get("_verified", {}).get(str(interaction.guild_id), {}).pop(str(interaction.user.id), None)
    save_links(data)
    try:
        await bot_call("POST", "/api/discord/unlink/", {"discord_id": str(interaction.user.id)})
    except Exception:
        pass
    if isinstance(interaction.user, discord.Member):
        stale = [r for r in interaction.user.roles if r.name.startswith(ROLE_PREFIX)]
        if stale:
            try:
                await interaction.user.remove_roles(*stale, reason="FaceitLens unverify")
            except discord.Forbidden:
                pass
    await interaction.followup.send("Done. Your level role was removed.", ephemeral=True)


@tasks.loop(hours=3)
async def refresh_levels():
    if not (API and BOT_SECRET):
        return
    data = load_links()
    verified = data.get("_verified", {})
    for gid, users in list(verified.items()):
        guild = client.get_guild(int(gid))
        if not guild or not users:
            continue
        ids = ",".join(sorted({u["player_id"] for u in users.values()}))
        try:
            players = (await bot_call("GET", f"/api/discord/levels/?ids={ids}")).get("players", {})
        except Exception:
            continue
        channel = discord.utils.get(guild.text_channels, name="level-ups")
        for uid, row in list(users.items()):
            p = players.get(row["player_id"])
            try:
                member = guild.get_member(int(uid)) or await guild.fetch_member(int(uid))
            except (discord.NotFound, discord.HTTPException):
                users.pop(uid, None)
                continue
            if p is None:
                stale = [r for r in member.roles if r.name.startswith(ROLE_PREFIX)]
                if stale:
                    try:
                        await member.remove_roles(*stale, reason="FaceitLens link removed")
                    except discord.Forbidden:
                        pass
                users.pop(uid, None)
                continue
            old, new = row.get("level"), p.get("level")
            try:
                await apply_level(member, new)
            except discord.Forbidden:
                break
            if channel and old and new and int(new) > int(old):
                try:
                    await channel.send(f"🎉 {member.mention} just reached **FACEIT Level {new}** ({p.get('elo')} ELO)!")
                except discord.Forbidden:
                    pass
            row["level"] = new
    save_links(data)


@client.event
async def on_ready():
    await tree.sync()
    if not refresh_levels.is_running():
        refresh_levels.start()
    if not post_match_updates.is_running():
        post_match_updates.start()
    print(f"Logged in as {client.user}")


if __name__ == "__main__":
    if not API:
        raise SystemExit("Set FACEITLENS_API to your backend URL, e.g. https://faceitlens.onrender.com")
    client.run(DISCORD_TOKEN)
