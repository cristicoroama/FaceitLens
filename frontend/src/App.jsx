import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { PAGE_META, DEFAULT_TITLE, DEFAULT_DESC, SITE_URL, TOOL_PAGES } from "./page-meta.js";
import PlayerHeader from "./components/PlayerHeader.jsx";
import MatchHistory from "./components/MatchHistory.jsx";
import SkillRatings from "./components/SkillRatings.jsx";
import StatPanels from "./components/StatPanels.jsx";
import MapHighlights from "./components/MapHighlights.jsx";
import ProfileTools from "./components/ProfileTools.jsx";
import EloChart from "./components/EloChart.jsx";
import CompareView from "./components/CompareView.jsx";
import MapStats from "./components/MapStats.jsx";
import Squad from "./components/Squad.jsx";
import Skeleton from "./components/Skeleton.jsx";
import BanBanner from "./components/BanBanner.jsx";
import SearchInput from "./components/SearchInput.jsx";
import BestTeammates from "./components/BestTeammates.jsx";
import HltvStats from "./components/HltvStats.jsx";
import Clips from "./components/Clips.jsx";
import AccountView from "./components/AccountView.jsx";
import LeetifyStats from "./components/LeetifyStats.jsx";
import Activity from "./components/Activity.jsx";
import TeammatesFull from "./components/TeammatesFull.jsx";
import SteamInfo from "./components/SteamInfo.jsx";
import Nicknames from "./components/Nicknames.jsx";
import HaveWeMet from "./components/HaveWeMet.jsx";
import OverviewGrid from "./components/OverviewGrid.jsx";
import Games from "./components/Games.jsx";
import ProGuesser from "./components/ProGuesser.jsx";
import ApiDocs from "./components/ApiDocs.jsx";
import NewsPage from "./components/NewsPage.jsx";
import Hubs from "./components/Hubs.jsx";
import Teams from "./components/Teams.jsx";
import Competitions from "./components/Competitions.jsx";
import FaceitStatus from "./components/FaceitStatus.jsx";
import ProSettings from "./components/ProSettings.jsx";
import FaceitBans from "./components/FaceitBans.jsx";
import SteamStatus from "./components/SteamStatus.jsx";
import Leaderboard from "./components/Leaderboard.jsx";
import WorldMap from "./components/WorldMap.jsx";
import SteamProfileView from "./components/SteamProfileView.jsx";
import AccountMenu from "./components/AccountMenu.jsx";
import NewsButton from "./components/NewsButton.jsx";
import MatchRoom from "./components/MatchRoom.jsx";
import Watchlist from "./components/Watchlist.jsx";
import EloProjector from "./components/EloProjector.jsx";
import Nemeses from "./components/Nemeses.jsx";
import ShareCard from "./components/ShareCard.jsx";
import Wrapped from "./components/Wrapped.jsx";
import ProfileSettings from "./components/ProfileSettings.jsx";
import PublicProfile from "./components/PublicProfile.jsx";
import Feedback from "./components/Feedback.jsx";
import { AdBanner, AdInline } from "./components/AdSlot.jsx";
import WhatsNew, {
  useChangelog, WhatsNewPopup, WhatsNewButton,
} from "./components/WhatsNew.jsx";
import TopNav from "./components/TopNav.jsx";
import SiteFooter from "./components/SiteFooter.jsx";
import { PrivacyPolicy, Terms } from "./components/Legal.jsx";
import Faq from "./components/Faq.jsx";
import NotFound from "./components/NotFound.jsx";
import { getFavorites, toggleFavorite } from "./favorites.js";
import { DISCORD_INVITE } from "./links.js";
import { Icon } from "./icons.jsx";

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


/* Top-bar navigation. An entry with `items` is a dropdown; one without is a
   flat link. "Player Search" isn't here on purpose — it IS the home page, and
   the brand already goes there.

   Six sidebar groups collapse to four menus: Developers and About held one
   and two entries, which never justified their own heading. */
