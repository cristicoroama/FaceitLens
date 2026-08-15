from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0020_changelog_overlay"),
    ]

    operations = [
        migrations.AddField(
            model_name="streamoverlay",
            name="look",
            field=models.CharField(
                blank=True,
                default="",
                help_text=(
                    "Saved appearance as a query string, e.g. ?a=4aa8ff&s=120. "
                    "The overlay reads its look from the URL, so this is only "
                    "the default the customiser reopens with."
                ),
                max_length=120,
            ),
        ),
    ]
