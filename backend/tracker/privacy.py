"""Player suppression (GDPR erasure / objection).

A suppressed player is never shown: their own profile answers 404, they are
left out of search and sitemaps, and anywhere they appear inside someone
else's data (teammates, scoreboards, lobbies, leaderboards) their identity is
replaced with a neutral placeholder by SuppressionMiddleware.
"""
import json

from django.core.cache import cache

CACHE_KEY = "privacy:suppressed:v1"
PLACEHOLDER = "Private player"
UNAVAILABLE = "This profile isn't available."

ID_KEYS = ("player_id", "user_id", "faceit_player_id", "faceit_id")
STEAM_KEYS = ("steamid", "steam_id", "steamid64", "game_player_id")
NAME_KEYS = ("nickname", "name", "persona", "game_player_name", "faceit_nickname", "display_name")
DROP_KEYS = ("avatar", "faceit_url", "profile_url", "country", "cover", "handle")


from .faceit import FaceitError


class Suppressed(FaceitError):
    pass


def load(force=False):
    if not force:
        hit = cache.get(CACHE_KEY)
        if hit is not None:
            return hit
    from .models import PlayerSuppression
    ids, steam, names = set(), set(), set()
    try:
        for s in PlayerSuppression.objects.all():
            if s.player_id:
                ids.add(s.player_id)
            if s.steamid:
                steam.add(s.steamid)
            names.update(s.nickname_list())
    except Exception:
        return {"ids": set(), "steam": set(), "names": set()}
    data = {"ids": ids, "steam": steam, "names": names}
    cache.set(CACHE_KEY, data, 30)
    return data


def refresh():
    cache.delete(CACHE_KEY)
    return load(force=True)


def active():
    d = load()
    return bool(d["ids"] or d["steam"] or d["names"])


def is_suppressed(player_id=None, steamid=None, nickname=None):
    d = load()
    if player_id and player_id in d["ids"]:
        return True
    if steamid and str(steamid) in d["steam"]:
        return True
    if nickname and nickname.strip().lower() in d["names"]:
        return True
    return False


def check(player_id=None, steamid=None, nickname=None):
    if is_suppressed(player_id, steamid, nickname):
        raise Suppressed(UNAVAILABLE)


def _hit(node, d):
    for k in ID_KEYS:
        v = node.get(k)
        if isinstance(v, str) and v in d["ids"]:
            return True
    for k in STEAM_KEYS:
        v = node.get(k)
        if v is not None and str(v) in d["steam"]:
            return True
    v = node.get("id")
    if isinstance(v, str) and v in d["ids"]:
        return True
    return False


def scrub(obj, d=None):
    d = d or load()
    if isinstance(obj, dict):
        if _hit(obj, d):
            for k in NAME_KEYS:
                if k in obj:
                    obj[k] = PLACEHOLDER
            for k in DROP_KEYS:
                if k in obj:
                    obj[k] = None
            for k in ID_KEYS + STEAM_KEYS:
                if k in obj:
                    obj[k] = None
        for k, v in list(obj.items()):
            if isinstance(v, str):
                if v.strip().lower() in d["names"]:
                    obj[k] = PLACEHOLDER
            else:
                scrub(v, d)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            if isinstance(v, str):
                if v.strip().lower() in d["names"]:
                    obj[i] = PLACEHOLDER
            else:
                scrub(v, d)
    return obj


class SuppressionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if not request.path.startswith("/api/"):
            return response
        if "application/json" not in (response.get("Content-Type") or ""):
            return response
        if getattr(response, "streaming", False):
            return response
        try:
            if not active():
                return response
            data = json.loads(response.content or b"null")
        except Exception:
            return response
        scrub(data)
        response.content = json.dumps(data).encode()
        if response.has_header("Content-Length"):
            response["Content-Length"] = str(len(response.content))
        return response


def purge(player_id=None, steamid=None, nicknames=()):
    """Delete everything stored about the player. Returns counts per table."""
    from . import models as m
    names = {n.lower() for n in nicknames if n}
    out = {}

    def rm(label, qs):
        n, _ = qs.delete()
        out[label] = n

    if player_id:
        names.update(n.lower() for n in m.NicknameHistory.objects.filter(player_id=player_id).values_list("nickname", flat=True))
        names.update(n.lower() for n in m.TrackedPlayer.objects.filter(player_id=player_id).values_list("nickname", flat=True))
        rm("TrackedPlayer", m.TrackedPlayer.objects.filter(player_id=player_id))
        rm("NicknameHistory", m.NicknameHistory.objects.filter(player_id=player_id))
        rm("EloSnapshot", m.EloSnapshot.objects.filter(player_id=player_id))
        rm("BanRecord", m.BanRecord.objects.filter(player_id=player_id))
        rm("SeasonSnapshot", m.SeasonSnapshot.objects.filter(player_id=player_id))
        rm("LiveMatchState", m.LiveMatchState.objects.filter(player_id=player_id))
    if steamid:
        rm("DemoPlayerStat", m.DemoPlayerStat.objects.filter(steamid=str(steamid)))
        rm("AllstarClip", m.AllstarClip.objects.filter(steamid=str(steamid)))
    for n in names:
        rm(f"Favorite[{n}]", m.Favorite.objects.filter(nickname__iexact=n))
        rm(f"TrackedPlayer[{n}]", m.TrackedPlayer.objects.filter(nickname__iexact=n))

    linked = []
    q = m.UserProfile.objects.none()
    if player_id:
        q = q | m.UserProfile.objects.filter(faceit_player_id=player_id)
    if steamid:
        q = q | m.UserProfile.objects.filter(user__steam_profile__steamid=str(steamid))
    for p in q.distinct():
        linked.append(p.handle)
        if p.is_public:
            p.is_public = False
            p.save(update_fields=["is_public"])
    out["linked_accounts_hidden"] = linked

    keys = []
    for n in names:
        keys += [f"summary:{n}", f"og:{n}", f"teamsearch:{n}:10", f"pnick:{n}"]
    if player_id:
        keys += [f"rms:{player_id}", f"finv:{player_id}", f"live2:{player_id}", f"live:{player_id}", f"phubids:{player_id}"]
    keys += ["sitemap:players", "challengers"]
    cache.delete_many(keys)
    out["nicknames"] = sorted(names)
    return out
