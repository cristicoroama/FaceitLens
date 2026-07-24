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
import Crosshair from "./components/Crosshair.jsx";
import ProGuesser from "./components/ProGuesser.jsx";
import ApiDocs from "./components/ApiDocs.jsx";
import Clubs from "./components/Clubs.jsx";
import FaceitStatus from "./components/FaceitStatus.jsx";
import ProSettings from "./components/ProSettings.jsx";
import FaceitBans from "./components/FaceitBans.jsx";
import SteamStatus from "./components/SteamStatus.jsx";
import Leaderboard from "./components/Leaderboard.jsx";
import HltvView from "./components/HltvView.jsx";
import ThemeMenu from "./components/ThemeMenu.jsx";
import SteamProfileView from "./components/SteamProfileView.jsx";
import AccountMenu from "./components/AccountMenu.jsx";
import MatchRoom from "./components/MatchRoom.jsx";
import Watchlist from "./components/Watchlist.jsx";
import EloProjector from "./components/EloProjector.jsx";
import Nemeses from "./components/Nemeses.jsx";
import SmurfMeter from "./components/SmurfMeter.jsx";
import ShareCard from "./components/ShareCard.jsx";
import Wrapped from "./components/Wrapped.jsx";
import { getFavorites, toggleFavorite } from "./favorites.js";

const API_BASE = import.meta.env.VITE_API_URL || "";

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
  hltv: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 19V5M4 12h8M12 19V5M20 19V5M12 12h8" />
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
};

const NAV = [
  { group: "FACEIT", items: [
    { id: "single", label: "Player Search", icon: I.search },
    { id: "watchlist", label: "Watchlist", icon: I.star },
    { id: "leaderboard", label: "Leaderboard", icon: I.board },
  ]},
  { group: "HLTV — Pro Scene", items: [
    { id: "hltv", label: "HLTV Hub", icon: I.hltv },
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
    { id: "crosshair", label: "Crosshair", icon: I.xhair },
  ]},
  { group: "Developers", items: [
    { id: "docs", label: "API Docs", icon: I.vs },
  ]},
];

