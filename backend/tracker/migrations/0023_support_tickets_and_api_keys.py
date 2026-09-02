import django.db.models.deletion
from django.db import migrations, models

import tracker.models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0022_streamoverlay_token_default"),
    ]

    operations = [
        migrations.CreateModel(
            name="SupportTicket",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("ref", models.CharField(db_index=True, default=tracker.models._ticket_ref, max_length=16, unique=True)),
                ("email", models.EmailField(db_index=True, max_length=254)),
                ("category", models.CharField(choices=[("support", "Support"), ("bug", "Bug report"), ("api", "API access request"), ("data", "Data correction"), ("other", "Other")], default="support", max_length=16)),
                ("subject", models.CharField(max_length=160)),
                ("body", models.TextField()),
                ("status", models.CharField(choices=[("open", "Open"), ("waiting", "Waiting on user"), ("progress", "In progress"), ("resolved", "Resolved"), ("rejected", "Rejected")], db_index=True, default="open", max_length=16)),
                ("api_use_case", models.TextField(blank=True)),
                ("api_expected_rpm", models.PositiveIntegerField(blank=True, null=True)),
                ("api_project_url", models.URLField(blank=True)),
                ("ip_hash", models.CharField(blank=True, db_index=True, max_length=64)),
                ("user_agent", models.CharField(blank=True, max_length=300)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="TicketMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("body", models.TextField()),
                ("from_staff", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("ticket", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="messages", to="tracker.supportticket")),
            ],
            options={"ordering": ["created_at"]},
        ),
        migrations.CreateModel(
            name="ApiKey",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.CharField(db_index=True, default=tracker.models._api_key, max_length=64, unique=True)),
                ("label", models.CharField(max_length=120)),
                ("email", models.EmailField(db_index=True, max_length=254)),
                ("active", models.BooleanField(db_index=True, default=True)),
                ("rate_per_minute", models.PositiveIntegerField(default=60)),
                ("rate_per_day", models.PositiveIntegerField(default=10000)),
                ("note", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("last_used_at", models.DateTimeField(blank=True, null=True)),
                ("request_count", models.PositiveBigIntegerField(default=0)),
                ("ticket", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="api_keys", to="tracker.supportticket")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
