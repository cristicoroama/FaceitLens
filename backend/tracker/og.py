"""1200x630 Open Graph card per player: GET /api/og/<nickname>.png"""
import io
import os

import requests
from django.core.cache import cache
from django.http import HttpResponse, HttpResponseRedirect
from django.views.decorators.http import require_GET
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from . import faceit

W, H = 1200, 630
BG = (11, 11, 14)
PANEL = (22, 22, 28)
TEXT = (240, 240, 244)
DIM = (150, 150, 162)
ACCENT = (255, 85, 0)
WIN = (61, 214, 127)
LOSS = (255, 90, 90)
FONT_DIR = os.path.join(os.path.dirname(__file__), "data", "fonts")
TTL = 60 * 60
FALLBACK = "https://faceit-lens.com/og.png"


def _font(name, size):
    try:
        return ImageFont.truetype(os.path.join(FONT_DIR, name), size)
    except OSError:
        return ImageFont.load_default(size)


def _level_color(level):
    if not level or level <= 1:
        return (238, 238, 238)
    if level <= 3:
        return (28, 228, 0)
    if level <= 7:
        return (255, 200, 0)
    if level <= 9:
        return (255, 99, 9)
    return (254, 31, 0)


LEVEL_GRADIENT = {
    1: ("#d4d4d4", "#8f8f8f"), 2: ("#32e15f", "#1a8f38"), 3: ("#32e15f", "#1a8f38"),
    4: ("#ffc400", "#b57e00"), 5: ("#ffc400", "#b57e00"), 6: ("#ffc400", "#b57e00"),
    7: ("#ffc400", "#b57e00"), 8: ("#ff7a26", "#b54400"), 9: ("#ff7a26", "#b54400"),
    10: ("#ff5a4d", "#b3160b"),
}
ARC_START, ARC_SWEEP = 130.67, 278.66


def _hex(c):
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def _vgrad(size, top, bottom, split=0.5):
    g = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(g)
    t, b = _hex(top), _hex(bottom)
    for y in range(size):
        k = max(0.0, (y / size - split) / (1 - split))
        d.line((0, y, size, y), fill=tuple(round(t[i] + (b[i] - t[i]) * k) for i in range(3)))
    return g


def level_badge(level, size):
    """The site's FACEIT level badge (RankIcons.jsx), drawn at 4x and scaled down."""
    lvl = max(1, min(10, int(level or 1)))
    S = size * 4
    u = S / 24
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((0, 0, S - 1, S - 1), fill=(6, 6, 6, 255))
    r, w = 8.4 * u, round(2.4 * u)
    box = (12 * u - r - w / 2, 12 * u - r - w / 2, 12 * u + r + w / 2, 12 * u + r + w / 2)
    track = Image.new("L", (S, S), 0)
    ImageDraw.Draw(track).arc(box, ARC_START, ARC_START + ARC_SWEEP, fill=255, width=w)
    img.paste(_vgrad(S, "#5d5d5d", "#242424", 0.3), (0, 0), track)
    frm, to = LEVEL_GRADIENT[lvl]
    fill = 1.0 if lvl == 10 else lvl / 10
    arc = Image.new("L", (S, S), 0)
    ImageDraw.Draw(arc).arc(box, ARC_START, ARC_START + ARC_SWEEP * fill, fill=255, width=w)
    grad = _vgrad(S, frm, to)
    img.paste(grad, (0, 0), arc)
    txt = Image.new("L", (S, S), 0)
    td = ImageDraw.Draw(txt)
    f = _font("DejaVuSans-Bold.ttf", round(8 * u * (0.82 if lvl == 10 else 1)))
    t = str(lvl)
    bb = td.textbbox((0, 0), t, font=f)
    td.text((S / 2 - (bb[0] + bb[2]) / 2, S * 0.49 - (bb[1] + bb[3]) / 2), t, font=f, fill=255)
    img.paste(grad, (0, 0), txt)
    return img.resize((size, size), Image.LANCZOS)


