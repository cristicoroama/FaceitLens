from datetime import datetime

from django.db import migrations


SEED_TITLE = "Intermittent connection timeouts on the FACEIT Data API"

UPDATES = [
    (
        "2026-07-24T06:31:00-05:00",
        "resolved",
        "Upstream connectivity to open.faceit.com has fully recovered. Player "
        "lookups, roast and AI analysis are operating normally, error rate is "
        "back to baseline and no further timeouts are being observed. Marking "
        "this incident as resolved. No FaceitLens data was affected.",
    ),
    (
        "2026-07-24T06:22:00-05:00",
        "monitoring",
        "The FACEIT Data API is responding again and requests are succeeding. "
        "Monitoring latency and error rates to confirm a stable recovery before "
        "closing the incident.",
    ),
    (
        "2026-07-24T06:10:00-05:00",
        "investigating",
        "Backend requests to the FACEIT Data API (open.faceit.com:443) are "
        "failing with ConnectTimeout (connect timeout = 10s). Affected routes: "
        "/api/player, /api/roast, /api/analyze — returning HTTP 500 while the "
        "upstream is unreachable. This is an upstream FACEIT connectivity issue, "
        "not a FaceitLens deploy or configuration change. Investigating.",
    ),
]


def create_seed(apps, schema_editor):
    """Insert one example incident so the status page isn't empty and you have a
    template to copy in the admin. Idempotent — safe to run on any database."""
    Incident = apps.get_model("tracker", "Incident")
    IncidentUpdate = apps.get_model("tracker", "IncidentUpdate")

    inc, created = Incident.objects.get_or_create(
        title=SEED_TITLE,
        defaults=dict(
            component="FACEIT Data API",
            endpoint="open.faceit.com",
            impact="minor",
            status="resolved",
            started=datetime.fromisoformat("2026-07-24T06:10:00-05:00"),
            resolved=datetime.fromisoformat("2026-07-24T06:31:00-05:00"),
            published=True,
        ),
    )
    if not created:
        return

    for at, status, text in UPDATES:
        IncidentUpdate.objects.create(
            incident=inc,
            at=datetime.fromisoformat(at),
            status=status,
            text=text,
        )


def remove_seed(apps, schema_editor):
    Incident = apps.get_model("tracker", "Incident")
    Incident.objects.filter(title=SEED_TITLE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0008_incident_incidentupdate"),
    ]

    operations = [
        migrations.RunPython(create_seed, remove_seed),
    ]
