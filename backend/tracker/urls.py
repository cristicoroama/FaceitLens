from django.urls import path
from . import auth, faceit_oauth, feedback, overlay, profiles, views

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
    path("player/<str:nickname>/clips/", views.player_clips, name="player-clips"),
    path("player/<str:nickname>/clips/generate/", views.player_clips_generate, name="player-clips-generate"),
    path("allstar/webhook/", views.allstar_webhook, name="allstar-webhook"),
    path("player/<str:nickname>/leetify/matches/", views.leetify_matches, name="player-leetify-matches"),
    path("leetify/match/", views.leetify_match, name="leetify-match"),
    path("steam/", views.player_by_steam, name="player-by-steam"),
    path("steamprofile/", views.steam_profile, name="steam-profile"),
    path("match/<str:match_id>/", views.match_detail, name="match-detail"),
    path("health/", views.health, name="health"),
    path("status/", views.status, name="status"),
    path("incidents/", views.incidents, name="incidents"),
    path("changelog/", views.changelog, name="changelog"),

    # --- Stream overlay (OBS browser source) ---
    # The state endpoint is public: OBS has no session, the token is the key.
    path("overlay/settings/", overlay.overlay_settings, name="overlay-settings"),
    path("overlay/session/", overlay.overlay_session, name="overlay-session"),
    path("overlay/<str:token>/", overlay.overlay_state, name="overlay-state"),

    # --- Feedback board (read public, write requires a Steam sign-in) ---
    path("feedback/", feedback.feedback_list, name="feedback-list"),
    path("feedback/meta/", feedback.feedback_meta, name="feedback-meta"),
    path("feedback/<int:item_id>/", feedback.feedback_detail, name="feedback-detail"),
    path("feedback/<int:item_id>/vote/", feedback.feedback_vote, name="feedback-vote"),
    path("feedback/<int:item_id>/comment/", feedback.feedback_comment, name="feedback-comment"),
    path("faceitstatus/", views.faceit_status, name="faceit-status"),
    path("steamstatus/", views.steam_status, name="steam-status"),
    path("bans/", views.recent_bans, name="recent-bans"),
    path("matchroom/", views.match_room, name="match-room"),
    path("hubs/", views.hubs_search, name="hubs-search"),
    path("teams/", views.teams_search, name="teams-search"),
    path("team/<str:team_id>/", views.team_detail, name="team-detail"),
    path("hub/<str:hub_id>/leaderboards/", views.hub_leaderboards, name="hub-leaderboards"),
    path("hub/<str:hub_id>/ranking/", views.hub_ranking, name="hub-ranking"),
    path("competitions/", views.competitions, name="competitions"),
    path("competition/<str:kind>/<str:comp_id>/", views.competition_detail, name="competition-detail"),
    path("organizer/<str:organizer_id>/", views.organizer_detail, name="organizer-detail"),
    path("hub/<str:hub_id>/", views.hub_detail, name="hub-detail"),
    path("squad/", views.squad_stats, name="squad-stats"),
    path("search/", views.search, name="search"),
    path("recent/", views.recent, name="recent"),
    path("leaderboard/", views.leaderboard, name="leaderboard"),
    path("leaderboard/countries/", views.leaderboard_countries, name="leaderboard-countries"),
    path("analyze/<str:nickname>/", views.analyze, name="analyze"),
    path("roast/<str:nickname>/", views.roast, name="roast"),
    path("met/", views.have_we_met, name="have-we-met"),
    path("games/leaderboard/", views.game_leaderboard, name="game-leaderboard"),
    path("games/score/", views.game_score, name="game-score"),
    path("avatar/", views.avatar_proxy, name="avatar-proxy"),
]