/* profile tab icons (inline, stroke) */
const TI = {
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
      <path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
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

/* tool pages that get their own shareable URL (/docs, /proguesser, …) */
const TOOL_PAGES = new Set([
  "watchlist", "leaderboard", "hltv", "matchroom", "compare",
  "squad", "clubs", "proguesser", "games", "crosshair", "docs",
  "faceitstatus", "prosettings", "bans", "steamstatus",
]);

const PROFILE_TABS = [
  ["overview", "Overview", TI.overview],
  ["account", "Trust", TI.trust],
  ["leetify", "Leetify", TI.leetify],
  ["real", "Demos", TI.real],
  ["hltv", "HLTV", TI.hltv],
  ["teammates", "Teammates", TI.teammates],
  ["steam", "Steam", TI.steam],
  ["hubs", "Hubs", TI.hubs],
  ["met", "Have We Met?", TI.met],
  ["nicknames", "Nicknames", TI.nicknames],
];

export default function App() {
  const { nickname: routeNick, steamid: routeSteam, page: routePage } = useParams();
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
  const [copied, setCopied] = useState(false);
  const [bySteam, setBySteam] = useState(false);
  const [steamInput, setSteamInput] = useState("");
  const [mapFilter, setMapFilter] = useState(null);
  const [profileTab, setProfileTab] = useState("overview");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [roastText, setRoastText] = useState("");
  const [roastLoading, setRoastLoading] = useState(false);
  const [roastError, setRoastError] = useState("");
  const [roastCopied, setRoastCopied] = useState(false);
  const [discordCopied, setDiscordCopied] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [showWrapped, setShowWrapped] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("faceitlens_theme");
    // migrate the old two-value toggle to the new named themes
    if (saved === "light") return "light";
    return saved || "dark";
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

  async function logout() {
    try {
      await fetch(`${API_BASE}/api/auth/logout/`, { method: "POST", credentials: "include" });
    } catch { /* ignore */ }
    setUser(null);
    setFavs(getFavorites());
  }

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

  // Tool pages have their own URLs (/docs, /proguesser, /hltv…) so they're
  // directly shareable. Map the path segment to the internal mode.
  useEffect(() => {
    if (routePage && TOOL_PAGES.has(routePage)) setMode(routePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePage]);

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
    if (bySteam) {
      smartSearch(steamInput, { steamOnly: true });
      return;
    }
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
          <div className="logo">◎</div>
          Faceit<span>Lens</span>
        </div>

        <div className="side-nav">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="side-group">{g.group}</div>
              {g.items.map((it) => (
                <button
                  key={it.id}
                  className={`side-link ${mode === it.id ? "active" : ""}`}
                  onClick={() => pickNav(it.id)}
                >
                  {it.icon}
                  {it.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="side-foot">
          <div className="side-contact-title">Contact</div>
          <button
            type="button"
            className="side-contact-btn"
            onClick={() => {
              navigator.clipboard.writeText("cristicoroama").then(() => {
                setDiscordCopied(true);
                setTimeout(() => setDiscordCopied(false), 1600);
              });
            }}
            title="Copy Discord username"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.6 1.25a18.3 18.3 0 0 0-5.5 0 12.6 12.6 0 0 0-.61-1.25.08.08 0 0 0-.08-.04c-1.7.3-3.33.81-4.89 1.52a.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.05 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.29 1.23-1.99a.08.08 0 0 0-.04-.11c-.65-.25-1.27-.55-1.87-.89a.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01 14.2 14.2 0 0 0 12.06 0 .07.07 0 0 1 .08 0l.37.3a.08.08 0 0 1-.01.13c-.6.35-1.22.64-1.87.89a.08.08 0 0 0-.04.11c.36.7.78 1.36 1.23 1.99a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6.01-3.03.08.08 0 0 0 .03-.05c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.21 0 2.18 1.09 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.22 0 2.18 1.09 2.16 2.42 0 1.34-.94 2.42-2.16 2.42Z"></path>
            </svg>
            {discordCopied ? "Copied!" : "Discord — cristicoroama"}
          </button>
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
            <ThemeMenu theme={theme} setTheme={setTheme} />
            <AccountMenu user={user} onLogout={logout} />
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
                FACEIT stats, account trust score, Leetify demo data, medals &amp;
                inventory — every signal on one page.
              </p>

              <div className="home-search">
                <div className="search">
                  {bySteam ? (
                    <input
                      type="text"
                      placeholder="Steam ID64 or steamcommunity.com/profiles/ link"
                      value={steamInput}
                      onChange={(e) => setSteamInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && searchHome()}
                    />
                  ) : (
                    <SearchInput
                      value={nickname}
                      onChange={setNickname}
                      onPick={go}
                      onEnter={searchHome}
                      placeholder="FACEIT nickname (e.g. s1mple)"
                    />
                  )}
                  <button onClick={searchHome} disabled={loading}>
                    {loading ? "..." : "Search"}
                  </button>
                </div>
                <label className="steam-toggle">
                  <input type="checkbox" checked={bySteam} onChange={(e) => setBySteam(e.target.checked)} />
                  Search by Steam ID / profile link
                </label>
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

              <div className="home-features">
                <div className="hf-card">
                  <div className="hf-ic">◈</div>
                  <div className="hf-title">Account Trust Score</div>
                  <div className="hf-desc">
                    Steam age, hours, level, bans and inventory combined into one
                    legit-o-meter — spot smurfs and throwaways instantly.
                  </div>
                </div>
                <div className="hf-card">
                  <div className="hf-ic">⌖</div>
                  <div className="hf-title">Demo-based stats</div>
                  <div className="hf-desc">
                    Premier rating, aim &amp; utility ratings, preaim, reaction time
                    — data provided by Leetify, no setup needed.
                  </div>
                </div>
                <div className="hf-card">
                  <div className="hf-ic">⇄</div>
                  <div className="hf-title">Compare &amp; Squad</div>
                  <div className="hf-desc">
                    1v1 side-by-side breakdowns, squad win rates together, best
                    teammates and "have we met?" lookups.
                  </div>
                </div>
              </div>
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
          {mode === "hltv" && <HltvView onPick={go} />}
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
          {mode === "crosshair" && <Crosshair />}

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
                {PROFILE_TABS.map(([key, label, icon]) => (
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
                  <SmurfMeter data={data} />
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
        </div>
      </div>
    </div>
  );
}