const NAV = [
  // Flat link in the bar (no icon needed next to the dropdown triggers), but
  // the mobile drawer lists it beside iconed entries, so it carries one.
  { label: "Leaderboards", items: [
    { id: "leaderboard", label: "Europe", href: "/leaderboard/EU", icon: Icon.trophy,
      hint: "The biggest ladder on FACEIT" },
    { id: "leaderboard:NA", label: "North America", href: "/leaderboard/NA", icon: Icon.trophy },
    { id: "leaderboard:SA", label: "South America", href: "/leaderboard/SA", icon: Icon.trophy },
    { id: "leaderboard:SEA", label: "Southeast Asia", href: "/leaderboard/SEA", icon: Icon.trophy },
    { id: "leaderboard:OCE", label: "Oceania", href: "/leaderboard/OCE", icon: Icon.trophy },
    { id: "leaderboard:map", label: "World Map", href: "/leaderboard/map", icon: Icon.globe,
      hint: "Which countries the top players come from" },
  ]},
  { label: "Tools", items: [
    { id: "matchroom", label: "Match Room", href: "/matchroom", icon: Icon.binoculars,
      hint: "Scout all 10 players in a lobby" },
    { id: "compare", label: "Compare", href: "/compare", icon: Icon.arrowLeftRight,
      hint: "Up to 5 players, head to head" },
    { id: "squad", label: "Squad", href: "/squad", icon: Icon.people,
      hint: "Look up your whole team at once" },
    { id: "hubs", label: "Hubs", href: "/hubs", icon: Icon.diagram3,
      hint: "Find a community and see who plays there" },
    { id: "teams", label: "Teams", href: "/teams", icon: Icon.people,
      hint: "Rosters and records — NAVI, FaZe, anyone" },
    { id: "competitions", label: "Competitions", href: "/competitions", icon: Icon.trophy,
      hint: "Championships, tournaments and brackets" },
    { id: "watchlist", label: "Watchlist", href: "/watchlist", icon: Icon.star,
      hint: "Track players you care about" },
  ]},
  { label: "Live", items: [
    { id: "faceitstatus", label: "FACEIT Status", href: "/faceitstatus", icon: Icon.activity,
      hint: "Is FACEIT down right now?" },
    { id: "steamstatus", label: "Steam / CS2 Status", href: "/steamstatus", icon: Icon.activity,
      hint: "Steam and CS2 servers, live" },
    { id: "bans", label: "Recent Bans", href: "/bans", icon: Icon.slashCircle,
      hint: "Who just got banned" },
  ]},
  { label: "Pros", items: [
    { id: "prosettings", label: "Pro Settings", href: "/prosettings", icon: Icon.crosshair,
      hint: "Crosshairs, sens and gear for 180+ pros" },
    { id: "proguesser", label: "ProGuesser", href: "/proguesser", icon: Icon.star,
      hint: "Daily guess-the-pro game" },
    { id: "games", label: "Minigames", href: "/games", icon: Icon.controller,
      hint: "CS2 quizzes and trivia" },
  ]},
  { label: "More", items: [
    { id: "docs", label: "API Docs", href: "/docs", icon: Icon.codeSlash,
      hint: "Free REST API" },
    { id: "whatsnew", label: "What's New", href: "/whatsnew", icon: Icon.star,
      hint: "Changelog" },
    { id: "faq", label: "FAQ", href: "/faq", icon: Icon.patchCheckFill,
      hint: "How the numbers actually work" },
    { id: "feedback", label: "Feedback", href: "/feedback", icon: Icon.chatDots,
      hint: "Report a bug, request a feature" },
  ],
    /* Actions, not reference links — in the footer nobody would press them. */
    tail: [
      { label: "Join our Discord", href: DISCORD_INVITE, cls: "tn-discord",
        icon: (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.6 1.25a18.3 18.3 0 0 0-5.5 0 12.6 12.6 0 0 0-.61-1.25.08.08 0 0 0-.08-.04c-1.7.3-3.33.81-4.89 1.52a.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.05 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.29 1.23-1.99a.08.08 0 0 0-.04-.11c-.65-.25-1.27-.55-1.87-.89a.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01 14.2 14.2 0 0 0 12.06 0 .07.07 0 0 1 .08 0l.37.3a.08.08 0 0 1-.01.13c-.6.35-1.22.64-1.87.89a.08.08 0 0 0-.04.11c.36.7.78 1.36 1.23 1.99a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6.01-3.03.08.08 0 0 0 .03-.05c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.21 0 2.18 1.09 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.22 0 2.18 1.09 2.16 2.42 0 1.34-.94 2.42-2.16 2.42Z" />
          </svg>
        ) },
      { label: "Buy me a coffee", href: "https://buymeacoffee.com/lordukiki", cls: "tn-coffee",
        icon: (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 8h1a3 3 0 0 1 0 6h-1M3 8h14v7a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8ZM6 2v2M10 2v2M14 2v2" />
          </svg>
        ) },
    ],
  },
];


