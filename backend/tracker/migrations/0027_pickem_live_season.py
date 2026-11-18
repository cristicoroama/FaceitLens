import datetime

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

STAGE1 = [
    "Ninjas in Pyjamas", "PARIVISION", "Heroic", "FaZe Clan", "Team Liquid", "Eternal Fire",
    "100 Thieves", "9z Team", "M80", "DENDELE", "Imperial Esports", "Wildcard Gaming",
    "GOSH", "FlyQuest", "Chinggis Warriors", "Lynn Vision Gaming",
]


def seed(apps, schema_editor):
    Event = apps.get_model("tracker", "PickemEvent")
    Stage = apps.get_model("tracker", "PickemStage")
    Team = apps.get_model("tracker", "PickemTeam")
    Changelog = apps.get_model("tracker", "ChangelogEntry")
    utc = datetime.timezone.utc
    ev, _ = Event.objects.get_or_create(slug="singapore-2026", defaults={"name": "PGL Major Singapore 2026"})
    s1, _ = Stage.objects.get_or_create(
        event=ev, order=1,
        defaults={"name": "Stage 1", "lock_at": datetime.datetime(2026, 11, 24, 8, 0, tzinfo=utc)},
    )
    Stage.objects.get_or_create(
        event=ev, order=2,
        defaults={"name": "Stage 2", "lock_at": datetime.datetime(2026, 11, 28, 8, 0, tzinfo=utc)},
    )
    Stage.objects.get_or_create(
        event=ev, order=3,
        defaults={"name": "Stage 3", "lock_at": datetime.datetime(2026, 12, 2, 8, 0, tzinfo=utc)},
    )
    if not Team.objects.filter(stage=s1).exists():
        for i, name in enumerate(STAGE1, 1):
            Team.objects.create(stage=s1, name=name, seed=i)
    Changelog.objects.get_or_create(
        title="Major Pick'em with friend leagues",
        defaults=dict(
            published=True,
            published_at=datetime.datetime(2026, 11, 18, 12, 0, tzinfo=utc),
            body=(
            "Predict every Swiss stage of PGL Major Singapore 2026: two 3-0 teams, two 0-3 teams and six "
            "that advance. Create a private league, share the code with your friends and race them on "
            "a live leaderboard. Hub pages now show live, upcoming and recent matches, championships "
            "have standings, and every profile has a Season 9 report and a Season 10 placement tracker."
            ),
            kind="feature",
            highlight=True,
        ),
    )


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0026_notifications"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PickemEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=60, unique=True)),
                ("name", models.CharField(max_length=120)),
                ("active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name="PickemStage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order", models.PositiveSmallIntegerField(default=1)),
                ("name", models.CharField(max_length=60)),
                ("lock_at", models.DateTimeField()),
                ("picks_30", models.PositiveSmallIntegerField(default=2)),
                ("picks_03", models.PositiveSmallIntegerField(default=2)),
                ("picks_adv", models.PositiveSmallIntegerField(default=6)),
                ("event", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="stages", to="tracker.pickemevent")),
            ],
            options={"ordering": ["event", "order"], "unique_together": {("event", "order")}},
        ),
        migrations.CreateModel(
            name="PickemTeam",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=60)),
                ("logo", models.URLField(blank=True)),
                ("seed", models.PositiveSmallIntegerField(default=0)),
                ("wins", models.PositiveSmallIntegerField(default=0)),
                ("losses", models.PositiveSmallIntegerField(default=0)),
                ("result", models.CharField(blank=True, choices=[("", "Pending"), ("30", "3-0"), ("adv", "Advanced 3-1 / 3-2"), ("elim", "Eliminated 1-3 / 2-3"), ("03", "0-3")], default="", max_length=4)),
                ("stage", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="teams", to="tracker.pickemstage")),
            ],
            options={"ordering": ["stage", "seed", "name"]},
        ),
        migrations.CreateModel(
            name="PickemEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("picks", models.JSONField(default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("stage", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="entries", to="tracker.pickemstage")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pickem_entries", to=settings.AUTH_USER_MODEL)),
            ],
            options={"unique_together": {("user", "stage")}},
        ),
        migrations.CreateModel(
            name="PickemLeague",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=40)),
                ("code", models.CharField(db_index=True, max_length=8, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("event", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="leagues", to="tracker.pickemevent")),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="owned_leagues", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="PickemLeagueMember",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("joined_at", models.DateTimeField(auto_now_add=True)),
                ("league", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="members", to="tracker.pickemleague")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pickem_leagues", to=settings.AUTH_USER_MODEL)),
            ],
            options={"unique_together": {("league", "user")}},
        ),
        migrations.CreateModel(
            name="LiveMatchState",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("player_id", models.CharField(db_index=True, max_length=64)),
                ("match_id", models.CharField(max_length=64)),
                ("state", models.CharField(max_length=12)),
                ("payload", models.JSONField(default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"unique_together": {("player_id", "match_id")}},
        ),
        migrations.CreateModel(
            name="SeasonSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("player_id", models.CharField(db_index=True, max_length=64)),
                ("nickname", models.CharField(max_length=100)),
                ("season", models.PositiveSmallIntegerField()),
                ("data", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"unique_together": {("player_id", "season")}},
        ),
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
