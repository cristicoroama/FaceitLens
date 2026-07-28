from django.contrib import admin

from .models import (
    TrackedPlayer,
    EloSnapshot,
    NicknameHistory,
    GameScore,
    ParsedMatch,
    DemoPlayerStat,
    SteamProfile,
    Favorite,
)


@admin.register(SteamProfile)
class SteamProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "steamid", "user", "created_at")
    search_fields = ("name", "steamid")
    ordering = ("-created_at",)


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("nickname", "user", "created_at")
    search_fields = ("nickname",)
    ordering = ("-created_at",)


from .models import BanRecord  # noqa: E402


@admin.register(BanRecord)
class BanRecordAdmin(admin.ModelAdmin):
    list_display = ("nickname", "ban_type", "player_id", "detected_at")
    search_fields = ("nickname", "player_id", "ban_type")
    list_filter = ("ban_type",)
    ordering = ("-detected_at",)


@admin.register(TrackedPlayer)
class TrackedPlayerAdmin(admin.ModelAdmin):
    list_display = ("nickname", "player_id", "added_at", "last_searched")
    search_fields = ("nickname", "player_id")
    ordering = ("-last_searched",)


@admin.register(EloSnapshot)
class EloSnapshotAdmin(admin.ModelAdmin):
    list_display = ("player_id", "elo", "date")
    search_fields = ("player_id",)
    list_filter = ("date",)
    ordering = ("-date",)


@admin.register(NicknameHistory)
class NicknameHistoryAdmin(admin.ModelAdmin):
    list_display = ("nickname", "player_id", "first_seen")
    search_fields = ("nickname", "player_id")
    ordering = ("-first_seen",)


@admin.register(GameScore)
class GameScoreAdmin(admin.ModelAdmin):
    list_display = ("name", "game", "score", "created_at")
    list_filter = ("game",)
    search_fields = ("name",)
    ordering = ("-score",)


class DemoPlayerStatInline(admin.TabularInline):
    model = DemoPlayerStat
    extra = 0
    can_delete = False


@admin.register(ParsedMatch)
class ParsedMatchAdmin(admin.ModelAdmin):
    list_display = ("match_id", "map_name", "rounds", "finished_at", "parsed_at")
    search_fields = ("match_id", "map_name")
    list_filter = ("map_name",)
    ordering = ("-parsed_at",)
    inlines = [DemoPlayerStatInline]


@admin.register(DemoPlayerStat)
class DemoPlayerStatAdmin(admin.ModelAdmin):
    list_display = ("name", "steamid", "match", "kills", "deaths", "rating")
    search_fields = ("name", "steamid")
    ordering = ("-rating",)


from .models import Incident, IncidentUpdate  # noqa: E402


class IncidentUpdateInline(admin.TabularInline):
    model = IncidentUpdate
    extra = 1
    fields = ("at", "status", "text")
    ordering = ("-at",)


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ("title", "component", "impact", "status", "started", "resolved", "published")
    list_filter = ("status", "impact", "published")
    list_editable = ("impact", "status", "published")
    search_fields = ("title", "component", "endpoint")
    ordering = ("-started",)
    date_hierarchy = "started"
    inlines = [IncidentUpdateInline]
    fields = (
        "title", "component", "endpoint",
        ("impact", "status"),
        ("started", "resolved"),
        "published",
    )


@admin.register(IncidentUpdate)
class IncidentUpdateAdmin(admin.ModelAdmin):
    list_display = ("incident", "status", "at")
    list_filter = ("status",)
    ordering = ("-at",)


# --- Feedback board --------------------------------------------------------

from django.utils.html import format_html as _fh  # noqa: E402

from .models import FeedbackComment, FeedbackItem, FeedbackVote  # noqa: E402


class FeedbackCommentInline(admin.TabularInline):
    model = FeedbackComment
    extra = 1
    fields = ("author", "body", "staff_reply", "hidden", "created_at")
    readonly_fields = ("created_at",)


@admin.register(FeedbackItem)
class FeedbackItemAdmin(admin.ModelAdmin):
    list_display = ("title", "kind", "status", "vote_total", "comment_total",
                    "author", "pinned", "hidden", "created_at")
    list_filter = ("status", "kind", "pinned", "hidden", "created_at")
    list_editable = ("status", "pinned", "hidden")
    search_fields = ("title", "body", "author__username")
    ordering = ("-pinned", "-created_at")
    date_hierarchy = "created_at"
    readonly_fields = ("author", "created_at", "updated_at")
    inlines = [FeedbackCommentInline]
    actions = ["mark_planned", "mark_in_progress", "mark_done", "mark_declined"]

    def get_queryset(self, request):
        from django.db.models import Count
        return super().get_queryset(request).annotate(
            _votes=Count("votes", distinct=True),
            _comments=Count("comments", distinct=True),
        )

    @admin.display(description="Votes", ordering="_votes")
    def vote_total(self, obj):
        return _fh("<b>{}</b>", obj._votes)

    @admin.display(description="Comments", ordering="_comments")
    def comment_total(self, obj):
        return obj._comments

    def _set(self, request, queryset, status, word):
        n = queryset.update(status=status)
        self.message_user(request, f"Marked {n} item(s) as {word}.")

    @admin.action(description="Mark as Planned")
    def mark_planned(self, request, qs): self._set(request, qs, "planned", "planned")

    @admin.action(description="Mark as In progress")
    def mark_in_progress(self, request, qs): self._set(request, qs, "in_progress", "in progress")

    @admin.action(description="Mark as Done")
    def mark_done(self, request, qs): self._set(request, qs, "done", "done")

    @admin.action(description="Mark as Declined")
    def mark_declined(self, request, qs): self._set(request, qs, "declined", "declined")


