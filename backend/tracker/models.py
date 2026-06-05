from django.db import models


class TrackedPlayer(models.Model):
    """A player we've seen searched - used for the snapshot cron and recents."""
    player_id = models.CharField(max_length=64, unique=True)
    nickname = models.CharField(max_length=100)
    added_at = models.DateTimeField(auto_now_add=True)
    last_searched = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.nickname


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
