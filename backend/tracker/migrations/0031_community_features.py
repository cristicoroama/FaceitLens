import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0030_bot_state'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='BanCheckState',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('player_id', models.CharField(max_length=64, unique=True)),
                ('nickname', models.CharField(blank=True, max_length=100)),
                ('banned', models.BooleanField(default=False)),
                ('ban_type', models.CharField(blank=True, max_length=64)),
                ('ban_started', models.DateTimeField(blank=True, null=True)),
                ('checked_at', models.DateTimeField(db_index=True)),
            ],
        ),
        migrations.CreateModel(
            name='PlayerMeta',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('player_id', models.CharField(max_length=64, unique=True)),
                ('nickname', models.CharField(blank=True, max_length=100)),
                ('region', models.CharField(blank=True, db_index=True, max_length=16)),
                ('skill_level', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='EncounterBan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('owner_player_id', models.CharField(db_index=True, max_length=64)),
                ('player_id', models.CharField(max_length=64)),
                ('nickname', models.CharField(max_length=100)),
                ('avatar', models.URLField(blank=True)),
                ('relation', models.CharField(choices=[('opponent', 'Opponent'), ('teammate', 'Teammate')], default='opponent', max_length=10)),
                ('match_id', models.CharField(blank=True, max_length=64)),
                ('match_url', models.CharField(blank=True, max_length=300)),
                ('played_at', models.DateTimeField(blank=True, null=True)),
                ('ban_type', models.CharField(blank=True, max_length=64)),
                ('ban_started', models.DateTimeField(blank=True, null=True)),
                ('detected_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-detected_at'],
                'unique_together': {('owner_player_id', 'player_id', 'ban_type')},
            },
        ),
        migrations.CreateModel(
            name='PlayerGoal',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('metric', models.CharField(choices=[('elo', 'ELO'), ('kd', 'K/D'), ('hs', 'Headshot %'), ('adr', 'ADR'), ('winrate', 'Win rate')], max_length=12)),
                ('target', models.FloatField()),
                ('start_value', models.FloatField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('achieved_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='player_goals', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
    ]
