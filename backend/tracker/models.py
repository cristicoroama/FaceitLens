from django.conf import settings
from django.db import models
from django.utils import timezone


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


class FeedbackItem(models.Model):
    """A bug report or idea posted by a signed-in user.

    Deliberately public and votable: most people who hit a bug will never open
    a GitHub issue, and a vote count tells you what to build next far better
    than guessing does. Posting requires a Steam sign-in, which is enough
    friction to keep drive-by spam out without asking anyone to register.
    """

    KIND_CHOICES = [
        ("bug", "Bug"),
        ("idea", "Idea"),
        ("question", "Question"),
    ]

    # A public roadmap, effectively — people come back to see if their thing moved.
    STATUS_CHOICES = [
        ("open", "Open"),
        ("planned", "Planned"),
        ("in_progress", "In progress"),
        ("done", "Done"),
        ("declined", "Declined"),
        ("duplicate", "Duplicate"),
    ]

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="feedback_items", null=True, blank=True,
    )
    title = models.CharField(max_length=120)
    body = models.TextField(max_length=4000, blank=True)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default="idea")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open")

    pinned = models.BooleanField(
        default=False, help_text="Keep at the top of the list, above vote order."
    )
    hidden = models.BooleanField(
        default=False, help_text="Hide from the public list without deleting it."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-pinned", "-created_at"]

    def __str__(self):
        return f"[{self.get_kind_display()}] {self.title}"

    @property
    def vote_count(self):
        return self.votes.count()

    @property
    def is_closed(self):
        return self.status in ("done", "declined", "duplicate")


class FeedbackVote(models.Model):
    """One upvote. The unique constraint is what makes it one-per-person."""

    item = models.ForeignKey(
        FeedbackItem, on_delete=models.CASCADE, related_name="votes"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="feedback_votes"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("item", "user")

    def __str__(self):
        return f"{self.user_id} ▲ {self.item_id}"


class FeedbackComment(models.Model):
    """A reply on a feedback item.

    `staff_reply` is set automatically for site staff so their answers can be
    highlighted — when someone reports a bug, seeing an official response is
    the whole reason they come back.
    """

    item = models.ForeignKey(
        FeedbackItem, on_delete=models.CASCADE, related_name="comments"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="feedback_comments", null=True, blank=True,
    )
    body = models.TextField(max_length=2000)
    staff_reply = models.BooleanField(default=False)
    hidden = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.item_id}: {self.body[:40]}"


class ChangelogEntry(models.Model):
    """A "What's New" post, written from the Django admin.

    Kept deliberately separate from Incident: incidents are "something is
    broken right now", these are "here's what got built". Both feed different
    pages and neither should drown out the other.
    """

    KIND_CHOICES = [
        ("feature", "New feature"),
        ("improvement", "Improvement"),
        ("fix", "Fix"),
        ("note", "Note"),
    ]

    title = models.CharField(max_length=120)
    body = models.TextField(
        blank=True,
        help_text="One idea per line — the page renders each line as a bullet.",
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default="feature")
    published_at = models.DateTimeField(default=timezone.now)
    published = models.BooleanField(
        default=True, help_text="Untick to draft this without showing it on the site."
    )
    highlight = models.BooleanField(
        default=False,
        help_text="Pin to the top of the popup — use for the one thing you most want people to see.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-published_at", "-id"]
        verbose_name_plural = "Changelog entries"

    def __str__(self):
        return f"[{self.get_kind_display()}] {self.title}"

    @property
    def lines(self):
        """Body split into bullet lines, blanks dropped."""
        return [ln.strip(" -•\t") for ln in self.body.splitlines() if ln.strip()]


class UserProfile(models.Model):
    """The public-facing account: a stable handle, editable display info, an
    uploaded avatar, and the FACEIT account this user owns.

    The FACEIT link is established automatically at Steam sign-in: Steam hands
    us a cryptographically verified SteamID64, and FACEIT tells us which account
    that SteamID belongs to. Nobody can claim a profile that isn't theirs, so
    `faceit_verified` is real proof of ownership — not an honour system.

    Avatars live in the database as WebP bytes (~12KB each after resizing to
    256px). Render's filesystem is wiped on every deploy, so writing them to
    disk would silently lose every picture; Postgres persists.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )

    # Stable public identity. Chosen once, used in the URL (/u/<handle>), and
    # deliberately NOT tied to the FACEIT nickname — people rename themselves on
    # FACEIT and we don't want their shared links to rot.
    handle = models.SlugField(max_length=30, unique=True, db_index=True)
    display_name = models.CharField(max_length=40, blank=True)
    bio = models.CharField(max_length=200, blank=True)

    avatar = models.BinaryField(null=True, blank=True, editable=True)
    avatar_updated = models.DateTimeField(null=True, blank=True)

    # The FACEIT account this user owns.
    faceit_nickname = models.CharField(max_length=100, blank=True, db_index=True)
    faceit_player_id = models.CharField(max_length=64, blank=True, db_index=True)
    faceit_verified = models.BooleanField(
        default=False,
        help_text="True when the link was proven through Steam rather than typed in by hand.",
    )

    is_public = models.BooleanField(
        default=True, help_text="Untick to hide this profile from /u/<handle>."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"@{self.handle}"

    @property
    def name(self):
        """Best display name available, in order of how much the user chose it."""
        if self.display_name:
            return self.display_name
        if self.faceit_nickname:
            return self.faceit_nickname
        steam = getattr(self.user, "steam_profile", None)
        if steam and steam.name:
            return steam.name
        return self.handle

    @property
    def has_avatar(self):
        return bool(self.avatar)


class ProfileReport(models.Model):
    """A user-submitted report about a public profile (bad name, bad picture).

    Public profiles with free-text names and uploaded images eventually attract
    something you don't want on your site. This gives people a way to flag it
    and gives you a queue in the admin to act on.
    """

    REASON_CHOICES = [
        ("avatar", "Inappropriate picture"),
        ("name", "Inappropriate name or bio"),
        ("impersonation", "Impersonating someone"),
        ("other", "Other"),
    ]

    profile = models.ForeignKey(
        UserProfile, on_delete=models.CASCADE, related_name="reports"
    )
    reason = models.CharField(max_length=20, choices=REASON_CHOICES, default="other")
    detail = models.CharField(max_length=300, blank=True)
    reporter_ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    handled = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.profile} — {self.get_reason_display()}"


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


# Shared choices for incidents and their updates.
INCIDENT_STATUS_CHOICES = [
    ("investigating", "Investigating"),
    ("identified", "Identified"),
    ("monitoring", "Monitoring"),
    ("resolved", "Resolved"),
]

INCIDENT_IMPACT_CHOICES = [
    ("minor", "Minor"),
    ("major", "Major"),
    ("critical", "Critical"),
    ("maintenance", "Maintenance"),
]


class Incident(models.Model):
    """A status-page incident, editable from the Django admin. The public status
    feed (/api/incidents/) is built from these plus their timestamped updates."""

    title = models.CharField(max_length=200)
    component = models.CharField(max_length=100, help_text="e.g. FACEIT Data API")
    endpoint = models.CharField(
        max_length=120, blank=True, help_text="Optional, e.g. open.faceit.com"
    )
    impact = models.CharField(
        max_length=20, choices=INCIDENT_IMPACT_CHOICES, default="minor"
    )
    status = models.CharField(
        max_length=20, choices=INCIDENT_STATUS_CHOICES, default="investigating"
    )
    started = models.DateTimeField(default=timezone.now)
    resolved = models.DateTimeField(
        null=True, blank=True, help_text="Set when the incident is over."
    )
    published = models.BooleanField(
        default=True, help_text="Untick to hide this incident from the public status page."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-started"]

    def __str__(self):
        return f"[{self.get_status_display()}] {self.title}"

    @property
    def is_active(self):
        return self.status != "resolved"


class IncidentUpdate(models.Model):
    """One timestamped update inside an incident's timeline (newest first)."""

    incident = models.ForeignKey(
        Incident, on_delete=models.CASCADE, related_name="updates"
    )
    status = models.CharField(
        max_length=20, choices=INCIDENT_STATUS_CHOICES, default="investigating"
    )
    at = models.DateTimeField(default=timezone.now)
    text = models.TextField()

    class Meta:
        ordering = ["-at"]

    def __str__(self):
        return f"{self.incident_id} · {self.get_status_display()} @ {self.at:%Y-%m-%d %H:%M}"


class AllstarClip(models.Model):
    """An Allstar.gg highlight clip we requested and/or were notified about via
    webhook. Rows are pre-created on request (status 'Requested', with the
    faceit match + steamid we know) and then filled in as Allstar sends
    Submitted / Processed / OnDemand / Error webhook events."""

    clip_id = models.CharField(max_length=64, blank=True, default="", db_index=True)  # Allstar _id
    request_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    steamid = models.CharField(max_length=32, blank=True, default="", db_index=True)
    match_id = models.CharField(max_length=64, blank=True, default="", db_index=True)  # our FACEIT match id

    status = models.CharField(max_length=20, blank=True, default="")  # Requested/Submitted/Processed/OnDemand/Error
    on_demand = models.BooleanField(default=False)

    title = models.CharField(max_length=200, blank=True, default="")
    clip_url = models.URLField(max_length=500, blank=True, default="")
    thumb = models.URLField(max_length=500, blank=True, default="")
    snapshot = models.URLField(max_length=500, blank=True, default="")
    demo_url = models.URLField(max_length=1000, blank=True, default="")

    round_number = models.IntegerField(null=True, blank=True)
    length = models.FloatField(null=True, blank=True)
    cs_map = models.CharField(max_length=40, blank=True, default="")
    kills = models.CharField(max_length=8, blank=True, default="")
    weapons = models.CharField(max_length=100, blank=True, default="")
    headshots = models.CharField(max_length=8, blank=True, default="")

    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["steamid", "status"])]

    def __str__(self):
        return f"{self.steamid} · {self.status} · {self.title or self.match_id}"
