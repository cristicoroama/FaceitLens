import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PlayerHeader from "./components/PlayerHeader.jsx";
import MatchHistory from "./components/MatchHistory.jsx";
import EloChart from "./components/EloChart.jsx";
import CompareView from "./components/CompareView.jsx";
import MapStats from "./components/MapStats.jsx";
import Squad from "./components/Squad.jsx";
import Skeleton from "./components/Skeleton.jsx";
import BanBanner from "./components/BanBanner.jsx";
import SearchInput from "./components/SearchInput.jsx";
import BestTeammates from "./components/BestTeammates.jsx";
import HltvStats from "./components/HltvStats.jsx";
import RealStats from "./components/RealStats.jsx";
import Clips from "./components/Clips.jsx";
import AccountView from "./components/AccountView.jsx";
import LeetifyStats from "./components/LeetifyStats.jsx";
import Activity from "./components/Activity.jsx";
import TeammatesFull from "./components/TeammatesFull.jsx";
import Hubs from "./components/Hubs.jsx";
import SteamInfo from "./components/SteamInfo.jsx";
import Nicknames from "./components/Nicknames.jsx";
import HaveWeMet from "./components/HaveWeMet.jsx";
import OverviewGrid from "./components/OverviewGrid.jsx";
import Games from "./components/Games.jsx";
import ProGuesser from "./components/ProGuesser.jsx";
import ApiDocs from "./components/ApiDocs.jsx";
import NewsPage from "./components/NewsPage.jsx";
import Clubs from "./components/Clubs.jsx";
import FaceitStatus from "./components/FaceitStatus.jsx";
import ProSettings from "./components/ProSettings.jsx";
import FaceitBans from "./components/FaceitBans.jsx";
import SteamStatus from "./components/SteamStatus.jsx";
import Leaderboard from "./components/Leaderboard.jsx";
import ThemeMenu from "./components/ThemeMenu.jsx";
import SteamProfileView from "./components/SteamProfileView.jsx";
import AccountMenu from "./components/AccountMenu.jsx";
import NewsButton from "./components/NewsButton.jsx";
import MatchRoom from "./components/MatchRoom.jsx";
import Watchlist from "./components/Watchlist.jsx";
import EloProjector from "./components/EloProjector.jsx";
import Nemeses from "./components/Nemeses.jsx";
import SmurfMeter from "./components/SmurfMeter.jsx";
import ShareCard from "./components/ShareCard.jsx";
import Wrapped from "./components/Wrapped.jsx";
import ProfileSettings from "./components/ProfileSettings.jsx";
import PublicProfile from "./components/PublicProfile.jsx";
import Feedback from "./components/Feedback.jsx";
import WhatsNew, {
  useChangelog, WhatsNewPopup, WhatsNewButton,
} from "./components/WhatsNew.jsx";
import SiteFooter from "./components/SiteFooter.jsx";
import { PrivacyPolicy, Terms } from "./components/Legal.jsx";
import { getFavorites, toggleFavorite } from "./favorites.js";
import { DISCORD_INVITE } from "./links.js";

const API_BASE = import.meta.env.VITE_API_URL || "";

// Re-exported for existing importers; the canonical copy lives in links.js.
export { DISCORD_INVITE };

/** Parse a JSON response; a non-JSON (HTML error page) becomes a clean error
    instead of "Unexpected token '<' ... is not valid JSON". */
async function readJson(resp, notFoundMsg = "Not found.") {
  let json;
  try {
    json = await resp.json();
  } catch {
    throw new Error(resp.ok ? "Unexpected server response." : notFoundMsg);
  }
  if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
  return json;
}

async function fetchPlayer(nick) {
  const resp = await fetch(`${API_BASE}/api/player/${encodeURIComponent(nick)}/`);
  return readJson(resp, "Player not found.");
}

async function fetchSquad(nicks) {
  const resp = await fetch(`${API_BASE}/api/squad/?players=${encodeURIComponent(nicks)}`);
  return readJson(resp);
}

async function resolveSteam(steamInput) {
  const resp = await fetch(`${API_BASE}/api/steam/?id=${encodeURIComponent(steamInput)}`);
  const json = await readJson(resp);
  return json.nickname;
}

async function fetchSteamProfileByInput(raw) {
  const resp = await fetch(`${API_BASE}/api/steamprofile/?id=${encodeURIComponent(raw)}`);
  return readJson(resp, "Steam profile not found.");
}

/** Does this search input look like a Steam account rather than a nickname? */
function looksLikeSteam(input) {
  return /7656\d{13}/.test(input) || /steamcommunity\.com/i.test(input);
}

function eloData(player) {
  if (player.elo_snapshots && player.elo_snapshots.length >= 2) {
    return player.elo_snapshots.map((s) => ({
      date: Math.floor(new Date(s.date).getTime() / 1000),
      elo: s.elo,
    }));
  }
  return player.elo_history || [];
}

/* ---- sidebar nav icons (inline, stroke) ---- */
const I = {
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  ),
  board: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
    </svg>
  ),
  vs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M16 3h5v5M8 21H3v-5M21 3l-7.5 7.5M3 21l7.5-7.5" />
    </svg>
  ),
  squad: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17.5" cy="9.5" r="2.5" /><path d="M15.5 15.5a5 5 0 0 1 6 4.5" />
    </svg>
  ),
  game: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="7" width="20" height="11" rx="5" /><path d="M7 11v3M5.5 12.5h3" /><circle cx="16" cy="11.5" r="0.6" fill="currentColor" /><circle cx="18.5" cy="13.5" r="0.6" fill="currentColor" />
    </svg>
  ),
  xhair: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="7" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  ),
  room: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M16 3h5v5M8 21H3v-5M21 3l-7.5 7.5M3 21l7.5-7.5" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 2 2.9 6.3 6.8.7-5 4.6 1.4 6.7L12 17.8 5.9 20.3l1.4-6.7-5-4.6 6.8-.7L12 2Z" />
    </svg>
  ),
  pulse: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  ban: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" /><path d="m5.5 5.5 13 13" />
    </svg>
  ),
  feedback: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.8-.9L3 20.5l1.5-4.4A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z" />
    </svg>
  ),
};

const NAV = [
  { group: "FACEIT", items: [
    { id: "single", label: "Player Search", icon: I.search },
    { id: "watchlist", label: "Watchlist", icon: I.star },
    { id: "leaderboard", label: "Leaderboard", icon: I.board },
  ]},
  { group: "Live", items: [
    { id: "faceitstatus", label: "FACEIT Status", icon: I.pulse },
    { id: "steamstatus", label: "Steam / CS2 Status", icon: I.pulse },
    { id: "bans", label: "Recent Bans", icon: I.ban },
  ]},
  { group: "Tools", items: [
    { id: "matchroom", label: "Match Room", icon: I.room },
    { id: "compare", label: "Compare", icon: I.vs },
    { id: "squad", label: "Squad", icon: I.squad },
    { id: "clubs", label: "Clubs", icon: I.hubs },
  ]},
  { group: "Extras", items: [
    { id: "proguesser", label: "ProGuesser", icon: I.star },
    { id: "prosettings", label: "Pro Settings", icon: I.xhair },
    { id: "games", label: "Minigames", icon: I.game },
  ]},
  { group: "Developers", items: [
    { id: "docs", label: "API Docs", icon: I.vs },
  ]},
  { group: "About", items: [
    { id: "whatsnew", label: "What's New", icon: I.star },
    { id: "feedback", label: "Feedback", icon: I.feedback },
  ]},
];

