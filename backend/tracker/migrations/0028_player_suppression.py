from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0027_pickem_live_season"),
    ]

    operations = [
        migrations.CreateModel(
            name="PlayerSuppression",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("player_id", models.CharField(blank=True, db_index=True, max_length=64)),
                ("steamid", models.CharField(blank=True, db_index=True, max_length=32)),
                ("nicknames", models.TextField(blank=True, help_text="Lowercase nicknames, one per line")),
                ("note", models.CharField(blank=True, help_text="Internal reference only, no personal data", max_length=200)),
                ("verified", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
    ]
