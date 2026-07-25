from django.urls import path
from . import auth, faceit_oauth, profiles, views

urlpatterns = [
    # --- Sign in with Steam + account ---
    path("auth/steam/login/", auth.steam_login, name="auth-steam-login"),
    path("auth/steam/return/", auth.steam_return, name="auth-steam-return"),
    path("auth/me/", auth.me, name="auth-me"),
    path("auth/logout/", auth.logout_view, name="auth-logout"),
    path("auth/favorites/", auth.favorites, name="auth-favorites"),

    # --- Sign in with FACEIT (FACEIT Connect / OAuth2 + PKCE) ---
    path("auth/faceit/login/", faceit_oauth.faceit_login, name="auth-faceit-login"),
    path("auth/faceit/return/", faceit_oauth.faceit_return, name="auth-faceit-return"),
    path("auth/faceit/unlink/", faceit_oauth.faceit_unlink, name="auth-faceit-unlink"),
    path("auth/faceit/config/", faceit_oauth.faceit_config, name="auth-faceit-config"),

    # --- User profiles (order matters: the literal paths must beat <handle>) ---
    path("profile/me/", profiles.my_profile, name="profile-me"),
    path("profile/avatar/", profiles.avatar_upload, name="profile-avatar"),
    path("profile/handle/", profiles.check_handle, name="profile-handle"),
    path("profile/relink/", profiles.relink_faceit, name="profile-relink"),
    path("profile/report/", profiles.report_profile, name="profile-report"),
    path("profiles/", profiles.profile_directory, name="profile-directory"),
    path("profile/<str:handle>/progress/", profiles.elo_progress, name="profile-progress"),
    path("profile/<str:handle>/", profiles.public_profile, name="profile-public"),
    path("avatar/<str:handle>/", profiles.avatar_serve, name="profile-avatar-serve"),

    path("player/<str:nickname>/", views.player_summary, name="player-summary"),
    path("player/<str:nickname>/real/", views.real_stats, name="player-real-stats"),
    path("player/<str:nickname>/collectibles/", views.collectibles, name="player-collectibles"),
    path("player/<str:nickname>/leetify/", views.leetify_stats, name="player-leetify"),
    path("player/<str:nickname>/leetify/matches/", views.leetify_matches, name="player-leetify-matches"),
    path("leetify/match/", views.leetify_match, name="leetify-match"),
    path("steam/", views.player_by_steam, name="player-by-steam"),
    path("steamprofile/", views.steam_profile, name="steam-profile"),
    path("match/<str:match_id>/", views.match_detail, name="match-detail"),
    path("health/", views.health, name="health"),
    path("status/", views.status, name="status"),
    path("incidents/", views.incidents, name="incidents"),
    path("changelog/", views.changelog, name="changelog"),
    path("faceitstatus/", views.faceit_status, name="faceit-status"),
    path("steamstatus/", views.steam_status, name="steam-status"),
    path("bans/", views.recent_bans, name="recent-bans"),
    path("matchroom/", views.match_room, name="match-room"),
    path("clubs/", views.clubs_search, name="clubs-search"),
    path("club/<str:club_id>/", views.club_detail, name="club-detail"),
    path("squad/", views.squad_stats, name="squad-stats"),
    path("search/", views.search, name="search"),
    path("recent/", views.recent, name="recent"),
    path("leaderboard/", views.leaderboard, name="leaderboard"),
    path("analyze/<str:nickname>/", views.analyze, name="analyze"),
    path("roast/<str:nickname>/", views.roast, name="roast"),
    path("met/", views.have_we_met, name="have-we-met"),
    path("games/leaderboard/", views.game_leaderboard, name="game-leaderboard"),
    path("games/score/", views.game_score, name="game-score"),
]
