from django.urls import path
from . import views

urlpatterns = [
    path("player/<str:nickname>/", views.player_summary, name="player-summary"),
    path("match/<str:match_id>/", views.match_detail, name="match-detail"),
    path("squad/", views.squad_stats, name="squad-stats"),
]
