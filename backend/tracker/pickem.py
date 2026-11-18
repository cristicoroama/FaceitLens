"""Major Pick'em with private friend leagues.

  GET  /api/pickem/                      event, stages, teams, my picks, my leagues
  POST /api/pickem/picks/                {stage_id, picks: {"30": [ids], "03": [ids], "adv": [ids]}}
  POST /api/pickem/league/               {name} -> create
  POST /api/pickem/league/join/          {code}
  POST /api/pickem/league/leave/         {code}
  GET  /api/pickem/league/<code>/        standings
  GET  /api/pickem/global/               top 50
"""
import json
import secrets

from django.db import IntegrityError
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from .models import (
    PickemEntry, PickemEvent, PickemLeague, PickemLeagueMember, PickemStage, UserProfile,
)

SLOTS = ("30", "03", "adv")
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
MAX_LEAGUES = 10


def _event(slug=None):
    qs = PickemEvent.objects.filter(active=True)
    if slug:
        qs = qs.filter(slug=slug)
    return qs.order_by("-created_at").first()


def _body(request):
    try:
        return json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return {}


def _auth(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Sign in to play Pick'em."}, status=401)
    return None


def _name(user):
    p = UserProfile.objects.filter(user=user).first()
    if p and (p.display_name or p.handle):
        return p.display_name or p.handle
    sp = getattr(user, "steam_profile", None)
    return (sp.name if sp and sp.name else None) or user.username


def _avatar(user):
    p = UserProfile.objects.filter(user=user).first()
    if p and p.avatar_updated:
        return f"/api/avatar/{p.handle}/?v={int(p.avatar_updated.timestamp())}"
    sp = getattr(user, "steam_profile", None)
    return (sp.avatar if sp else None) or None


def _handle(user):
    p = UserProfile.objects.filter(user=user).first()
    return p.handle if p and p.is_public else None


def score_picks(picks, results):
    pts = 0
    hits = {}
    for slot in SLOTS:
        for tid in picks.get(slot) or []:
            r = results.get(tid, "")
            ok = None
            if slot == "30" and r:
                ok = r == "30"
            elif slot == "03" and r:
                ok = r == "03"
            elif slot == "adv" and r:
                ok = r in ("30", "adv")
            if ok:
                pts += 1
            hits[str(tid)] = ok
    return pts, hits


def _results(stage):
    return {t.id: t.result for t in stage.teams.all()}


def _stage_payload(stage, user):
    teams = list(stage.teams.all())
    results = {t.id: t.result for t in teams}
    out = {
        "id": stage.id,
        "order": stage.order,
        "name": stage.name,
        "lock_at": stage.lock_at.isoformat(),
        "locked": stage.locked,
        "need": {"30": stage.picks_30, "03": stage.picks_03, "adv": stage.picks_adv},
        "teams": [
            {"id": t.id, "name": t.name, "logo": t.logo or None, "seed": t.seed,
             "wins": t.wins, "losses": t.losses, "result": t.result}
            for t in teams
        ],
        "decided": sum(1 for r in results.values() if r),
        "picks": None,
        "score": None,
        "hits": {},
    }
    if user and user.is_authenticated:
        e = PickemEntry.objects.filter(user=user, stage=stage).first()
        if e:
            out["picks"] = e.picks
            out["score"], out["hits"] = score_picks(e.picks, results)
    return out


def _leagues_of(user, event):
    if not (user and user.is_authenticated):
        return []
    rows = PickemLeague.objects.filter(event=event, members__user=user).distinct()
    return [{"name": l.name, "code": l.code, "owner": l.owner_id == user.id,
             "members": l.members.count()} for l in rows]


@require_GET
def pickem(request):
    ev = _event(request.GET.get("event"))
    if not ev:
        return JsonResponse({"event": None, "stages": []})
    stages = list(ev.stages.prefetch_related("teams"))
    return JsonResponse({
        "event": {"slug": ev.slug, "name": ev.name},
        "signed_in": request.user.is_authenticated,
        "stages": [_stage_payload(s, request.user) for s in stages],
        "leagues": _leagues_of(request.user, ev),
    })


@csrf_exempt
def save_picks(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only."}, status=405)
    denied = _auth(request)
    if denied:
        return denied
    b = _body(request)
    stage = PickemStage.objects.filter(id=b.get("stage_id")).first()
    if not stage:
        return JsonResponse({"error": "Unknown stage."}, status=404)
    if stage.locked:
        return JsonResponse({"error": "This stage is locked. Picks closed when it started."}, status=403)
    valid = set(stage.teams.values_list("id", flat=True))
    raw = b.get("picks") or {}
    need = {"30": stage.picks_30, "03": stage.picks_03, "adv": stage.picks_adv}
    picks, seen = {}, set()
    for slot in SLOTS:
        ids = []
        for x in raw.get(slot) or []:
            try:
                x = int(x)
            except (TypeError, ValueError):
                continue
            if x in valid and x not in seen:
                ids.append(x)
                seen.add(x)
        if len(ids) > need[slot]:
            return JsonResponse({"error": f"Too many picks for {slot}."}, status=400)
        picks[slot] = ids
    PickemEntry.objects.update_or_create(user=request.user, stage=stage, defaults={"picks": picks})
    return JsonResponse(_stage_payload(stage, request.user))


def _new_code():
    for _ in range(20):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
        if not PickemLeague.objects.filter(code=code).exists():
            return code
    raise RuntimeError("no code")


@csrf_exempt
def create_league(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only."}, status=405)
    denied = _auth(request)
    if denied:
        return denied
    ev = _event(_body(request).get("event"))
    if not ev:
        return JsonResponse({"error": "No active event."}, status=404)
    name = (_body(request).get("name") or "").strip()[:40] or f"{_name(request.user)}'s league"
    if PickemLeague.objects.filter(event=ev, owner=request.user).count() >= MAX_LEAGUES:
        return JsonResponse({"error": "You already own the maximum number of leagues."}, status=400)
    lg = PickemLeague.objects.create(event=ev, name=name, code=_new_code(), owner=request.user)
    PickemLeagueMember.objects.create(league=lg, user=request.user)
    return JsonResponse({"code": lg.code, "name": lg.name, "leagues": _leagues_of(request.user, ev)})


@csrf_exempt
def join_league(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only."}, status=405)
    denied = _auth(request)
    if denied:
        return denied
    code = (_body(request).get("code") or "").strip().upper()
    lg = PickemLeague.objects.filter(code=code).first()
    if not lg:
        return JsonResponse({"error": "No league with that code."}, status=404)
    if lg.members.count() >= 200:
        return JsonResponse({"error": "That league is full."}, status=400)
    try:
        PickemLeagueMember.objects.get_or_create(league=lg, user=request.user)
    except IntegrityError:
        pass
    return JsonResponse({"code": lg.code, "name": lg.name, "leagues": _leagues_of(request.user, lg.event)})


@csrf_exempt
def leave_league(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only."}, status=405)
    denied = _auth(request)
    if denied:
        return denied
    code = (_body(request).get("code") or "").strip().upper()
    lg = PickemLeague.objects.filter(code=code).first()
    if not lg:
        return JsonResponse({"error": "No league with that code."}, status=404)
    if lg.owner_id == request.user.id:
        lg.delete()
    else:
        PickemLeagueMember.objects.filter(league=lg, user=request.user).delete()
    return JsonResponse({"leagues": _leagues_of(request.user, lg.event)})


def _standings(event, users):
    stages = list(event.stages.prefetch_related("teams"))
    results = {s.id: _results(s) for s in stages}
    entries = {}
    for e in PickemEntry.objects.filter(stage__event=event, user__in=users):
        entries.setdefault(e.user_id, {})[e.stage_id] = e.picks
    rows = []
    for u in users:
        per = []
        total = 0
        for s in stages:
            picks = entries.get(u.id, {}).get(s.id)
            if picks is None:
                per.append(None)
                continue
            pts, _ = score_picks(picks, results[s.id])
            per.append(pts)
            total += pts
        rows.append({"name": _name(u), "avatar": _avatar(u), "handle": _handle(u),
                     "total": total, "stages": per, "user_id": u.id})
    rows.sort(key=lambda r: (-r["total"], r["name"].lower()))
    pos = 0
    last = None
    for i, r in enumerate(rows, 1):
        if r["total"] != last:
            pos = i
            last = r["total"]
        r["position"] = pos
    return [s.name for s in stages], rows


@require_GET
def league_detail(request, code):
    lg = PickemLeague.objects.filter(code=code.upper()).select_related("event").first()
    if not lg:
        return JsonResponse({"error": "No league with that code."}, status=404)
    users = [m.user for m in lg.members.select_related("user")]
    stage_names, rows = _standings(lg.event, users)
    me = request.user.id if request.user.is_authenticated else None
    for r in rows:
        r["me"] = r.pop("user_id") == me
    return JsonResponse({
        "name": lg.name, "code": lg.code, "event": lg.event.name,
        "member": any(r["me"] for r in rows),
        "stages": stage_names, "rows": rows,
    })


@require_GET
def global_board(request):
    ev = _event(request.GET.get("event"))
    if not ev:
        return JsonResponse({"stages": [], "rows": []})
    from django.contrib.auth import get_user_model
    ids = PickemEntry.objects.filter(stage__event=ev).values_list("user_id", flat=True).distinct()
    users = list(get_user_model().objects.filter(id__in=list(ids)[:2000]))
    stage_names, rows = _standings(ev, users)
    me = request.user.id if request.user.is_authenticated else None
    mine = None
    for r in rows:
        r["me"] = r.pop("user_id") == me
        if r["me"]:
            mine = r
    return JsonResponse({"stages": stage_names, "rows": rows[:50], "me": mine, "players": len(rows)})
