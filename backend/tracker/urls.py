from django.urls import path
from . import views

urlpatterns = [
    path("player/<str:nickname>/", views.player_summary, name="player-summary"),
    path("steam/", views.player_by_steam, name="player-by-steam"),
    path("match/<str:match_id>/", views.match_detail, name="match-detail"),
    path("squad/", views.squad_stats, name="squad-stats"),
    path("search/", views.search, name="search"),
    path("recent/", views.recent, name="recent"),
    path("leaderboard/", views.leaderboard, name="leaderboard"),
    path("analyze/<str:nickname>/", views.analyze, name="analyze"),
]
