from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0029_discord_link"),
    ]

    operations = [
        migrations.CreateModel(
            name="BotState",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.CharField(max_length=40, unique=True)),
                ("data", models.JSONField(default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
    ]
