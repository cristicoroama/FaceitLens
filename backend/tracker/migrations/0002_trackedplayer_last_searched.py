from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("tracker", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="trackedplayer",
            name="last_searched",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