def _avatar(url, size):
    img = None
    if url:
        try:
            r = requests.get(url, timeout=4)
            if r.ok:
                img = Image.open(io.BytesIO(r.content)).convert("RGB")
        except Exception:
            img = None
    if img is None:
        img = Image.new("RGB", (size, size), PANEL)
    img = img.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size, size), radius=size // 6, fill=255)
    return img, mask


def _fit(draw, text, font_name, size, max_w, min_size=28):
    while size > min_size:
        f = _font(font_name, size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 4
    return _font(font_name, min_size)


def _data(nickname):
    from . import privacy
    privacy.check(nickname=nickname)
    p = faceit.get_player_by_nickname(nickname)
    pid = p["player_id"]
    cs2 = (p.get("games") or {}).get(faceit.GAME) or {}
    privacy.check(player_id=pid, steamid=cs2.get("game_player_id"), nickname=p.get("nickname"))
    life = {}
    try:
        life = (faceit.get_player_stats(pid) or {}).get("lifetime") or {}
    except Exception:
        pass
    form = []
    try:
        for it in faceit.get_match_stats(pid, limit=10):
            r = faceit._to_int((it.get("stats") or {}).get("Result"))
            if r is not None:
                form.append(r == 1)
    except Exception:
        pass
    return {
        "nickname": p.get("nickname") or nickname,
        "avatar": p.get("avatar"),
        "country": (p.get("country") or "").upper(),
        "elo": cs2.get("faceit_elo"),
        "level": cs2.get("skill_level"),
        "verified": p.get("verified"),
        "win_rate": life.get("Win Rate %"),
        "kd": life.get("Average K/D Ratio"),
        "hs": life.get("Average Headshots %"),
        "matches": life.get("Matches"),
        "form": form,
    }


def render(d):
    img = Image.new("RGB", (W, H), BG)
    glow = Image.new("RGB", (W, H), BG)
    gd = ImageDraw.Draw(glow)
    gd.ellipse((760, -320, 1500, 360), fill=(70, 26, 6))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    img = Image.blend(img, glow, 0.9)
    dr = ImageDraw.Draw(img)
    for x in range(0, W, 60):
        dr.line((x, 0, x, H), fill=(16, 16, 20))
    for y in range(0, H, 60):
        dr.line((0, y, W, y), fill=(16, 16, 20))
    dr.rectangle((0, 0, W, 6), fill=ACCENT)

    av, mask = _avatar(d.get("avatar"), 200)
    img.paste(av, (70, 92), mask)
    dr.rounded_rectangle((68, 90, 272, 294), radius=36, outline=_level_color(d.get("level")), width=4)

    x0 = 310
    name_font = _fit(dr, d["nickname"], "DejaVuSans-Bold.ttf", 76, W - x0 - 70)
    dr.text((x0, 92), d["nickname"], font=name_font, fill=TEXT)
    sub = " · ".join(filter(None, [d.get("country"), "FACEIT CS2", "Verified" if d.get("verified") else None]))
    dr.text((x0, 186), sub, font=_font("DejaVuSans.ttf", 26), fill=DIM)

    lvl = d.get("level")
    cy = 262
    if lvl:
        badge = level_badge(lvl, 80)
        img.paste(badge, (x0 - 4, cy - 38), badge)
    elo = f"{d['elo']:,}" if isinstance(d.get("elo"), int) else "—"
    ef = _font("DejaVuSansMono-Bold.ttf", 64)
    dr.text((x0 + 94, cy - 36), elo, font=ef, fill=ACCENT)
    dr.text((x0 + 104 + dr.textlength(elo, font=ef), cy), "ELO", font=_font("DejaVuSans-Bold.ttf", 24), fill=DIM)

    def fmt(v, suffix=""):
        if v in (None, ""):
            return "—"
        try:
            f = float(v)
            return f"{f:.2f}{suffix}" if suffix == "" and f < 10 else f"{int(round(f)):,}{suffix}"
        except (TypeError, ValueError):
            return str(v)

    boxes = [
        ("WIN RATE", fmt(d.get("win_rate"), "%")),
        ("K/D", fmt(d.get("kd"))),
        ("HEADSHOTS", fmt(d.get("hs"), "%")),
        ("MATCHES", fmt(d.get("matches"), " ")),
    ]
    bw, bh, gap, by = 245, 120, 20, 350
    for i, (lbl, val) in enumerate(boxes):
        bx = 70 + i * (bw + gap)
        dr.rounded_rectangle((bx, by, bx + bw, by + bh), radius=18, fill=PANEL)
        dr.text((bx + 22, by + 20), lbl, font=_font("DejaVuSans-Bold.ttf", 18), fill=DIM)
        dr.text((bx + 22, by + 50), val.strip(), font=_font("DejaVuSansMono-Bold.ttf", 44), fill=TEXT)

    form = d.get("form") or []
    if form:
        dr.text((70, 512), "LAST 10", font=_font("DejaVuSans-Bold.ttf", 18), fill=DIM)
        for i, w in enumerate(reversed(form[:10])):
            fx = 70 + i * 40
            dr.rounded_rectangle((fx, 542, fx + 30, 572), radius=7, fill=WIN if w else LOSS)
    brand = "faceit-lens.com"
    bf = _font("DejaVuSans-Bold.ttf", 30)
    dr.text((W - 70 - dr.textlength(brand, font=bf), 538), brand, font=bf, fill=TEXT)
    dr.rectangle((W - 70 - dr.textlength(brand, font=bf), 580, W - 70, 584), fill=ACCENT)

    out = io.BytesIO()
    img.save(out, "PNG", optimize=True)
    return out.getvalue()


@require_GET
def og_image(request, nickname):
    nickname = (nickname or "").removesuffix(".png").strip()[:40]
    if not nickname:
        return HttpResponseRedirect(FALLBACK)
    key = f"og:{nickname.lower()}"
    png = cache.get(key)
    if png is None:
        try:
            png = render(_data(nickname))
        except Exception:
            return HttpResponseRedirect(FALLBACK)
        cache.set(key, png, TTL)
    resp = HttpResponse(png, content_type="image/png")
    resp["Cache-Control"] = "public, max-age=3600, s-maxage=21600"
    resp["Access-Control-Allow-Origin"] = "*"
    return resp


MAP_DIR = os.path.join(os.path.dirname(__file__), "data", "maps")


def _map_img(name, w, h):
    key = (name or "").lower().replace("de_", "").replace(" ", "_")
    path = os.path.join(MAP_DIR, f"{key}.webp")
    try:
        im = Image.open(path).convert("RGB")
    except OSError:
        return Image.new("RGB", (w, h), PANEL)
    r = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    left, top = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((left, top, left + w, top + h))


def _rounded(im, radius):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius=radius, fill=255)
    return mask


