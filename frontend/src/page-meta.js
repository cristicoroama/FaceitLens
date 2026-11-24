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

/* "analyser" is the term this market actually searches: ~67k/month against
   ~21k for the American "analyzer" and far more than "tracker" or "finder",
   which is what this title used to lead with. Both spellings appear — the
   title carries one, the description the other, so neither is missing from
   the page. */
export const DEFAULT_TITLE =
  "FACEIT Analyser — CS2 Stats & Smurf Checker | Faceit-Lens";

export const DEFAULT_DESC =
  "Free FACEIT analyzer for CS2. Check any player's ELO, win rate, K/D and map stats, or paste a match room link to analyse all 10 players and spot smurfs.";

export const PAGE_META = {
  leaderboard: ["FACEIT CS2 Leaderboard — Top Players by ELO",
    "Live FACEIT CS2 leaderboard: the highest ELO players ranked, with level, win rate and recent form."],
  worldmap: ["CS2 World Map — Which Countries Have the Best FACEIT Players",
    "An interactive world map of the FACEIT CS2 Challenger pool: how many top players each country has, their average ELO and who leads them."],
  watchlist: ["Watchlist — Track FACEIT Players",
    "Keep an eye on any FACEIT CS2 player. Track ELO changes, recent matches and form across your whole watchlist."],
  matchroom: ["FACEIT Match Room Analyser — Scout Your Lobby",
    "Free FACEIT match room analyzer: paste a lobby link and scout all 10 players instantly — ELO, level, trust score to spot smurfs, and recent form."],
  compare: ["Compare FACEIT Players — Head to Head CS2 Stats",
    "Put up to 5 FACEIT CS2 players side by side: ELO, K/D, HS%, win rate and map performance."],
  squad: ["Squad Stats — Look Up Your CS2 Team",
    "Check your whole CS2 squad at once. Enter nicknames and get every player's FACEIT ELO and stats on one page."],
  "smurf-checker": ["FACEIT Smurf Checker — Detect Smurfs in Your CS2 Lobby",
    "Free FACEIT smurf checker for CS2. Paste a match room link to check all 10 players: account age, CS2 hours, bans, stats vs level and a trust score."],
  "faceit-elo-checker": ["FACEIT ELO Checker — Check Any Player's ELO & Level",
    "Check the FACEIT ELO, level, win rate, K/D and recent matches of any CS2 player for free. Type a nickname or paste a FACEIT profile link."],
  "faceit-levels": ["FACEIT Levels & ELO Ranges for CS2 (2026)",
    "Every FACEIT level and its ELO range, from Level 1 (100–500) to Level 10 (2001+), how ELO is gained and lost, and a calculator for your next level."],
  discordbot: ["FACEIT Discord Bot — ELO, Stats & Level Roles",
    "Free FACEIT bot for Discord: /elo and /stats for any CS2 player, an ELO table of your friends, automatic match results in a channel and verified FACEIT level roles."],
  pickem: ["CS2 Major Pick'em — Play With Your Friends",
    "Free CS2 Major Pick'em with private friend leagues. Pick the 3-0, 0-3 and advancing teams for every Swiss stage and race your friends on a live leaderboard."],
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
  overlay: ["Free FACEIT Stream Overlay for OBS — Faceit-Lens",
    "A live ELO, session record and current-match card for your stream. Free, no install, works in any OBS Browser Source."],
  faq: ["FAQ — How Faceit-Lens Works",
    "How the trust score and skill ratings are calculated, how fresh the stats are, what data is stored, and why ELO history is an estimate."],
  privacy: ["Privacy Policy",
    "What Faceit-Lens stores, what it doesn't, and how to get your data removed. No tracking cookies, no ad networks."],
  support: ["Support & API Access — Faceit-Lens",
    "Report a bug, ask for a data correction, or request an API key. Ticket-based, no account needed."],
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
  "squad", "hubs", "teams", "competitions", "pickem", "discordbot", "smurf-checker", "faceit-elo-checker", "faceit-levels", "proguesser", "games", "docs",
  "faceitstatus", "prosettings", "bans", "steamstatus", "news",
  "settings", "whatsnew", "feedback", "privacy", "terms", "faq", "overlay",
  "support",
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

/* Real links rendered into every prerendered page and the footer, so a crawler
   can reach every tool from anywhere without opening a dropdown. */
export const CRAWL_LINKS = [
  ["/leaderboard", "FACEIT leaderboard"],
  ["/matchroom", "Match room analyser"],
  ["/pickem", "Major Pick'em"],
  ["/discordbot", "FACEIT Discord bot"],
  ["/smurf-checker", "FACEIT smurf checker"],
  ["/faceit-elo-checker", "FACEIT ELO checker"],
  ["/faceit-levels", "FACEIT levels & ELO ranges"],
  ["/compare", "Compare players"],
  ["/squad", "Squad stats"],
  ["/hubs", "FACEIT hubs"],
  ["/teams", "FACEIT teams"],
  ["/competitions", "Championships"],
  ["/bans", "Recent FACEIT bans"],
  ["/prosettings", "CS2 pro settings"],
  ["/overlay", "Stream overlay"],
  ["/faceitstatus", "FACEIT status"],
  ["/steamstatus", "CS2 server status"],
  ["/proguesser", "ProGuesser"],
  ["/faq", "FAQ"],
];
