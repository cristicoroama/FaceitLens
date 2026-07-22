from django.urls import path
from . import auth, views

urlpatterns = [
    # --- Sign in with Steam + account ---
    path("auth/steam/login/", auth.steam_login, name="auth-steam-login"),
    path("auth/steam/return/", auth.steam_return, name="auth-steam-return"),
    path("auth/me/", auth.me, name="auth-me"),
    path("auth/logout/", auth.logout_view, name="auth-logout"),
    path("auth/favorites/", auth.favorites, name="auth-favorites"),

    path("player/<str:nickname>/", views.player_summary, name="player-summary"),
    path("player/<str:nickname>/real/", views.real_stats, name="player-real-stats"),
    path("player/<str:nickname>/collectibles/", views.collectibles, name="player-collectibles"),
    path("player/<str:nickname>/leetify/", views.leetify_stats, name="player-leetify"),
    path("steam/", views.player_by_steam, name="player-by-steam"),
    path("steamprofile/", views.steam_profile, name="steam-profile"),
    path("match/<str:match_id>/", views.match_detail, name="match-detail"),
    path("matchroom/", views.match_room, name="match-room"),
    path("clubs/", views.clubs_search, name="clubs-search"),
    path("club/<str:club_id>/", views.club_detail, name="club-detail"),
    path("squad/", views.squad_stats, name="squad-stats"),
    path("search/", views.search, name="search"),
    path("recent/", views.recent, name="recent"),
    path("leaderboard/", views.leaderboard, name="leaderboard"),
    path("hltv/<str:section>/", views.hltv, name="hltv"),
    path("analyze/<str:nickname>/", views.analyze, name="analyze"),
    path("roast/<str:nickname>/", views.roast, name="roast"),
    path("met/", views.have_we_met, name="have-we-met"),
    path("games/leaderboard/", views.game_leaderboard, name="game-leaderboard"),
    path("games/score/", views.game_score, name="game-score"),
]
