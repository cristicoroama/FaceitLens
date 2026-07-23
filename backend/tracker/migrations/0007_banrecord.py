from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0006_steamprofile_favorite"),
    ]

    operations = [
        migrations.CreateModel(
            name="BanRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("player_id", models.CharField(db_index=True, max_length=64)),
                ("nickname", models.CharField(max_length=100)),
                ("avatar", models.URLField(blank=True)),
                ("ban_type", models.CharField(blank=True, max_length=64)),
                ("reason", models.CharField(blank=True, max_length=200)),
                ("detected_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["-detected_at"],
                "unique_together": {("player_id", "ban_type")},
            },
        ),
    ]
