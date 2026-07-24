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
