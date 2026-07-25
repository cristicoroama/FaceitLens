from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracker", "0013_clear_unverified_faceit_links"),
    ]

    operations = [
        migrations.CreateModel(
            name="FeedbackItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=120)),
                ("body", models.TextField(blank=True, max_length=4000)),
                (
                    "kind",
                    models.CharField(
                        choices=[("bug", "Bug"), ("idea", "Idea"), ("question", "Question")],
                        default="idea", max_length=20,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("open", "Open"),
                            ("planned", "Planned"),
                            ("in_progress", "In progress"),
                            ("done", "Done"),
                            ("declined", "Declined"),
                            ("duplicate", "Duplicate"),
                        ],
                        default="open", max_length=20,
                    ),
                ),
                (
                    "pinned",
                    models.BooleanField(
                        default=False,
                        help_text="Keep at the top of the list, above vote order.",
                    ),
                ),
                (
                    "hidden",
                    models.BooleanField(
                        default=False,
                        help_text="Hide from the public list without deleting it.",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "author",
                    models.ForeignKey(
                        blank=True, null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="feedback_items",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-pinned", "-created_at"]},
        ),
        migrations.CreateModel(
            name="FeedbackComment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("body", models.TextField(max_length=2000)),
                ("staff_reply", models.BooleanField(default=False)),
                ("hidden", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "author",
                    models.ForeignKey(
                        blank=True, null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="feedback_comments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="comments",
                        to="tracker.feedbackitem",
                    ),
                ),
            ],
            options={"ordering": ["created_at"]},
        ),
        migrations.CreateModel(
            name="FeedbackVote",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="votes",
                        to="tracker.feedbackitem",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="feedback_votes",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"unique_together": {("item", "user")}},
        ),
    ]