def _base(w, h):
    img = Image.new("RGB", (w, h), BG)
    dr = ImageDraw.Draw(img)
    dr.rectangle((0, 0, w, 6), fill=ACCENT)
    return img, dr


def _wr_color(v):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return DIM
    return WIN if v >= 50 else LOSS


def render_maps(nickname, avatar, level, maps):
    rows = [m for m in maps if m.get("matches")][:8]
    W = 1200
    H = 150 + max(1, len(rows)) * 86 + 40
    img, dr = _base(W, H)
    av, mask = _avatar(avatar, 64)
    img.paste(av, (48, 40), mask)
    dr.text((128, 40), nickname, font=_font("DejaVuSans-Bold.ttf", 40), fill=TEXT)
    dr.text((130, 88), "MAP PERFORMANCE · FACEIT CS2", font=_font("DejaVuSans-Bold.ttf", 16), fill=DIM)
    if level:
        b = level_badge(level, 56)
        img.paste(b, (W - 48 - 56, 44), b)
    heads = [("MATCHES", 520), ("WIN RATE", 680), ("K/D", 850), ("ADR", 960), ("HS", 1070)]
    for t, x in heads:
        dr.text((x, 128), t, font=_font("DejaVuSans-Bold.ttf", 14), fill=DIM)
    best = max(rows, key=lambda m: (float(m.get("win_rate") or 0), m["matches"]), default=None)
    worst = min(rows, key=lambda m: (float(m.get("win_rate") or 0), -m["matches"]), default=None)
    y = 152
    mono, bold = _font("DejaVuSansMono-Bold.ttf", 26), _font("DejaVuSans-Bold.ttf", 24)
    for m in rows:
        dr.rounded_rectangle((48, y, W - 48, y + 74), radius=14, fill=PANEL)
        thumb = _map_img(m["map"], 150, 74)
        img.paste(thumb, (48, y), _rounded(thumb, 14))
        dr.text((220, y + 22), m["map"], font=bold, fill=TEXT)
        tag = "BEST" if m is best and len(rows) > 1 else "WORST" if m is worst and len(rows) > 1 else None
        if tag:
            tx = 220 + dr.textlength(m["map"], font=bold) + 14
            col = WIN if tag == "BEST" else LOSS
            dr.rounded_rectangle((tx, y + 25, tx + 70, y + 49), radius=6, outline=col, width=2)
            f = _font("DejaVuSans-Bold.ttf", 13)
            dr.text((tx + 35 - dr.textlength(tag, font=f) / 2, y + 29), tag, font=f, fill=col)
        wr = m.get("win_rate")
        dr.text((520, y + 22), f"{m['matches']:,}", font=mono, fill=TEXT)
        dr.text((680, y + 22), f"{round(float(wr))}%" if wr is not None else "—", font=mono, fill=_wr_color(wr))
        bar_w = 110
        dr.rounded_rectangle((680, y + 56, 680 + bar_w, y + 61), radius=3, fill=(40, 40, 48))
        if wr is not None:
            dr.rounded_rectangle((680, y + 56, 680 + bar_w * min(100, float(wr)) / 100, y + 61), radius=3, fill=_wr_color(wr))
        kd = m.get("avg_kd")
        dr.text((850, y + 22), f"{float(kd):.2f}" if kd is not None else "—", font=mono,
                fill=WIN if kd is not None and float(kd) >= 1 else LOSS if kd is not None else DIM)
        adr = m.get("adr")
        dr.text((960, y + 22), f"{round(float(adr))}" if adr is not None else "—", font=mono, fill=TEXT)
        hs = m.get("avg_hs")
        dr.text((1070, y + 22), f"{round(float(hs))}%" if hs is not None else "—", font=mono, fill=TEXT)
        y += 86
    if not rows:
        dr.text((48, 160), "No map data yet.", font=bold, fill=DIM)
    f = _font("DejaVuSans-Bold.ttf", 18)
    dr.text((W - 48 - dr.textlength("faceit-lens.com", font=f), H - 34), "faceit-lens.com", font=f, fill=DIM)
    out = io.BytesIO()
    img.save(out, "PNG", optimize=True)
    return out.getvalue()


