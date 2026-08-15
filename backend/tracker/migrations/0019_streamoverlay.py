from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0018_changelog_worldmap"),
    ]

    operations = [
        migrations.CreateModel(
            name="StreamOverlay",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.CharField(db_index=True, max_length=32, unique=True)),
                ("show_elo", models.BooleanField(default=True)),
                (
                    "show_session",
                    models.BooleanField(
                        default=True,
                        help_text="Wins/losses and ELO change since the stream started.",
                    ),
                ),
                (
                    "show_match",
                    models.BooleanField(
                        default=True,
                        help_text="The map and score of the match in progress.",
                    ),
                ),
                (
                    "show_brand",
                    models.BooleanField(
                        default=True, help_text="The small faceit-lens.com credit."
                    ),
                ),
                ("session_started", models.DateTimeField(blank=True, null=True)),
                ("session_start_elo", models.IntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "last_seen",
                    models.DateTimeField(
                        blank=True, null=True,
                        help_text="Last time the overlay actually polled.",
                    ),
                ),
                (
                    "profile",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="overlay",
                        to="tracker.userprofile",
                    ),
                ),
            ],
        ),
    ]