/* popular pros shown on the home page when there's no search history */



/* flagship features showcased on the home page. nav = tool page id (clickable),
   no nav = feature lives inside a player profile → focus the search box. */
const HOME_FEATURES = [
  { icon: Icon.shieldCheck, title: "Account Trust Score", nav: null,
    desc: "Steam age, hours, level, bans and inventory in one legit-o-meter. Spot throwaways instantly." },
  { icon: Icon.people, title: "Match Room Analyzer", nav: "matchroom",
    desc: "Paste a FACEIT room link and scout all 10 players + an ELO win prediction." },
  { icon: Icon.sliders, title: "Pro Settings", nav: "prosettings",
    desc: "Sensitivity, DPI, eDPI, resolution and full gear for 180+ CS2 pros." },
  { icon: Icon.controller, title: "ProGuesser", nav: "proguesser",
    desc: "Guess the mystery CS pro of the day — a daily Wordle for Counter-Strike." },
  { icon: Icon.broadcastPin, title: "Live Status", nav: "faceitstatus",
    desc: "Is FACEIT or CS2 matchmaking down? Live platform status and recent bans." },
];

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


/** Swap the document title, meta description and canonical for the current view. */
function applyMeta(title, desc, robots = "index, follow") {
  document.title = title;
  const set = (name, content) => {
    let tag = document.querySelector(`meta[name="${name}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", name);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", content);
  };
  const setProp = (property, content) => {
    let tag = document.querySelector(`meta[property="${property}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("property", property);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", content);
  };

  set("description", desc);
  // A static SPA always answers 200, so an unknown path would otherwise be
  // indexed as a real page. This is what keeps soft 404s out of search.
  set("robots", robots);

  // The canonical has to move with the route. It used to be hardcoded to the
  // homepage in index.html, which told Google every single page here — every
  // player profile, every tool page — was really just "/". Google obliged and
  // indexed none of them.
  //
  // A page we've asked not to be indexed gets no canonical: pointing at itself
  // while saying "noindex" is a contradiction, and pointing anywhere else
  // would hand its signals to a page that didn't earn them.
  const canonical = robots.includes("noindex")
    ? null
    : SITE_URL + window.location.pathname.replace(/\/+$/, "").replace(/^$/, "/");

  let link = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", canonical);
    setProp("og:url", canonical);
  } else if (link) {
    link.remove();
  }

  // Link previews (Discord, WhatsApp, Twitter) read og:*, not the plain meta
  // tags — without this they showed the homepage blurb for every page.
  setProp("og:title", title);
  setProp("og:description", desc);
}

const PROFILE_TABS = [
  ["overview", "Overview", Icon.grid1x2],
  ["account", "Trust", Icon.shieldCheck],
  ["leetify", "Leetify", Icon.graphUpArrow],
  ["clips", "Clips", Icon.playBtn],
  ["hltv", "HLTV Stats", Icon.barChartLine],
  ["teammates", "Teammates", Icon.people],
  ["steam", "Steam", Icon.steam],
  ["met", "Have We Met?", Icon.personCheck],
  ["nicknames", "Nicknames", Icon.tags],
];