def render_match(detail, highlight=None):
    teams = detail.get("teams") or []
    W, H = 1200, 160 + 2 * (56 + 5 * 50) + 60
    img, dr = _base(W, H)
    banner = _map_img(detail.get("map"), W, 120).filter(ImageFilter.GaussianBlur(1.5))
    dark = Image.new("RGB", banner.size, (0, 0, 0))
    img.paste(Image.blend(banner, dark, 0.55), (0, 6))
    mapname = (detail.get("map") or "?").replace("de_", "").title()
    dr.text((48, 30), mapname, font=_font("DejaVuSans-Bold.ttf", 44), fill=TEXT)
    sub = " · ".join(x for x in [detail.get("competition"), "Bo%s" % detail["best_of"] if (detail.get("best_of") or 1) > 1 else None] if x)
    if sub:
        dr.text((50, 86), sub, font=_font("DejaVuSans.ttf", 18), fill=(200, 200, 210))
    if len(teams) == 2:
        a, b = teams
        sf = _font("DejaVuSansMono-Bold.ttf", 60)
        s = f"{a.get('score', '?')} : {b.get('score', '?')}"
        dr.text((W - 48 - dr.textlength(s, font=sf), 28), s, font=sf, fill=TEXT)
    cols = [("K", 560), ("D", 630), ("A", 700), ("K/D", 770), ("ADR", 860), ("HS%", 950), ("RATING", 1040)]
    from concurrent.futures import ThreadPoolExecutor
    urls = [p.get("avatar") for t in teams for p in (t.get("players") or [])]
    with ThreadPoolExecutor(max_workers=10) as pool:
        avatars = dict(zip(urls, pool.map(lambda u: _avatar(u, 32), urls)))
    y = 140
    hl = (highlight or "").lower()
    for t in teams:
        won = t.get("win")
        col = WIN if won else LOSS
        dr.text((48, y), (t.get("name") or "Team").upper()[:28], font=_font("DejaVuSans-Bold.ttf", 20), fill=col)
        dr.text((48 + 420, y + 2), "WIN" if won else "LOSS", font=_font("DejaVuSans-Bold.ttf", 16), fill=col)
        for name, x in cols:
            dr.text((x, y + 4), name, font=_font("DejaVuSans-Bold.ttf", 13), fill=DIM)
        y += 36
        players = sorted(t.get("players") or [], key=lambda p: -(faceit._to_int(p.get("kills")) or 0))
        for i, p in enumerate(players[:5]):
            me = (p.get("nickname") or "").lower() == hl
            fill = (40, 26, 18) if me else PANEL
            dr.rounded_rectangle((48, y, W - 48, y + 44), radius=10, fill=fill,
                                 outline=ACCENT if me else None, width=2 if me else 0)
            av, mask = avatars.get(p.get("avatar")) or _avatar(None, 32)
            img.paste(av, (58, y + 6), mask)
            nm = (p.get("nickname") or "?")[:20]
            dr.text((102, y + 10), nm, font=_font("DejaVuSans-Bold.ttf", 20), fill=TEXT)
            if i == 0:
                dr.text((102 + dr.textlength(nm, font=_font("DejaVuSans-Bold.ttf", 20)) + 10, y + 13), "MVP",
                        font=_font("DejaVuSans-Bold.ttf", 13), fill=ACCENT)
            mono = _font("DejaVuSansMono-Bold.ttf", 20)
            vals = [p.get("kills"), p.get("deaths"), p.get("assists"), p.get("kd"), p.get("adr"), p.get("hs"), p.get("rating")]
            for (name, x), v in zip(cols, vals):
                txt = "—" if v in (None, "") else (f"{float(v):.2f}" if name in ("K/D", "RATING") else str(round(float(v))))
                c = TEXT
                if name in ("K/D", "RATING") and v not in (None, ""):
                    c = WIN if float(v) >= 1 else LOSS
                dr.text((x, y + 10), txt, font=mono, fill=c)
            y += 50
        y += 20
    f = _font("DejaVuSans-Bold.ttf", 18)
    dr.text((W - 48 - dr.textlength("faceit-lens.com", font=f), H - 36), "faceit-lens.com", font=f, fill=DIM)
    out = io.BytesIO()
    img.save(out, "PNG", optimize=True)
    return out.getvalue()


