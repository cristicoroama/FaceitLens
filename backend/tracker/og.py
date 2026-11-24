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
