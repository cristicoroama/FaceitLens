import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0010_userprofile_profilereport"),
    ]

    operations = [
        migrations.CreateModel(
            name="ChangelogEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=120)),
                (
                    "body",
                    models.TextField(
                        blank=True,
                        help_text="One idea per line — the page renders each line as a bullet.",
                    ),
                ),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("feature", "New feature"),
                            ("improvement", "Improvement"),
                            ("fix", "Fix"),
                            ("note", "Note"),
                        ],
                        default="feature",
                        max_length=20,
                    ),
                ),
                ("published_at", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "published",
                    models.BooleanField(
                        default=True,
                        help_text="Untick to draft this without showing it on the site.",
                    ),
                ),
                (
                    "highlight",
                    models.BooleanField(
                        default=False,
                        help_text="Pin to the top of the popup — use for the one thing you most want people to see.",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["-published_at", "-id"],
                "verbose_name_plural": "Changelog entries",
            },
        ),
    ]
