from django.urls import path
from . import views

urlpatterns = [
    path("player/<str:nickname>/", views.player_summary, name="player-summary"),
    path("player/<str:nickname>/real/", views.real_stats, name="player-real-stats"),
    path("player/<str:nickname>/collectibles/", views.collectibles, name="player-collectibles"),
    path("player/<str:nickname>/leetify/", views.leetify_stats, name="player-leetify"),
    path("steam/", views.player_by_steam, name="player-by-steam"),
    path("steamprofile/", views.steam_profile, name="steam-profile"),
    path("match/<str:match_id>/", views.match_detail, name="match-detail"),
    path("squad/", views.squad_stats, name="squad-stats"),
    path("search/", views.search, name="search"),
    path("recent/", views.recent, name="recent"),
    path("leaderboard/", views.leaderboard, name="leaderboard"),
    path("transfers/", views.transfers, name="transfers"),
    path("analyze/<str:nickname>/", views.analyze, name="analyze"),
    path("met/", views.have_we_met, name="have-we-met"),
    path("games/leaderboard/", views.game_leaderboard, name="game-leaderboard"),
    path("games/score/", views.game_score, name="game-score"),
]