export default function App() {
  const {
    nickname: routeNick, steamid: routeSteam, page: routePage,
    handle: routeHandle, region: routeRegion,
  } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
  const changelog = useChangelog();

  // The site is dark-only, so there is no theme state and no [data-theme]
  // attribute — index.css :root is the theme. This clears the key left behind
  // by the old switcher so a stale "light" can't linger in anyone's browser.
  useEffect(() => {
    try {
      localStorage.removeItem("faceitlens_theme");
    } catch { /* private mode — nothing to clean up */ }
  }, []);

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
    if (!routePage) return;
    // Unknown segment: show a 404 rather than silently rendering the home
    // page at someone else's URL.
    setMode(TOOL_PAGES.has(routePage) ? routePage : "notfound");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePage]);

  // /leaderboard/<region> is a real, shareable URL per ladder, and
  // /leaderboard/map is the world map over the same data.
  useEffect(() => {
    if (routeRegion) {
      setMode(routeRegion.toLowerCase() === "map" ? "worldmap" : "leaderboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeRegion]);

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
        `${data.nickname} — FACEIT CS2 Stats, ELO & Trust Score | Faceit-Lens`,
        `FACEIT CS2 stats for ${data.nickname}:${lvl}${elo}, win rate, K/D, map performance, match history and an account trust score to spot smurfing.`,
      );
      return;
    }
    if (steamProfile) {
      const name = steamProfile.persona || steamProfile.faceit_nickname || "Steam player";
      applyMeta(
        `${name} — Steam & CS2 Account Check | Faceit-Lens`,
        `Steam account overview for ${name}: CS2 hours, inventory value, bans, profile age and account trust signals.`,
      );
      return;
    }
    if (mode === "notfound") {
      applyMeta("Page not found | Faceit-Lens",
        "That page doesn't exist. Search for a CS2 player instead.", "noindex, follow");
      return;
    }
    const meta = PAGE_META[mode];
    applyMeta(meta ? `${meta[0]} | Faceit-Lens` : DEFAULT_TITLE, meta ? meta[1] : DEFAULT_DESC);
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
    setError("");
    if (id === "single") {
      setMode("single");
      navigate("/");
      return;
    }
    // "leaderboard:NA" — one nav entry per ladder, all rendering the same page
    // at its own URL so each region can be linked and indexed separately.
    const [page, arg] = id.split(":");
    if (page === "leaderboard") {
      const seg = arg || "EU";
      setMode(seg === "map" ? "worldmap" : "leaderboard");
      navigate(`/leaderboard/${seg}`);
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
      <TopNav
        groups={NAV}
        mode={mode}
        onNav={pickNav}
        brandHref="/"
        onBrand={() => { setMode("single"); navigate("/"); }}
        search={
          <>
            <span className="tn-search-ic">{Icon.search}</span>
            <SearchInput
              value={nickname}
              onChange={setNickname}
              onPick={go}
              onEnter={() => smartSearch(nickname)}
              placeholder="Search player…"
            />
          </>
        }
        /* Hidden from the bar under 860px — the drawer carries them there. */
        extras={
          <>
            <a className="tn-drawer-item" href="/news"
               onClick={(e) => { e.preventDefault(); pickNav("news"); }}>
              Status &amp; News
            </a>
            <a className="tn-drawer-item" href="/whatsnew"
               onClick={(e) => { e.preventDefault(); pickNav("whatsnew"); }}>
              What&apos;s New{changelog.unread ? " •" : ""}
            </a>
          </>
        }
        actions={
          <>
            <WhatsNewButton unread={changelog.unread} onClick={() => pickNav("whatsnew")} />
            <NewsButton onClick={() => pickNav("news")} active={!!incidentStatus?.system?.active} />
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
          </>
        }
      />

      {/* ============ MAIN ============ */}
      {/* The hero art is painted by .main, not by .home-hero — see index.css.
          It needs a full-width block to size against, and .home-hero sits
          inside the 1120px content column. */}
      <div className={`main ${showHome ? "is-home" : ""}`}>

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
                  <div className="recent-label">{Icon.star} Favorites</div>
                  <div className="recent-chips">
                    {favs.map((n) => (
                      <button key={n} className="recent-chip" onClick={() => go(n)}>{n}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Only the visitor's own recent searches. The "Try a pro"
                  fallback that filled this space on a first visit is gone. */}
              {recent.length > 0 && (
                <div className="recent">
                  <div className="recent-label">Recently searched</div>
                  <div className="recent-chips">
                    {recent.map((r) => (
                      <button key={r.nickname} className="recent-chip" onClick={() => go(r.nickname)}>
                        {r.nickname}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <AdBanner />

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

          {mode === "leaderboard" && (
            <Leaderboard
              onPick={go}
              initialRegion={routeRegion}
              initialCountry={searchParams.get("country") || ""}
            />
          )}
          {mode === "worldmap" && (
            <WorldMap
              onPick={go}
              // Clicking a country drops into the ladder it was counted in,
              // already filtered — the map answers "who", the list answers
              // "which players".
              onCountry={(c) => navigate(`/leaderboard/${c.region}?country=${c.country}`)}
            />
          )}
          {mode === "faceitstatus" && <FaceitStatus />}
          {mode === "steamstatus" && <SteamStatus />}
          {mode === "bans" && <FaceitBans onPick={go} />}
          {mode === "prosettings" && <ProSettings />}
          {mode === "matchroom" && <MatchRoom onPick={go} />}
          {mode === "hubs" && <Hubs onPick={go} />}
          {mode === "teams" && <Teams onPick={go} />}
          {mode === "competitions" && <Competitions onPick={go} />}
          {mode === "watchlist" && <Watchlist favs={favs} user={user} onPick={go} />}
          {mode === "games" && <Games />}
          {mode === "proguesser" && <ProGuesser />}
          {mode === "docs" && <ApiDocs />}
          {mode === "news" && <NewsPage data={incidentStatus} />}
          {mode === "whatsnew" && <WhatsNew />}
          {mode === "feedback" && <Feedback user={user} />}
          {mode === "notfound" && (
            <NotFound
              nickname={nickname}
              setNickname={setNickname}
              onSearch={searchHome}
              onPick={go}
              onNav={pickNav}
            />
          )}
          {mode === "faq" && <Faq />}
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
                  {isFav ? Icon.starFill : Icon.star}
                  {isFav ? "Favorited" : "Favorite"}
                </button>
                <button className="act-btn" onClick={share}>
                  {copied ? Icon.checkLg : Icon.link45deg}
                  {copied ? "Copied" : "Share"}
                </button>
                <ProfileTools
                  onAnalyze={runAnalysis}
                  aiLoading={aiLoading}
                  onRoast={runRoast}
                  roastLoading={roastLoading}
                  onShareCard={() => setShowCard(true)}
                  onWrapped={() => setShowWrapped(true)}
                />
                {data.form && <span className="form-badge">Last 10: {data.form}</span>}
              </PlayerHeader>

              {showCard && <ShareCard player={data} onClose={() => setShowCard(false)} />}
              {showWrapped && <Wrapped player={data} onClose={() => setShowWrapped(false)} />}

              {aiError && <div className="state error">{aiError}</div>}
              {aiText && (
                <div className="ai-panel">
                  <div className="ai-panel-head">{Icon.stars} AI Scouting Report</div>
                  <div className="ai-panel-body">{aiText}</div>
                </div>
              )}

              {roastError && <div className="state error">{roastError}</div>}
              {roastText && (
                <div className="roast-panel">
                  <div className="roast-panel-head">
                    <span>{Icon.fire} Roasted</span>
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

              {/* Above the tab content, so it sits in one fixed place on every
                  tab instead of appearing at a different scroll depth per tab. */}
              <AdInline />

              {profileTab === "account" ? (
                <AccountView nickname={data.nickname} />
              ) : profileTab === "leetify" ? (
                <LeetifyStats nickname={data.nickname} />
              ) : profileTab === "clips" ? (
                <Clips nickname={data.nickname} />
              ) : profileTab === "hltv" ? (
                <HltvStats hltv={data.hltv} />
              ) : profileTab === "teammates" ? (
                <TeammatesFull mates={data.teammates_full} onPick={go} />
              ) : profileTab === "met" ? (
                <HaveWeMet player={data.nickname} />
              ) : profileTab === "steam" ? (
                <SteamInfo steam={data.steam} />
              ) : profileTab === "nicknames" ? (
                <Nicknames nicknames={data.nicknames} />
              ) : (
                <>
                  <OverviewGrid
                    data={data}
                    maps={data.maps_played}
                    mapFilter={mapFilter}
                    onMapFilter={applyMapFilter}
                  />
                  {/* Best/weakest sits above the skill bars: which map to pick
                      is the question people came to answer, and it needs no
                      explanation of how it was scored. */}
                  <MapHighlights maps={data.map_stats} />
                  <SkillRatings skills={data.skills} />
                  {/* Directly under the ratings: these are the numbers those
                      bars were scored from, so a rating you disagree with can
                      be checked rather than just disbelieved. */}
                  <StatPanels stats={data.stats} />
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
