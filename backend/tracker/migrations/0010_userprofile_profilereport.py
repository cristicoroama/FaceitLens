from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracker", "0009_seed_faceit_incident"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("handle", models.SlugField(db_index=True, max_length=30, unique=True)),
                ("display_name", models.CharField(blank=True, max_length=40)),
                ("bio", models.CharField(blank=True, max_length=200)),
                ("avatar", models.BinaryField(blank=True, null=True)),
                ("avatar_updated", models.DateTimeField(blank=True, null=True)),
                ("faceit_nickname", models.CharField(blank=True, db_index=True, max_length=100)),
                ("faceit_player_id", models.CharField(blank=True, db_index=True, max_length=64)),
                (
                    "faceit_verified",
                    models.BooleanField(
                        default=False,
                        help_text="True when the link was proven through Steam rather than typed in by hand.",
                    ),
                ),
                (
                    "is_public",
                    models.BooleanField(
                        default=True, help_text="Untick to hide this profile from /u/<handle>."
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="ProfileReport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "reason",
                    models.CharField(
                        choices=[
                            ("avatar", "Inappropriate picture"),
                            ("name", "Inappropriate name or bio"),
                            ("impersonation", "Impersonating someone"),
                            ("other", "Other"),
                        ],
                        default="other",
                        max_length=20,
                    ),
                ),
                ("detail", models.CharField(blank=True, max_length=300)),
                ("reporter_ip", models.GenericIPAddressField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("handled", models.BooleanField(default=False)),
                (
                    "profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reports",
                        to="tracker.userprofile",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
