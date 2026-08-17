from django.db import migrations, models

import tracker.models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0021_streamoverlay_look"),
    ]

    operations = [
        migrations.AlterField(
            model_name="streamoverlay",
            name="token",
            field=models.CharField(
                db_index=True,
                default=tracker.models.new_overlay_token,
                max_length=32,
                unique=True,
            ),
        ),
    ]