/* profile tab icons (inline, stroke) */
const TI = {
  clips: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M10 9l5 3-5 3z" />
    </svg>
  ),
  overview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  trust: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 5.5v5.1c0 4.9 3.4 9.5 8 10.9 4.6-1.4 8-6 8-10.9V5.5L12 2Z" /><path d="m9 11.5 2.2 2.2L15.5 9" />
    </svg>
  ),
  leetify: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" />
    </svg>
  ),
  real: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
    </svg>
  ),
  hltv: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 19V5M4 12h8M12 19V5M20 19V5M12 12h8" />
    </svg>
  ),
  teammates: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17.5" cy="9.5" r="2.5" /><path d="M15.5 15.5a5 5 0 0 1 6 4.5" />
    </svg>
  ),
  hubs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" /><circle cx="5" cy="5" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><path d="M6.5 6.5 10 10M17.5 6.5 14 10M6.5 17.5 10 14M17.5 17.5 14 14" />
    </svg>
  ),
  met: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 12h8M12 8v8" /><circle cx="12" cy="12" r="9" />
    </svg>
  ),
  steam: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.98 2C6.72 2 2.4 6.03 2.03 11.19l5.36 2.22a2.79 2.79 0 0 1 1.57-.48l.14.01 2.39-3.46v-.05a3.72 3.72 0 1 1 3.72 3.72h-.09l-3.4 2.43v.13a2.8 2.8 0 0 1-5.58.2l-3.84-1.6A10 10 0 1 0 11.98 2ZM8.28 17.6l-1.23-.51c.22.45.6.83 1.1 1.04a2.09 2.09 0 0 0 1.63-3.85 2.08 2.08 0 0 0-1.57-.02l1.27.53a1.54 1.54 0 0 1-1.2 2.83Zm7.44-6.16a2.48 2.48 0 1 0 0-4.96 2.48 2.48 0 0 0 0 4.96Zm0-.77a1.7 1.7 0 1 1 0-3.41 1.7 1.7 0 0 1 0 3.41Z" />
    </svg>
  ),
  nicknames: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7V5h16v2M12 5v14M9 19h6" />
    </svg>
  ),
};

/* popular pros shown on the home page when there's no search history */
const POPULAR_PROS = ["donk666", "ZywOo", "s1mple", "NiKo", "m0NESY", "ropz", "sh1ro", "b1t"];

/* Home-page feature icons — Bootstrap Icons (MIT), inlined rather than pulled
   in as a dependency so there's no extra request and they inherit currentColor
   like the rest of the icon sets above. These were emoji, which was the single
   loudest "unfinished" signal on the whole page. */
const bi = (paths) => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">{paths}</svg>
);