def _png(data):
    resp = HttpResponse(data, content_type="image/png")
    resp["Cache-Control"] = "public, max-age=3600, s-maxage=21600"
    resp["Access-Control-Allow-Origin"] = "*"
    return resp


@require_GET
def og_maps(request, nickname):
    from . import privacy
    nickname = (nickname or "").removesuffix(".png").strip()[:40]
    key = f"ogmaps:{nickname.lower()}"
    png = cache.get(key)
    if png is None:
        try:
            privacy.check(nickname=nickname)
            s = faceit.build_player_summary(nickname)
            png = render_maps(s.get("nickname") or nickname, s.get("avatar"), s.get("skill_level"), s.get("map_stats") or [])
        except Exception:
            return HttpResponseRedirect(FALLBACK)
        cache.set(key, png, TTL)
    return _png(png)


@require_GET
def og_match(request, match_id):
    match_id = (match_id or "").removesuffix(".png").strip()[:80]
    hl = (request.GET.get("player") or "")[:40]
    key = f"ogmatch:{match_id}:{hl.lower()}"
    png = cache.get(key)
    if png is None:
        try:
            detail = faceit.get_match_detail(match_id)
            from . import privacy
            privacy.scrub(detail)
            png = render_match(detail, hl)
        except Exception:
            return HttpResponseRedirect(FALLBACK)
        cache.set(key, png, 24 * 60 * 60)
    return _png(png)
