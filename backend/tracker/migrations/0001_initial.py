from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True
    dependencies = []

    operations = [
        migrations.CreateModel(
            name="TrackedPlayer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("player_id", models.CharField(max_length=64, unique=True)),
                ("nickname", models.CharField(max_length=100)),
                ("added_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name="EloSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("player_id", models.CharField(db_index=True, max_length=64)),
                ("elo", models.IntegerField()),
                ("date", models.DateField()),
            ],
            options={"ordering": ["date"], "unique_together": {("player_id", "date")}},
        ),
    ]