const BI = {
  incognito: bi(<path fillRule="evenodd" d="m4.736 1.968-.892 3.269-.014.058C2.113 5.568 1 6.006 1 6.5 1 7.328 4.134 8 8 8s7-.672 7-1.5c0-.494-1.113-.932-2.83-1.205l-.014-.058-.892-3.27c-.146-.533-.698-.849-1.239-.734C9.411 1.363 8.62 1.5 8 1.5s-1.411-.136-2.025-.267c-.541-.115-1.093.2-1.239.735m.015 3.867a.25.25 0 0 1 .274-.224c.9.092 1.91.143 2.975.143a30 30 0 0 0 2.975-.143.25.25 0 0 1 .05.498c-.918.093-1.944.145-3.025.145s-2.107-.052-3.025-.145a.25.25 0 0 1-.224-.274M3.5 10h2a.5.5 0 0 1 .5.5v1a1.5 1.5 0 0 1-3 0v-1a.5.5 0 0 1 .5-.5m-1.5.5q.001-.264.085-.5H2a.5.5 0 0 1 0-1h3.5a1.5 1.5 0 0 1 1.488 1.312 3.5 3.5 0 0 1 2.024 0A1.5 1.5 0 0 1 10.5 9H14a.5.5 0 0 1 0 1h-.085q.084.236.085.5v1a2.5 2.5 0 0 1-5 0v-.14l-.21-.07a2.5 2.5 0 0 0-1.58 0l-.21.07v.14a2.5 2.5 0 0 1-5 0zm8.5-.5h2a.5.5 0 0 1 .5.5v1a1.5 1.5 0 0 1-3 0v-1a.5.5 0 0 1 .5-.5" />),
  shieldCheck: bi(<>
    <path d="M5.338 1.59a61 61 0 0 0-2.837.856.48.48 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.7 10.7 0 0 0 2.287 2.233c.346.244.652.42.893.533q.18.085.293.118a1 1 0 0 0 .101.025 1 1 0 0 0 .1-.025q.114-.034.294-.118c.24-.113.547-.29.893-.533a10.7 10.7 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56" />
    <path d="M10.854 5.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 7.793l2.646-2.647a.5.5 0 0 1 .708 0" />
  </>),
  people: bi(<path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1zm-7.978-1L7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002-.014.002zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4m3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6.936 9.28a6 6 0 0 0-1.23-.247A7 7 0 0 0 5 9c-4 0-5 3-5 4q0 1 1 1h4.216A2.24 2.24 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816M4.92 10A5.5 5.5 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275ZM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0m3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4" />),
  sliders: bi(<path fillRule="evenodd" d="M11.5 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M9.05 3a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0V3zM4.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M2.05 8a2.5 2.5 0 0 1 4.9 0H16v1H6.95a2.5 2.5 0 0 1-4.9 0H0V8zm9.45 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m-2.45 1a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0v-1z" />),
  controller: bi(<>
    <path d="M11.5 6.027a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0m-1.5 1.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1m2.5-.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0m-1.5 1.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1m-6.5-3h1v1h1v1h-1v1h-1v-1h-1v-1h1z" />
    <path d="M3.051 3.26a.5.5 0 0 1 .354-.613l1.932-.518a.5.5 0 0 1 .62.39c.655-.079 1.35-.117 2.043-.117.72 0 1.443.041 2.12.126a.5.5 0 0 1 .622-.399l1.932.518a.5.5 0 0 1 .306.729q.211.136.373.297c.408.408.78 1.05 1.095 1.772.32.733.599 1.591.805 2.466s.34 1.78.364 2.606c.024.816-.059 1.602-.328 2.21a1.42 1.42 0 0 1-1.445.83c-.636-.067-1.115-.394-1.513-.773-.245-.232-.496-.526-.739-.808-.126-.148-.25-.292-.368-.423-.728-.804-1.597-1.527-3.224-1.527s-2.496.723-3.224 1.527c-.119.131-.242.275-.368.423-.243.282-.494.575-.739.808-.398.38-.877.706-1.513.773a1.42 1.42 0 0 1-1.445-.83c-.27-.608-.352-1.395-.329-2.21.024-.826.16-1.73.365-2.606.206-.875.486-1.733.805-2.466.315-.722.687-1.364 1.094-1.772a2.3 2.3 0 0 1 .433-.335l-.028-.079zm2.036.412c-.877.185-1.469.443-1.733.708-.276.276-.587.783-.885 1.465a14 14 0 0 0-.748 2.295 12.4 12.4 0 0 0-.339 2.406c-.022.755.062 1.368.243 1.776a.42.42 0 0 0 .426.24c.327-.034.61-.199.929-.502.212-.202.4-.423.615-.674.133-.156.276-.323.44-.504C4.861 9.969 5.978 9.027 8 9.027s3.139.942 3.965 1.855c.164.181.307.348.44.504.214.251.403.472.615.674.318.303.601.468.929.503a.42.42 0 0 0 .426-.241c.18-.408.265-1.02.243-1.776a12.4 12.4 0 0 0-.339-2.406 14 14 0 0 0-.748-2.295c-.298-.682-.61-1.19-.885-1.465-.264-.265-.856-.523-1.733-.708-.85-.179-1.877-.27-2.913-.27s-2.063.091-2.913.27" />
  </>),
  broadcast: bi(<path d="M3.05 3.05a7 7 0 0 0 0 9.9.5.5 0 0 1-.707.707 8 8 0 0 1 0-11.314.5.5 0 0 1 .707.707m2.122 2.122a4 4 0 0 0 0 5.656.5.5 0 1 1-.708.708 5 5 0 0 1 0-7.072.5.5 0 0 1 .708.708m5.656-.708a.5.5 0 0 1 .708 0 5 5 0 0 1 0 7.072.5.5 0 1 1-.708-.708 4 4 0 0 0 0-5.656.5.5 0 0 1 0-.708m2.122-2.12a.5.5 0 0 1 .707 0 8 8 0 0 1 0 11.313.5.5 0 0 1-.707-.707 7 7 0 0 0 0-9.9.5.5 0 0 1 0-.707zM6 8a2 2 0 1 1 2.5 1.937V15.5a.5.5 0 0 1-1 0V9.937A2 2 0 0 1 6 8" />),
};

/* flagship features showcased on the home page. nav = tool page id (clickable),
   no nav = feature lives inside a player profile → focus the search box. */
const HOME_FEATURES = [
  { icon: BI.incognito, title: "Smurf Detector", nav: null,
    desc: "Combines HS%, K/D, hours and account age into a smurf likelihood — and flags FACEIT bans." },
  { icon: BI.shieldCheck, title: "Account Trust Score", nav: null,
    desc: "Steam age, hours, level, bans and inventory in one legit-o-meter. Spot throwaways instantly." },
  { icon: BI.people, title: "Match Room Analyzer", nav: "matchroom",
    desc: "Paste a FACEIT room link and scout all 10 players + an ELO win prediction." },
  { icon: BI.sliders, title: "Pro Settings", nav: "prosettings",
    desc: "Sensitivity, DPI, eDPI, resolution and full gear for 180+ CS2 pros." },
  { icon: BI.controller, title: "ProGuesser", nav: "proguesser",
    desc: "Guess the mystery CS pro of the day — a daily Wordle for Counter-Strike." },
  { icon: BI.broadcast, title: "Live Status", nav: "faceitstatus",
    desc: "Is FACEIT or CS2 matchmaking down? Live platform status and recent bans." },
];

/* tool pages that get their own shareable URL (/docs, /proguesser, …) */
const TOOL_PAGES = new Set([
  "watchlist", "leaderboard", "matchroom", "compare",
  "squad", "clubs", "proguesser", "games", "docs",
  "faceitstatus", "prosettings", "bans", "steamstatus", "news",
  "settings", "whatsnew", "feedback", "privacy", "terms",
]);

/** The URL a nav id points at, so nav entries can be real <a href> links —
    crawlable by Google and ctrl/middle-clickable into a new tab. */
function navHref(id) {
  if (id === "single") return "/";
  return TOOL_PAGES.has(id) ? `/${id}` : "/";
}

/** Let the browser handle new-tab/new-window clicks natively; only intercept
    a plain left click so the SPA router takes over. */
function isPlainClick(e) {
  return !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0;
}

/* Per-page <title> and meta description. Without these every one of the 17
   tool pages inherits the homepage title, which is bad for search and for
   anyone holding a dozen tabs open. */
const DEFAULT_TITLE = "FaceitLens — FACEIT CS2 Stats, ELO Tracker & Account Checker";
const DEFAULT_DESC =
  "Look up any FACEIT CS2 player: ELO, level, win rate, K/D, map stats and match history. Plus an account trust score to spot smurfs, inventory value, Leetify demo stats, a match-room analyzer and pro player settings.";

const PAGE_META = {
  leaderboard: ["FACEIT CS2 Leaderboard — Top Players by ELO",
    "Live FACEIT CS2 leaderboard: the highest ELO players ranked, with level, win rate and recent form."],
  watchlist: ["Watchlist — Track FACEIT Players",
    "Keep an eye on any FACEIT CS2 player. Track ELO changes, recent matches and form across your whole watchlist."],
  matchroom: ["FACEIT Match Room Analyzer — Scout Your Lobby",
    "Paste a FACEIT match room link and scout all 10 players instantly: ELO, trust score, smurf signals and recent form."],
  compare: ["Compare FACEIT Players — Head to Head CS2 Stats",
    "Put up to 5 FACEIT CS2 players side by side: ELO, K/D, HS%, win rate and map performance."],
  squad: ["Squad Stats — Look Up Your CS2 Team",
    "Check your whole CS2 squad at once. Enter nicknames and get every player's FACEIT ELO and stats on one page."],
  clubs: ["FACEIT Clubs & Hubs Finder",
    "Browse FACEIT clubs and hubs, see members and find active CS2 communities to play in."],
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
  docs: ["FaceitLens API Documentation",
    "Free REST API for FACEIT CS2 player stats, ELO history and account trust scores. Endpoints, examples and rate limits."],
  news: ["CS2 & FACEIT Status News", "Latest FACEIT and Counter-Strike 2 incidents, outages and service updates."],
  whatsnew: ["What's New — FaceitLens Changelog", "Latest features, fixes and improvements shipped to FaceitLens."],
  feedback: ["Feedback — FaceitLens", "Report a bug, request a feature or tell us what to improve on FaceitLens."],
  settings: ["Settings — FaceitLens", DEFAULT_DESC],
  privacy: ["Privacy Policy",
    "What FaceitLens stores, what it doesn't, and how to get your data removed. No tracking cookies, no ad networks."],
  terms: ["Terms of Service",
    "Terms for using FaceitLens: fair use, API limits, and why trust and smurf scores are estimates rather than accusations."],
};

/** Swap the document title + meta description for the current view. */
function applyMeta(title, desc) {
  document.title = title;
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", "description");
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", desc);
}

const PROFILE_TABS = [
  ["overview", "Overview", TI.overview],
  ["account", "Trust", TI.trust],
  ["leetify", "Leetify", TI.leetify],
  ["real", "Demos", TI.real],
  ["clips", "Clips", TI.clips],
  ["hltv", "HLTV Stats", TI.hltv],
  ["teammates", "Teammates", TI.teammates],
  ["steam", "Steam", TI.steam],
  ["hubs", "Hubs", TI.hubs],
  ["met", "Have We Met?", TI.met],
  ["nicknames", "Nicknames", TI.nicknames],
];

export default function App() {
  const { nickname: routeNick, steamid: routeSteam, page: routePage, handle: routeHandle } = useParams();
  const navigate = useNavigate();

  const [nickname, setNickname] = useState(routeNick || "");
  const [mode, setMode] = useState("single");
  const [nickname2, setNickname2] = useState("");
  const [compareInputs, setCompareInputs] = useState(["", ""]);
  const [squadInput, setSquadInput] = useState("");

  const [data, setData] = useState(null);
  const [data2, setData2] = useState(null);
  const [comparePlayers, setComparePlayers] = useState(null);
  const [squad, setSquad] = useState(null);
  const [steamProfile, setSteamProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState([]);
  const [favs, setFavs] = useState(getFavorites());
  const [user, setUser] = useState(null);
  const [incidentStatus, setIncidentStatus] = useState(null);
  const [copied, setCopied] = useState(false);
  const [mapFilter, setMapFilter] = useState(null);
  const [profileTab, setProfileTab] = useState("overview");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [roastText, setRoastText] = useState("");
  const [roastLoading, setRoastLoading] = useState(false);
  const [roastError, setRoastError] = useState("");
  const [roastCopied, setRoastCopied] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [showWrapped, setShowWrapped] = useState(false);
  const [cs2Online, setCs2Online] = useState(null);
  // Leetify ban history, fetched alongside the profile (not blocking it) so
  // the smurf detector can use cross-platform bans as a signal.
  const [leetifyBans, setLeetifyBans] = useState(null);
  const changelog = useChangelog();
  const [sideOpen, setSideOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("faceitlens_theme");
    // Only dark and light survive. Anyone still carrying a retired palette
    // (volt, purple, crimson, ocean, gold, midnight) lands on dark rather
    // than on a data-theme attribute nothing styles any more.
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("faceitlens_theme", theme);
  }, [theme]);

  // Who's signed in? (Sign in with Steam — session cookie)
  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me/`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.authenticated) {
          setUser(j);
          setFavs(j.favorites || []);
        }
      })
      .catch(() => {});
  }, []);

  // Leetify ban history for the player on screen. Fetched separately so it
  // never delays the profile itself — the smurf meter simply sharpens once it
  // lands. Players Leetify doesn't know about just return nothing.
  useEffect(() => {
    const nick = data?.nickname;
    if (!nick) { setLeetifyBans(null); return; }
    let cancelled = false;
    setLeetifyBans(null);
    fetch(`${API_BASE}/api/player/${encodeURIComponent(nick)}/leetify/`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => !cancelled && setLeetifyBans(j.bans || []))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [data?.nickname]);

  // Live status / incident feed (managed from the Django admin). Drives the
  // header indicator (blink on active incident) and the /news status page.
  useEffect(() => {
    fetch(`${API_BASE}/api/incidents/`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setIncidentStatus(j))
      .catch(() => setIncidentStatus({ system: { state: "operational", active: false }, incidents: [] }));
  }, []);

  async function logout() {
    try {
      await fetch(`${API_BASE}/api/auth/logout/`, { method: "POST", credentials: "include" });
    } catch { /* ignore */ }
    setUser(null);
    setFavs(getFavorites());
  }

  // Live CS2 online count for the homepage (social proof)
  useEffect(() => {
    fetch(`${API_BASE}/api/steamstatus/`)
      .then((r) => r.json())
      .then((j) => {
        const n = j?.matchmaking?.online_players;
        if (n) setCs2Online(n);
      })
      .catch(() => {});
  }, []);

  // reset AI + roast panels when the player changes
  useEffect(() => {
    setAiText("");
    setAiError("");
    setRoastText("");
    setRoastError("");
    setRoastCopied(false);
  }, [routeNick, data?.nickname]);

  async function runAnalysis() {
    if (!data) return;
    setAiLoading(true);
    setAiError("");
    try {
      const resp = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(data.nickname)}/`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
      setAiText(json.analysis);
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function runRoast() {
    if (!data) return;
    setRoastLoading(true);
    setRoastError("");
    setRoastCopied(false);
    try {
      const resp = await fetch(`${API_BASE}/api/roast/${encodeURIComponent(data.nickname)}/`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
      setRoastText(json.roast);
    } catch (e) {
      setRoastError(e.message);
    } finally {
      setRoastLoading(false);
    }
  }

  function copyRoast() {
    if (!roastText) return;
    const text = `${roastText}\n\n— roasted by faceit-lens.com/player/${data.nickname}`;
    navigator.clipboard.writeText(text).then(() => {
      setRoastCopied(true);
      setTimeout(() => setRoastCopied(false), 1600);
    });
  }

  // Backward-compat: old ?player= links -> /player/<nick>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("player");
    if (p && !routeNick) navigate(`/player/${encodeURIComponent(p)}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tool pages have their own URLs (/docs, /proguesser, /whatsnew…) so they're
  // directly shareable. Map the path segment to the internal mode.
  useEffect(() => {
    if (routePage && TOOL_PAGES.has(routePage)) setMode(routePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePage]);

  // /u/<handle> -> someone's public profile page.
  useEffect(() => {
    if (routeHandle) setMode("publicprofile");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeHandle]);

  // Keep <title> and the meta description in step with what's on screen.
  // A player's own page wins over the tool-page title, since that's the view
  // people actually share links to.
  useEffect(() => {
    if (data && mode === "single") {
      const lvl = data.skill_level ? ` Level ${data.skill_level},` : "";
      const elo = data.elo ? ` ${data.elo} ELO` : "";
      applyMeta(
        `${data.nickname} — FACEIT CS2 Stats, ELO & Trust Score | FaceitLens`,
        `FACEIT CS2 stats for ${data.nickname}:${lvl}${elo}, win rate, K/D, map performance, match history and an account trust score to spot smurfing.`,
      );
      return;
    }
    if (steamProfile) {
      const name = steamProfile.persona || steamProfile.faceit_nickname || "Steam player";
      applyMeta(
        `${name} — Steam & CS2 Account Check | FaceitLens`,
        `Steam account overview for ${name}: CS2 hours, inventory value, bans, profile age and account trust signals.`,
      );
      return;
    }
    const meta = PAGE_META[mode];
    applyMeta(meta ? `${meta[0]} | FaceitLens` : DEFAULT_TITLE, meta ? meta[1] : DEFAULT_DESC);
  }, [mode, data, steamProfile]);

  // Coming back from Steam: "nolink" means we signed them in but couldn't find
  // a FACEIT account for their Steam ID, so send them to settings to set it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const login = params.get("login");
    if (!login) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (login === "nolink") {
      setMode("settings");
      navigate("/settings");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to the URL: /player/<nick> or /steam/<id64> loads that profile.
  useEffect(() => {
    if (routeNick) {
      setNickname(routeNick);
      setMode("single");
      setSteamProfile(null);
      loadPlayer(routeNick);
    } else if (routeSteam) {
      setMode("single");
      loadSteamProfile(routeSteam);
    } else {
      setData(null);
      setSquad(null);
      setSteamProfile(null);
      fetch(`${API_BASE}/api/recent/`)
        .then((r) => r.json())
        .then((j) => setRecent(j.items || []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeNick, routeSteam]);

  async function loadSteamProfile(id) {
    setLoading(true);
    setError("");
    setData(null);
    setData2(null);
    setComparePlayers(null);
    setSquad(null);
    setSteamProfile(null);
    try {
      const resp = await fetch(`${API_BASE}/api/steamprofile/?id=${encodeURIComponent(id)}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
      setSteamProfile(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlayer(nick) {
    setLoading(true);
    setError("");
    setData(null);
    setData2(null);
    setComparePlayers(null);
    setSquad(null);
    try {
      setData(await fetchPlayer(nick));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function runCompare() {
    const names = compareInputs.map((n) => n.trim()).filter(Boolean);
    if (names.length < 2) {
      setError("Enter at least two players to compare.");
      return;
    }
    setLoading(true);
    setError("");
    setData(null);
    setData2(null);
    setComparePlayers(null);
    setSquad(null);
    try {
      const results = await Promise.all(names.map((n) => fetchPlayer(n)));
      setComparePlayers(results);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function setCompareAt(i, v) {
    setCompareInputs((arr) => arr.map((x, idx) => (idx === i ? v : x)));
  }
  function addCompareSlot() {
    setCompareInputs((arr) => (arr.length >= 5 ? arr : [...arr, ""]));
  }
  function removeCompareSlot(i) {
    setCompareInputs((arr) => (arr.length <= 2 ? arr : arr.filter((_, idx) => idx !== i)));
  }

  async function runSquad() {
    setLoading(true);
    setError("");
    setData(null);
    setData2(null);
    setComparePlayers(null);
    setSquad(null);
    try {
      setSquad(await fetchSquad(squadInput));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  /**
   * One smart entry point for every search box: FACEIT nicknames go to the
   * player page; anything Steam-shaped (profile URL, SteamID64, vanity via
   * the Steam toggle) resolves to the linked FACEIT profile when there is
   * one, else to the Steam-first profile page.
   */
  async function smartSearch(raw, { steamOnly = false } = {}) {
    const input = (raw || "").trim();
    if (!input) return;

    if (!steamOnly && !looksLikeSteam(input)) {
      navigate(`/player/${encodeURIComponent(input)}`);
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Prefer the FACEIT profile when the account is linked...
      const nick = await resolveSteam(input);
      navigate(`/player/${encodeURIComponent(nick)}`);
    } catch {
      // ...otherwise fall back to the Steam-first profile page (also handles
      // vanity names via the backend resolver).
      try {
        const json = await fetchSteamProfileByInput(input);
        if (json.faceit_nickname) {
          navigate(`/player/${encodeURIComponent(json.faceit_nickname)}`);
        } else {
          navigate(`/steam/${json.steamid}`);
        }
      } catch (e2) {
        setError(e2.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function searchHome() {
    smartSearch(nickname);
  }

  async function applyMapFilter(map) {
    setMapFilter(map);
    if (!data) return;
    try {
      const qs = map ? `?map=${encodeURIComponent(map)}` : "";
      const resp = await fetch(`${API_BASE}/api/player/${encodeURIComponent(data.nickname)}/${qs}`);
      const json = await resp.json();
      if (resp.ok) setData((d) => ({ ...d, recent_avg: json.recent_avg }));
    } catch {
      // ignore
    }
  }

  function go(nick) {
    setNickname(nick);
    setMode("single");
    navigate(`/player/${encodeURIComponent(nick)}`);
  }

  function pickNav(id) {
    setSideOpen(false);
    setError("");
    if (id === "single") {
      setMode("single");
      navigate("/");
      return;
    }
    setMode(id);
    // give tool pages a real, shareable URL (/docs, /proguesser…)
    if (TOOL_PAGES.has(id)) navigate(`/${id}`);
  }

  async function onToggleFav() {
    if (!data) return;
    if (!user) {
      // anonymous: localStorage as before
      setFavs(toggleFavorite(data.nickname));
      return;
    }
    // signed in: favorites live in the account (synced across devices)
    const has = favs.some((n) => n.toLowerCase() === data.nickname.toLowerCase());
    try {
      const resp = await fetch(`${API_BASE}/api/auth/favorites/`, {
        method: has ? "DELETE" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: data.nickname }),
      });
      const j = await resp.json();
      if (j.favorites) setFavs(j.favorites);
    } catch { /* keep old state */ }
  }

  const isFav = data ? favs.some((n) => n.toLowerCase() === data.nickname.toLowerCase()) : false;

  function share() {
    if (!data) return;
    const link = `${window.location.origin}/p/${encodeURIComponent(data.nickname)}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const eloSeries = [];
  if (data) {
    const d = eloData(data);
    if (d.length) eloSeries.push({ name: data.nickname, color: "var(--accent)", data: d });
  }
  if (data2) {
    const d = eloData(data2);
    if (d.length) eloSeries.push({ name: data2.nickname, color: "var(--accent-2)", data: d });
  }

  const showProfile = mode === "single" && !loading && data && !data2;
  const showHome =
    mode === "single" && !routeNick && !routeSteam &&
    !loading && !data && !squad && !steamProfile;

  return (
    <div className="shell">
      {/* ============ SIDEBAR ============ */}
      <div className={`side-backdrop ${sideOpen ? "show" : ""}`} onClick={() => setSideOpen(false)} />
      <aside className={`sidebar ${sideOpen ? "open" : ""}`}>
        <div className="side-brand" onClick={() => { setSideOpen(false); setMode("single"); navigate("/"); }}>
          <img className="logo-img" src="/logo.png" alt="FaceitLens" width="36" height="36" />
          Faceit<span>Lens</span>
        </div>

        <div className="side-nav">
          {user?.profile?.handle && (
            <div>
              <div className="side-group">You</div>
              <a
                href={`/u/${user.profile.handle}`}
                className={`side-link side-me ${mode === "publicprofile" ? "active" : ""}`}
                aria-current={mode === "publicprofile" ? "page" : undefined}
                onClick={(e) => {
                  if (!isPlainClick(e)) return;
                  e.preventDefault();
                  setSideOpen(false);
                  setMode("publicprofile");
                  navigate(`/u/${user.profile.handle}`);
                }}
              >
                {user.avatar
                  ? <img className="side-me-av" src={user.avatar} alt="" />
                  : <span className="side-me-av ph">{(user.name || "?").slice(0, 1).toUpperCase()}</span>}
                My profile
              </a>
              {user.profile.faceit_nickname && (
                <a
                  href={`/player/${encodeURIComponent(user.profile.faceit_nickname)}`}
                  className="side-link"
                  onClick={(e) => {
                    if (!isPlainClick(e)) return;
                    e.preventDefault();
                    setSideOpen(false);
                    go(user.profile.faceit_nickname);
                  }}
                >
                  <span className="side-ico">◈</span>
                  My stats
                </a>
              )}
              <a
                href="/settings"
                className={`side-link ${mode === "settings" ? "active" : ""}`}
                aria-current={mode === "settings" ? "page" : undefined}
                onClick={(e) => {
                  if (!isPlainClick(e)) return;
                  e.preventDefault();
                  setSideOpen(false);
                  pickNav("settings");
                }}
              >
                <span className="side-ico">⚙</span>
                Settings
              </a>
            </div>
          )}
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="side-group">{g.group}</div>
              {g.items.map((it) => (
                <a
                  key={it.id}
                  href={navHref(it.id)}
                  className={`side-link ${mode === it.id ? "active" : ""}`}
                  aria-current={mode === it.id ? "page" : undefined}
                  onClick={(e) => {
                    if (!isPlainClick(e)) return;   // ctrl/cmd-click opens a real tab
                    e.preventDefault();
                    pickNav(it.id);
                  }}
                >
                  {it.icon}
                  {it.label}
                </a>
              ))}
            </div>
          ))}
        </div>

        <div className="side-foot">
          <div className="side-contact-title">Contact</div>
          <a
            className="side-discord"
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            title="Join the FaceitLens Discord"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.6 1.25a18.3 18.3 0 0 0-5.5 0 12.6 12.6 0 0 0-.61-1.25.08.08 0 0 0-.08-.04c-1.7.3-3.33.81-4.89 1.52a.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.05 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.29 1.23-1.99a.08.08 0 0 0-.04-.11c-.65-.25-1.27-.55-1.87-.89a.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01 14.2 14.2 0 0 0 12.06 0 .07.07 0 0 1 .08 0l.37.3a.08.08 0 0 1-.01.13c-.6.35-1.22.64-1.87.89a.08.08 0 0 0-.04.11c.36.7.78 1.36 1.23 1.99a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6.01-3.03.08.08 0 0 0 .03-.05c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.21 0 2.18 1.09 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.22 0 2.18 1.09 2.16 2.42 0 1.34-.94 2.42-2.16 2.42Z"></path>
            </svg>
            Join our Discord
          </a>
          <a href="https://t.me/cristicor1" target="_blank" rel="noopener noreferrer" title="Telegram: @cristicor1">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M11.99 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.57 8.16-1.86 8.77c-.14.62-.5.77-1.02.48l-2.82-2.08-1.36 1.31c-.15.15-.28.28-.57.28l.2-2.87 5.23-4.72c.23-.2-.05-.32-.35-.12L8.36 13.5l-2.78-.87c-.6-.19-.62-.6.13-.9l10.86-4.18c.5-.18.94.12.78.9Z"></path>
            </svg>
            Telegram — @cristicor1
          </a>
          <a href="https://github.com/cristicoroama/FaceitLens" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
            GitHub — source
          </a>
          <a href="mailto:coroamamh@gmail.com" title="Email me">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 6 10 7L22 6" />
            </svg>
            Email
          </a>
          <a className="side-coffee" href="https://buymeacoffee.com/lordukiki" target="_blank" rel="noopener noreferrer" title="Support the project">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="m20.216 6.415-.132-.666c-.119-.598-.388-1.163-1.001-1.379-.197-.069-.42-.098-.57-.241-.152-.143-.196-.366-.231-.572-.065-.378-.125-.756-.192-1.133-.057-.325-.102-.69-.25-.987-.195-.4-.597-.634-.996-.788a5.723 5.723 0 0 0-.626-.194c-1-.263-2.05-.36-3.077-.416a25.834 25.834 0 0 0-3.7.062c-.915.083-1.88.184-2.75.5-.318.116-.646.256-.888.501-.297.302-.393.77-.177 1.146.154.267.415.456.692.58.36.162.737.284 1.123.366 1.075.238 2.189.331 3.287.37 1.218.05 2.437.01 3.65-.118.299-.033.598-.073.896-.119.352-.054.578-.513.474-.834-.124-.383-.457-.531-.834-.473-.466.074-.96.108-1.382.146-1.177.08-2.358.082-3.536.006a22.228 22.228 0 0 1-1.157-.107c-.086-.01-.18-.025-.258-.036-.243-.036-.484-.08-.724-.13-.111-.027-.111-.185 0-.212h.005c.277-.06.557-.108.838-.147h.002c.131-.009.263-.032.394-.048a25.076 25.076 0 0 1 3.426-.12c.674.019 1.347.067 2.017.144l.228.031c.267.04.533.088.798.145.392.085.895.113 1.07.542.055.137.08.288.111.431l.319 1.484a.237.237 0 0 1-.199.284h-.003c-.037.006-.075.01-.112.015a36.704 36.704 0 0 1-4.743.295 37.059 37.059 0 0 1-4.699-.304c-.14-.017-.293-.042-.417-.06-.326-.048-.649-.108-.973-.161-.393-.065-.768-.032-1.123.161-.29.16-.527.404-.675.701-.154.316-.199.66-.267 1-.069.34-.176.707-.135 1.056.087.753.613 1.365 1.37 1.502a39.69 39.69 0 0 0 11.343.376.483.483 0 0 1 .535.53l-.071.697-1.018 9.907c-.041.41-.047.832-.125 1.237-.122.637-.553 1.028-1.182 1.171-.577.131-1.165.2-1.756.205-.656.004-1.31-.025-1.966-.022-.699.004-1.556-.06-2.095-.58-.475-.458-.54-1.174-.605-1.793l-.731-7.013-.322-3.094c-.037-.351-.286-.695-.678-.678-.336.015-.718.3-.678.679l.228 2.185.949 9.112c.147 1.344 1.174 2.068 2.446 2.272.742.12 1.503.144 2.257.156.966.016 1.942.053 2.892-.122 1.408-.258 2.465-1.198 2.616-2.657.34-3.332.683-6.663 1.024-9.995l.215-2.087a.484.484 0 0 1 .39-.426c.402-.078.787-.212 1.074-.518.455-.488.546-1.124.385-1.766zm-1.478.772c-.145.137-.363.201-.578.233-2.416.359-4.866.54-7.308.46-1.748-.06-3.477-.254-5.207-.498-.17-.024-.353-.055-.47-.18-.22-.236-.111-.71-.054-.995.052-.26.152-.609.463-.646.484-.057 1.046.148 1.526.22.577.088 1.156.159 1.737.212 2.48.226 5.002.19 7.472-.14.45-.06.899-.13 1.345-.21.399-.072.84-.206 1.08.206.166.281.188.657.162.974a.544.544 0 0 1-.169.364z" />
            </svg>
            Buy me a coffee
          </a>
          <div className="side-note">Open-source CS2 stats tracker</div>
        </div>
      </aside>

      {/* ============ MAIN ============ */}
      <div className="main">
        <header className="topbar">
          <button className="tb-burger" onClick={() => setSideOpen(true)} title="Menu">☰</button>
          <div className="tb-search">
            <span className="tb-ic">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <SearchInput
              value={nickname}
              onChange={setNickname}
              onPick={go}
              onEnter={() => smartSearch(nickname)}
              placeholder="Find players: FACEIT nickname or Steam link…"
            />
          </div>
          <div className="tb-actions">
            <WhatsNewButton unread={changelog.unread} onClick={() => pickNav("whatsnew")} />
            <NewsButton onClick={() => pickNav("news")} active={!!incidentStatus?.system?.active} />
            <ThemeMenu theme={theme} setTheme={setTheme} />
            <AccountMenu
              user={user}
              onLogout={logout}
              onSettings={() => { setMode("settings"); navigate("/settings"); }}
              onMyProfile={(handle, faceitStats) => {
                if (faceitStats && user?.profile?.faceit_nickname) {
                  go(user.profile.faceit_nickname);
                } else {
                  setMode("publicprofile");
                  navigate(`/u/${handle}`);
                }
              }}
            />
          </div>
        </header>

        <div className="content">
          {/* ---------- HOME HERO ---------- */}
          {showHome && (
            <div className="home-hero">
              <h1 className="home-title">
                Scan any <em>CS2 player</em>
              </h1>
              <p className="home-sub">
                ELO, stats and match history for any FACEIT player — plus a trust
                score that tells you who you're really up against.
              </p>

              {cs2Online && (
                <div className="home-live">
                  <span className="home-live-dot" />
                  <b>{cs2Online.toLocaleString()}</b> players in CS2 right now
                </div>
              )}

              {/* One field. smartSearch() already recognises a Steam ID64 or a
                  steamcommunity.com link, so the old "search by Steam" checkbox
                  was asking the user to declare something we can just detect. */}
              <div className="home-search">
                <div className="search">
                  <SearchInput
                    value={nickname}
                    onChange={setNickname}
                    onPick={go}
                    onEnter={searchHome}
                    placeholder="FACEIT nickname, Steam ID or profile link"
                  />
                  <button onClick={searchHome} disabled={loading}>
                    {loading ? "..." : "Search"}
                  </button>
                </div>
              </div>

              {favs.length > 0 && (
                <div className="recent">
                  <div className="recent-label">⭐ Favorites</div>
                  <div className="recent-chips">
                    {favs.map((n) => (
                      <button key={n} className="recent-chip" onClick={() => go(n)}>{n}</button>
                    ))}
                  </div>
                </div>
              )}

              <div className="recent">
                <div className="recent-label">{recent.length > 0 ? "Recently searched" : "Try a pro"}</div>
                <div className="recent-chips">
                  {(recent.length > 0 ? recent.map((r) => r.nickname) : POPULAR_PROS).map((n) => (
                    <button key={n} className="recent-chip" onClick={() => go(n)}>{n}</button>
                  ))}
                </div>
              </div>

              <div className="home-section-label">Everything you can do</div>
              <div className="home-features">
                {HOME_FEATURES.map((f) => (
                  <button
                    key={f.title}
                    className="hf-card hf-clickable"
                    onClick={() => (f.nav ? pickNav(f.nav) : document.querySelector(".home-search input")?.focus())}
                  >
                    <div className="hf-ic">{f.icon}</div>
                    <div className="hf-title">{f.title}</div>
                    <div className="hf-desc">{f.desc}</div>
                    <div className="hf-go">{f.nav ? "Open →" : "Search a player →"}</div>
                  </button>
                ))}
              </div>

              <a
                className="home-discord"
                href={DISCORD_INVITE}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                  <path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.6 1.25a18.3 18.3 0 0 0-5.5 0 12.6 12.6 0 0 0-.61-1.25.08.08 0 0 0-.08-.04c-1.7.3-3.33.81-4.89 1.52a.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.05 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.29 1.23-1.99a.08.08 0 0 0-.04-.11c-.65-.25-1.27-.55-1.87-.89a.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01 14.2 14.2 0 0 0 12.06 0 .07.07 0 0 1 .08 0l.37.3a.08.08 0 0 1-.01.13c-.6.35-1.22.64-1.87.89a.08.08 0 0 0-.04.11c.36.7.78 1.36 1.23 1.99a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6.01-3.03.08.08 0 0 0 .03-.05c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.21 0 2.18 1.09 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.22 0 2.18 1.09 2.16 2.42 0 1.34-.94 2.42-2.16 2.42Z" />
                </svg>
                <div className="home-discord-text">
                  <b>Join the Discord</b>
                  <span>Find people to queue with, report bugs, hear about new features first</span>
                </div>
                <span className="home-discord-go">→</span>
              </a>
            </div>
          )}

          {/* ---------- TOOL PAGES ---------- */}
          {mode === "compare" && (
            <>
              <div className="section-title">Compare players <span className="section-count">up to 5</span></div>
              <div className="cmp-inputs">
                {compareInputs.map((v, i) => (
                  <div className="cmp-input-row" key={i}>
                    <input
                      type="text"
                      className="compare-input"
                      placeholder={`Player ${i + 1}`}
                      value={v}
                      onChange={(e) => setCompareAt(i, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && runCompare()}
                    />
                    {compareInputs.length > 2 && (
                      <button className="cmp-x" onClick={() => removeCompareSlot(i)} title="Remove">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <div className="cmp-actions">
                {compareInputs.length < 5 && (
                  <button className="act-btn" onClick={addCompareSlot}>+ Add player</button>
                )}
                <button className="btn-primary" onClick={runCompare} disabled={loading}>
                  {loading ? "..." : "Compare"}
                </button>
              </div>
            </>
          )}

          {mode === "squad" && (
            <>
              <div className="section-title">Squad</div>
              <div className="search">
                <input
                  type="text"
                  placeholder="Nicknames separated by commas (e.g. s1mple, ZywOo, NiKo)"
                  value={squadInput}
                  onChange={(e) => setSquadInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSquad()}
                />
                <button onClick={runSquad} disabled={loading}>
                  {loading ? "..." : "Search"}
                </button>
              </div>
            </>
          )}

          {mode === "leaderboard" && <Leaderboard onPick={go} />}
          {mode === "faceitstatus" && <FaceitStatus />}
          {mode === "steamstatus" && <SteamStatus />}
          {mode === "bans" && <FaceitBans onPick={go} />}
          {mode === "prosettings" && <ProSettings />}
          {mode === "matchroom" && <MatchRoom onPick={go} />}
          {mode === "clubs" && <Clubs onPick={go} />}
          {mode === "watchlist" && <Watchlist favs={favs} user={user} onPick={go} />}
          {mode === "games" && <Games />}
          {mode === "proguesser" && <ProGuesser />}
          {mode === "docs" && <ApiDocs />}
          {mode === "news" && <NewsPage data={incidentStatus} />}
          {mode === "whatsnew" && <WhatsNew />}
          {mode === "feedback" && <Feedback user={user} />}
          {mode === "privacy" && <PrivacyPolicy />}
          {mode === "terms" && <Terms />}
          {mode === "settings" && (
            <ProfileSettings
              user={user}
              onSaved={(p) => setUser((u) => (u ? { ...u, profile: p, name: p.name, avatar: p.avatar ? `${API_BASE}${p.avatar}` : u.steam_avatar } : u))}
              onOpenProfile={go}
            />
          )}
          {mode === "publicprofile" && (
            <PublicProfile
              handle={routeHandle}
              currentUser={user}
              onPick={go}
              onEdit={() => { setMode("settings"); navigate("/settings"); }}
            />
          )}

          {/* ---------- STATES ---------- */}
          {error && <div className="state error">{error}</div>}
          {loading && <Skeleton />}

          {/* ---------- RESULTS ---------- */}
          {!loading && squad && <Squad data={squad} />}

          {mode === "single" && !loading && steamProfile && (
            <SteamProfileView profile={steamProfile} />
          )}

          {!loading && comparePlayers && comparePlayers.length >= 2 && (
            <>
              <CompareView players={comparePlayers} onPick={go} />
              {(() => {
                const cs = comparePlayers
                  .map((p, i) => {
                    const d = eloData(p);
                    return d.length ? { name: p.nickname, color: i === 0 ? "var(--accent)" : i === 1 ? "var(--accent-2)" : ["#f59e0b", "#ef4444", "#a855f7"][i - 2], data: d } : null;
                  })
                  .filter(Boolean);
                return cs.length > 0 ? <EloChart series={cs} /> : null;
              })()}
            </>
          )}

          {showProfile && (
            <>
              <BanBanner bans={data.bans} />
              <PlayerHeader player={data}>
                <button className={`act-btn ${isFav ? "on" : ""}`} onClick={onToggleFav}>
                  {isFav ? "★ Favorited" : "☆ Favorite"}
                </button>
                <button className="act-btn" onClick={share}>
                  {copied ? "✓ Copied" : "🔗 Share"}
                </button>
                <button className="act-btn ai" onClick={runAnalysis} disabled={aiLoading}>
                  {aiLoading ? "Analyzing…" : "✨ AI Analysis"}
                </button>
                <button className="act-btn roast" onClick={runRoast} disabled={roastLoading}>
                  {roastLoading ? "Cooking…" : "🔥 Roast me"}
                </button>
                <button className="act-btn" onClick={() => setShowCard(true)}>
                  🖼️ Share card
                </button>
                <button className="act-btn wrapped-btn" onClick={() => setShowWrapped(true)}>
                  🎬 Wrapped
                </button>
                {data.form && <span className="form-badge">Last 10: {data.form}</span>}
              </PlayerHeader>

              {showCard && <ShareCard player={data} onClose={() => setShowCard(false)} />}
              {showWrapped && <Wrapped player={data} onClose={() => setShowWrapped(false)} />}

              {aiError && <div className="state error">{aiError}</div>}
              {aiText && (
                <div className="ai-panel">
                  <div className="ai-panel-head">✨ AI Scouting Report</div>
                  <div className="ai-panel-body">{aiText}</div>
                </div>
              )}

              {roastError && <div className="state error">{roastError}</div>}
              {roastText && (
                <div className="roast-panel">
                  <div className="roast-panel-head">
                    <span>🔥 Roasted</span>
                    <button className="roast-copy" onClick={copyRoast}>
                      {roastCopied ? "✓ Copied" : "Copy & share"}
                    </button>
                  </div>
                  <div className="roast-panel-body">{roastText}</div>
                </div>
              )}

              <div className="ptabs">
                {PROFILE_TABS.filter(([k]) => k !== "clips" || data.allstar_enabled).map(([key, label, icon]) => (
                  <button
                    key={key}
                    className={`ptab ${profileTab === key ? "active" : ""}`}
                    onClick={() => setProfileTab(key)}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>

              {profileTab === "account" ? (
                <AccountView nickname={data.nickname} />
              ) : profileTab === "leetify" ? (
                <LeetifyStats nickname={data.nickname} />
              ) : profileTab === "real" ? (
                <RealStats nickname={data.nickname} />
              ) : profileTab === "clips" ? (
                <Clips nickname={data.nickname} />
              ) : profileTab === "hltv" ? (
                <HltvStats hltv={data.hltv} />
              ) : profileTab === "teammates" ? (
                <TeammatesFull mates={data.teammates_full} onPick={go} />
              ) : profileTab === "hubs" ? (
                <Hubs hubs={data.hubs} />
              ) : profileTab === "met" ? (
                <HaveWeMet player={data.nickname} />
              ) : profileTab === "steam" ? (
                <SteamInfo steam={data.steam} />
              ) : profileTab === "nicknames" ? (
                <Nicknames nicknames={data.nicknames} />
              ) : (
                <>
                  <SmurfMeter data={data} leetifyBans={leetifyBans} />
                  <OverviewGrid
                    data={data}
                    maps={data.maps_played}
                    mapFilter={mapFilter}
                    onMapFilter={applyMapFilter}
                  />
                  {eloSeries.length > 0 && <EloChart series={eloSeries} />}
                  <EloProjector elo={data.elo} winRate={data.stats?.win_rate} />
                  <div className="duo">
                    <div><MapStats maps={data.map_stats} /></div>
                    <div><Activity activity={data.activity} /></div>
                  </div>
                  <div className="duo">
                    <div><BestTeammates mates={data.best_teammates} onPick={go} /></div>
                    <div><Nemeses nemeses={data.nemeses} onPick={go} /></div>
                  </div>
                  <MatchHistory matches={data.recent_matches} me={data.nickname} onPick={go} />
                </>
              )}
            </>
          )}

          <SiteFooter onNav={pickNav} />
        </div>
      </div>

      {/* Announce what's new — but not to someone who followed a shared link
          straight to a player, and not while they're already reading the
          page it would send them to. */}
      <WhatsNewPopup
        unread={changelog.unread}
        entries={changelog.entries}
        markSeen={changelog.markSeen}
        onOpenPage={() => pickNav("whatsnew")}
        suppressed={mode === "whatsnew" || !!routeNick || !!routeSteam || !!routeHandle}
      />
    </div>
  );
}