@admin.register(FeedbackComment)
class FeedbackCommentAdmin(admin.ModelAdmin):
    list_display = ("item", "author", "short_body", "staff_reply", "hidden", "created_at")
    list_filter = ("staff_reply", "hidden", "created_at")
    list_editable = ("hidden",)
    search_fields = ("body", "author__username", "item__title")
    ordering = ("-created_at",)

    @admin.display(description="Comment")
    def short_body(self, obj):
        return obj.body[:70] + ("…" if len(obj.body) > 70 else "")


@admin.register(FeedbackVote)
class FeedbackVoteAdmin(admin.ModelAdmin):
    list_display = ("item", "user", "created_at")
    ordering = ("-created_at",)
    search_fields = ("item__title", "user__username")


# --- Changelog ("What's New") ---------------------------------------------

from .models import ChangelogEntry  # noqa: E402


@admin.register(ChangelogEntry)
class ChangelogEntryAdmin(admin.ModelAdmin):
    list_display = ("title", "kind", "published_at", "published", "highlight")
    list_filter = ("kind", "published", "highlight")
    list_editable = ("published", "highlight")
    search_fields = ("title", "body")
    ordering = ("-published_at",)
    date_hierarchy = "published_at"
    fields = ("title", "kind", "body", ("published_at", "published"), "highlight")


# --- User profiles + moderation -------------------------------------------

from django.utils.html import format_html  # noqa: E402

from .models import ProfileReport, UserProfile  # noqa: E402


class ProfileReportInline(admin.TabularInline):
    model = ProfileReport
    extra = 0
    fields = ("reason", "detail", "reporter_ip", "created_at", "handled")
    readonly_fields = ("reason", "detail", "reporter_ip", "created_at")
    ordering = ("-created_at",)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "handle", "preview", "display_name", "faceit_nickname",
        "faceit_verified", "is_public", "open_reports", "created_at",
    )
    list_filter = ("faceit_verified", "is_public", "created_at")
    search_fields = ("handle", "display_name", "faceit_nickname", "faceit_player_id", "bio")
    ordering = ("-created_at",)
    readonly_fields = ("preview", "created_at", "updated_at", "user")
    exclude = ("avatar",)   # raw bytes aren't useful (or safe) to edit by hand
    inlines = [ProfileReportInline]
    actions = ["wipe_avatar", "reset_identity", "make_private"]

    @admin.display(description="Picture")
    def preview(self, obj):
        if not obj.has_avatar:
            return "—"
        return format_html(
            '<img src="/api/avatar/{}/" width="40" height="40" '
            'style="border-radius:8px;object-fit:cover" />',
            obj.handle,
        )

    @admin.display(description="Reports")
    def open_reports(self, obj):
        n = obj.reports.filter(handled=False).count()
        if not n:
            return "—"
        return format_html('<b style="color:#c0392b">{}</b>', n)

    @admin.action(description="Delete the profile picture")
    def wipe_avatar(self, request, queryset):
        n = queryset.update(avatar=None, avatar_updated=None)
        self.message_user(request, f"Removed {n} picture(s).")

    @admin.action(description="Clear the custom name and bio")
    def reset_identity(self, request, queryset):
        n = queryset.update(display_name="", bio="")
        self.message_user(request, f"Reset {n} profile(s).")

    @admin.action(description="Hide from the public directory")
    def make_private(self, request, queryset):
        n = queryset.update(is_public=False)
        self.message_user(request, f"Made {n} profile(s) private.")


@admin.register(ProfileReport)
class ProfileReportAdmin(admin.ModelAdmin):
    list_display = ("profile", "reason", "detail", "created_at", "handled")
    list_filter = ("handled", "reason", "created_at")
    list_editable = ("handled",)
    search_fields = ("profile__handle", "detail")
    ordering = ("handled", "-created_at")
    actions = ["mark_handled"]

    @admin.action(description="Mark as handled")
    def mark_handled(self, request, queryset):
        n = queryset.update(handled=True)
        self.message_user(request, f"Closed {n} report(s).")


from .models import AllstarClip  # noqa: E402


@admin.register(AllstarClip)
class AllstarClipAdmin(admin.ModelAdmin):
    list_display = ("steamid", "status", "title", "cs_map", "match_id", "created_at")
    list_filter = ("status", "on_demand")
    search_fields = ("steamid", "clip_id", "request_id", "match_id", "title")
    ordering = ("-created_at",)
