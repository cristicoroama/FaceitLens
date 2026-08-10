/* Per-page <title> and meta description.
 *
 * This lives in its own module because two very different things need it:
 * the running app (App.jsx, which swaps the tags on navigation) and the
 * build-time prerenderer (scripts/prerender.mjs, which bakes them into the
 * HTML Google actually reads). Keeping one copy is what stops the two from
 * drifting apart — a prerendered title that disagrees with the live one is
 * worse than having neither.
 *
 * Keys are the app's internal `mode`, which for these pages is also the URL
 * path: `leaderboard` -> /leaderboard.
 */

export const SITE_URL = "https://faceit-lens.com";

export const DEFAULT_TITLE =
  "Faceit-Lens — FACEIT CS2 Stats, ELO Tracker & Account Checker";

export const DEFAULT_DESC =
  "Look up any FACEIT CS2 player: ELO, level, win rate, K/D, map stats and match history. Plus an account trust score to spot smurfs, inventory value, Leetify demo stats, a match-room analyzer and pro player settings.";

export const PAGE_META = {
  leaderboard: ["FACEIT CS2 Leaderboard — Top Players by ELO",
    "Live FACEIT CS2 leaderboard: the highest ELO players ranked, with level, win rate and recent form."],
  worldmap: ["CS2 World Map — Which Countries Have the Best FACEIT Players",
    "An interactive world map of the FACEIT CS2 Challenger pool: how many top players each country has, their average ELO and who leads them."],
  watchlist: ["Watchlist — Track FACEIT Players",
    "Keep an eye on any FACEIT CS2 player. Track ELO changes, recent matches and form across your whole watchlist."],
  matchroom: ["FACEIT Match Room Analyzer — Scout Your Lobby",
    "Paste a FACEIT match room link and scout all 10 players instantly: ELO, level, trust score and recent form."],
  compare: ["Compare FACEIT Players — Head to Head CS2 Stats",
    "Put up to 5 FACEIT CS2 players side by side: ELO, K/D, HS%, win rate and map performance."],
  squad: ["Squad Stats — Look Up Your CS2 Team",
    "Check your whole CS2 squad at once. Enter nicknames and get every player's FACEIT ELO and stats on one page."],
  competitions: ["CS2 Championships & Tournaments on FACEIT",
    "Browse open CS2 championships and tournaments, see brackets, final standings and who organises them."],
  teams: ["FACEIT Teams — Rosters, Records & Map Stats",
    "Search any FACEIT CS2 team: roster, win rate, best maps and every player's stats."],
  hubs: ["FACEIT Hubs — Find CS2 Communities",
    "Search FACEIT hubs by name, see who plays there and open any member's stats. Find an active CS2 community to queue in."],
  proguesser: ["ProGuesser — Guess the CS2 Pro Game",
    "Can you name the CS2 pro from their stats? A daily guessing game for Counter-Strike fans."],
  prosettings: ["CS2 Pro Settings — Crosshair, Sensitivity & Config",
    "Crosshair codes, sensitivity, DPI, resolution and video settings from professional CS2 players."],
  games: ["CS2 Minigames — Quizzes & Trivia",
    "Test your Counter-Strike knowledge: economy quizzes, callout trivia and more CS2 minigames."],
  bans: ["Recent FACEIT Bans — CS2 Cheaters & Smurfs",
    "A live feed of recent FACEIT CS2 bans. See who got banned, when, and why."],
  faceitstatus: ["FACEIT Status — Is FACEIT Down Right Now?",
    "Live FACEIT server status. Check outages, incidents and whether FACEIT is down before you queue."],
  steamstatus: ["Steam & CS2 Status — Is CS2 Down Right Now?",
    "Live Steam and Counter-Strike 2 server status, player counts and current outages."],
  docs: ["Faceit-Lens API Documentation",
    "Free REST API for FACEIT CS2 player stats, ELO history and account trust scores. Endpoints, examples and rate limits."],
  news: ["CS2 & FACEIT Status News", "Latest FACEIT and Counter-Strike 2 incidents, outages and service updates."],
  whatsnew: ["What's New — Faceit-Lens Changelog", "Latest features, fixes and improvements shipped to Faceit-Lens."],
  feedback: ["Feedback — Faceit-Lens", "Report a bug, request a feature or tell us what to improve on Faceit-Lens."],
  settings: ["Settings — Faceit-Lens", DEFAULT_DESC],
  faq: ["FAQ — How Faceit-Lens Works",
    "How the trust score and skill ratings are calculated, how fresh the stats are, what data is stored, and why ELO history is an estimate."],
  privacy: ["Privacy Policy",
    "What Faceit-Lens stores, what it doesn't, and how to get your data removed. No tracking cookies, no ad networks."],
  terms: ["Terms of Service",
    "Terms for using Faceit-Lens: fair use, API limits, and why trust scores and skill ratings are estimates rather than accusations."],
};

/* Pages that exist for signed-in users only. robots.txt already disallows
   /settings, so prerendering it would just publish a page we've asked Google
   not to look at. */
export const NOINDEX_PAGES = new Set(["settings"]);

/* Tool pages that get their own shareable URL (/docs, /proguesser, …).
   This is what the router accepts as a valid /:page — anything else is a 404,
   so it doubles as the list the prerenderer is allowed to emit. */
export const TOOL_PAGES = new Set([
  "watchlist", "leaderboard", "matchroom", "compare",
  "squad", "hubs", "teams", "competitions", "proguesser", "games", "docs",
  "faceitstatus", "prosettings", "bans", "steamstatus", "news",
  "settings", "whatsnew", "feedback", "privacy", "terms", "faq",
]);

/**
 * Every URL the build should emit real HTML for, as [path, metaKey].
 *
 * `worldmap` is the odd one out: it has no /:page route of its own, it lives
 * at /leaderboard/map via the :region param. It is listed explicitly rather
 * than derived, because deriving it would mean teaching the prerenderer about
 * router internals it has no other reason to know.
 */
export function prerenderRoutes() {
  const routes = [["/", null]];
  for (const page of TOOL_PAGES) {
    if (NOINDEX_PAGES.has(page)) continue;
    routes.push([`/${page}`, page]);
  }
  routes.push(["/leaderboard/map", "worldmap"]);
  return routes;
}
