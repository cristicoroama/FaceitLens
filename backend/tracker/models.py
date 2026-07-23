from django.conf import settings
from django.db import models


class SteamProfile(models.Model):
    """Steam identity attached to a Django user (created on first Steam sign-in)."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="steam_profile"
    )
    steamid = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=100, blank=True)     # Steam persona name
    avatar = models.URLField(blank=True)                    # Steam avatar (full size)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name or self.steamid


class Favorite(models.Model):
    """A user's favorited FACEIT nickname (synced across devices when signed in)."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites"
    )
    nickname = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "nickname")

    def __str__(self):
        return f"{self.user_id} ★ {self.nickname}"


class TrackedPlayer(models.Model):
    """A player we've seen searched - used for the snapshot cron and recents."""
    player_id = models.CharField(max_length=64, unique=True)
    nickname = models.CharField(max_length=100)
    added_at = models.DateTimeField(auto_now_add=True)
    last_searched = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.nickname


class BanRecord(models.Model):
    """A ban we've observed on a searched/tracked player. The 'recent bans' feed
    is built from these — populated as banned players get looked up, and by the
    check_bans management command re-scanning tracked players."""
    player_id = models.CharField(max_length=64, db_index=True)
    nickname = models.CharField(max_length=100)
    avatar = models.URLField(blank=True)
    ban_type = models.CharField(max_length=64, blank=True)   # e.g. smurfing, cheating
    reason = models.CharField(max_length=200, blank=True)
    detected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("player_id", "ban_type")
        ordering = ["-detected_at"]

    def __str__(self):
        return f"{self.nickname} — {self.ban_type or 'ban'}"


class EloSnapshot(models.Model):
    """One ELO reading for a player on a given day (built by the cron job)."""
    player_id = models.CharField(max_length=64, db_index=True)
    elo = models.IntegerField()
    date = models.DateField()

    class Meta:
        unique_together = ("player_id", "date")
        ordering = ["date"]

    def __str__(self):
        return f"{self.player_id} @ {self.date}: {self.elo}"


class NicknameHistory(models.Model):
    """Nicknames we've seen for a player over time (built going forward)."""
    player_id = models.CharField(max_length=64, db_index=True)
    nickname = models.CharField(max_length=100)
    first_seen = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("player_id", "nickname")
        ordering = ["first_seen"]

    def __str__(self):
        return f"{self.player_id}: {self.nickname}"


class GameScore(models.Model):
    """Leaderboard scores for the on-site minigames."""
    game = models.CharField(max_length=20, db_index=True)  # "price" | "trivia"
    name = models.CharField(max_length=24)
    score = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-score", "created_at"]

    def __str__(self):
        return f"{self.game} · {self.name}: {self.score}"


class ParsedMatch(models.Model):
    """
    A FACEIT match whose demo we've already downloaded + parsed. Parsing is
    expensive, so we store the result and never parse the same match twice.
    """
    match_id = models.CharField(max_length=64, unique=True)
    map_name = models.CharField(max_length=40, blank=True)
    rounds = models.IntegerField(default=0)
    finished_at = models.DateTimeField(null=True, blank=True)
    parsed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.match_id} ({self.map_name}, {self.rounds}r)"


class DemoPlayerStat(models.Model):
    """
    Real per-player stats for one parsed match — the data the FACEIT API does
    not expose (HLTV Rating 2.0, KAST, opening duels, clutches, trades, utility).
    Keyed by SteamID64 so it joins to a FACEIT player's game_player_id.
    """
    match = models.ForeignKey(ParsedMatch, on_delete=models.CASCADE, related_name="players")
    steamid = models.CharField(max_length=32, db_index=True)
    name = models.CharField(max_length=64, blank=True)

    rounds = models.IntegerField(default=0)
    kills = models.IntegerField(default=0)
    deaths = models.IntegerField(default=0)
    assists = models.IntegerField(default=0)
    hs_kills = models.IntegerField(default=0)
    damage = models.FloatField(default=0.0)           # total (for correct ADR re-aggregation)
    kast_rounds = models.IntegerField(default=0)
    rating = models.FloatField(default=0.0)           # per-match HLTV 2.0
    opening_kills = models.IntegerField(default=0)
    opening_deaths = models.IntegerField(default=0)
    opening_wins = models.IntegerField(default=0)
    trade_kills = models.IntegerField(default=0)
    traded_deaths = models.IntegerField(default=0)
    flash_assists = models.IntegerField(default=0)
    enemies_flashed = models.IntegerField(default=0)
    blind_time = models.FloatField(default=0.0)
    clutch_attempts = models.IntegerField(default=0)
    clutch_won = models.IntegerField(default=0)

    class Meta:
        unique_together = ("match", "steamid")
        indexes = [models.Index(fields=["steamid"])]

    def __str__(self):
        return f"{self.name} @ {self.match_id}: {self.rating}"
