from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("tracker", "0002_trackedplayer_last_searched")]

    operations = [
        migrations.CreateModel(
            name="NicknameHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("player_id", models.CharField(db_index=True, max_length=64)),
                ("nickname", models.CharField(max_length=100)),
                ("first_seen", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["first_seen"], "unique_together": {("player_id", "nickname")}},
        ),
    ]
