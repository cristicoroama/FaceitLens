from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("tracker", "0003_nicknamehistory")]

    operations = [
        migrations.CreateModel(
            name="GameScore",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("game", models.CharField(db_index=True, max_length=20)),
                ("name", models.CharField(max_length=24)),
                ("score", models.IntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-score", "created_at"]},
        ),
    ]
