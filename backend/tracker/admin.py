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
