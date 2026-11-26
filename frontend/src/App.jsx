import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { PAGE_META, DEFAULT_TITLE, DEFAULT_DESC, SITE_URL, TOOL_PAGES } from "./page-meta.js";
import { leaderboardRegionMeta } from "../lib/leaderboard-meta.js";
import { ALL_LOCALES, DEFAULT_LOCALE, HERO, localePath, makeT, metaFor } from "./i18n.js";
import { getJson, isAbort, primeCache, API_BASE } from "./api.js";
import PlayerHeader from "./components/PlayerHeader.jsx";
import OverviewGrid from "./components/OverviewGrid.jsx";
import SkillRatings from "./components/SkillRatings.jsx";
import StatPanels from "./components/StatPanels.jsx";
import EloProjector from "./components/EloProjector.jsx";
import PlayerTeams from "./components/PlayerTeams.jsx";
import Insights, { InsightsTeaser } from "./components/Insights.jsx";
import Activity from "./components/Activity.jsx";
import BanStatus from "./components/BanStatus.jsx";
import ProfileTools from "./components/ProfileTools.jsx";
import AiReport from "./components/AiReport.jsx";
import Skeleton, { ProfileSkeleton } from "./components/Skeleton.jsx";
import BanBanner from "./components/BanBanner.jsx";
import ProfileSidebar from "./components/ProfileSidebar.jsx";
import ProfileTabs from "./components/ProfileTabs.jsx";
import SearchInput from "./components/SearchInput.jsx";
import MiniHeader from "./components/MiniHeader.jsx";
import ToolAbout from "./components/ToolAbout.jsx";
import AccountMenu from "./components/AccountMenu.jsx";
import NotificationBell from "./components/NotificationBell.jsx";
import { AdBanner, AdInline } from "./components/AdSlot.jsx";
import WhatsNew, { useChangelog, WhatsNewPopup } from "./components/WhatsNew.jsx";
import TopNav from "./components/TopNav.jsx";
import SiteFooter from "./components/SiteFooter.jsx";
import SocialDock, { CoffeeIcon } from "./components/SocialDock.jsx";
import NotFound, { PlayerNotFound } from "./components/NotFound.jsx";
import { getFavorites, toggleFavorite } from "./favorites.js";
import { DISCORD_INVITE, COFFEE_URL } from "./links.js";
import { DiscordIcon } from "./components/BrandIcons.jsx";
import { Icon } from "./icons.jsx";
import { isPlainClick, stripLocalePath, SHORTCUT_LABEL, IS_MAC } from "./shell-utils.js";

const named = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));

const MatchHistory = lazy(() => import("./components/MatchHistory.jsx"));
const AllMatches = lazy(() => import("./components/AllMatches.jsx"));
const MapHighlights = lazy(() => import("./components/MapHighlights.jsx"));
const MapStats = lazy(() => import("./components/MapStats.jsx"));
const Highlights = lazy(() => import("./components/Highlights.jsx"));
const PlayerHubs = lazy(() => import("./components/PlayerHubs.jsx"));
const EloChart = lazy(() => import("./components/EloChart.jsx"));
const CompareView = lazy(() => import("./components/CompareView.jsx"));
const ProfileCompare = lazy(() => import("./components/ProfileCompare.jsx"));
const Squad = lazy(() => import("./components/Squad.jsx"));
const BestTeammates = lazy(() => import("./components/BestTeammates.jsx"));
const HltvStats = lazy(() => import("./components/HltvStats.jsx"));
const Clips = lazy(() => import("./components/Clips.jsx"));
const AccountView = lazy(() => import("./components/AccountView.jsx"));
const LeetifyStats = lazy(() => import("./components/LeetifyStats.jsx"));
const CsrepStats = lazy(() => import("./components/CsrepStats.jsx"));
const TeammatesFull = lazy(() => import("./components/TeammatesFull.jsx"));
const SteamInfo = lazy(() => import("./components/SteamInfo.jsx"));
const Nicknames = lazy(() => import("./components/Nicknames.jsx"));
const HaveWeMet = lazy(() => import("./components/HaveWeMet.jsx"));
const CsgoOverview = lazy(() => import("./components/CsgoOverview.jsx"));
const Nemeses = lazy(() => import("./components/Nemeses.jsx"));
const Analysis = lazy(() => import("./components/Analysis.jsx"));
const Games = lazy(() => import("./components/Games.jsx"));
const ProGuesser = lazy(() => import("./components/ProGuesser.jsx"));
const ApiDocs = lazy(() => import("./components/ApiDocs.jsx"));
const NewsPage = lazy(() => import("./components/NewsPage.jsx"));
const Hubs = lazy(() => import("./components/Hubs.jsx"));
const Teams = lazy(() => import("./components/Teams.jsx"));
const Competitions = lazy(() => import("./components/Competitions.jsx"));
const Pickem = lazy(() => import("./components/Pickem.jsx"));
const DiscordBot = lazy(() => import("./components/DiscordBot.jsx"));
const SmurfChecker = named(() => import("./components/SeoTools.jsx"), "SmurfChecker");
const EloChecker = named(() => import("./components/SeoTools.jsx"), "EloChecker");
const FaceitLevels = named(() => import("./components/SeoTools.jsx"), "FaceitLevels");
const CommandPalette = lazy(() => import("./components/CommandPalette.jsx"));
const FaceitStatus = lazy(() => import("./components/FaceitStatus.jsx"));
const ProSettings = lazy(() => import("./components/ProSettings.jsx"));
const FaceitBans = lazy(() => import("./components/FaceitBans.jsx"));
const SteamStatus = lazy(() => import("./components/SteamStatus.jsx"));
const Leaderboard = lazy(() => import("./components/Leaderboard.jsx"));
const WorldMap = lazy(() => import("./components/WorldMap.jsx"));
const SteamProfileView = lazy(() => import("./components/SteamProfileView.jsx"));
const MatchRoom = lazy(() => import("./components/MatchRoom.jsx"));
const Watchlist = lazy(() => import("./components/Watchlist.jsx"));
const ShareCard = lazy(() => import("./components/ShareCard.jsx"));
const Wrapped = lazy(() => import("./components/Wrapped.jsx"));
const ProfileSettings = lazy(() => import("./components/ProfileSettings.jsx"));
const PublicProfile = lazy(() => import("./components/PublicProfile.jsx"));
const Feedback = lazy(() => import("./components/Feedback.jsx"));
const OverlaySettings = lazy(() => import("./components/OverlaySettings.jsx"));
const PrivacyPolicy = named(() => import("./components/Legal.jsx"), "PrivacyPolicy");
const Terms = named(() => import("./components/Legal.jsx"), "Terms");
const Faq = lazy(() => import("./components/Faq.jsx"));
const Support = lazy(() => import("./components/Support.jsx"));

const lobbyModules = import.meta.glob("./components/LobbyCheck.jsx");
const lobbyLoader = lobbyModules["./components/LobbyCheck.jsx"];
const LobbyCheck = lobbyLoader ? lazy(lobbyLoader) : null;
const LOBBY_PAGE = "lobby-check";
const Community = lazy(() => import("./components/Community.jsx"));
const ProHigherLower = lazy(() => import("./components/ProHigherLower.jsx"));
const DemoCoach = lazy(() => import("./components/DemoCoach.jsx"));
const DemoTrends = lazy(() => import("./components/DemoTrends.jsx"));
const BannedOpponents = lazy(() => import("./components/BannedOpponents.jsx"));
const Goals = lazy(() => import("./components/Goals.jsx"));

const PLAYER_NOT_FOUND = "Player not found.";

function looksLikeSteam(input) {
  return /7656\d{13}/.test(input) || /steamcommunity\.com/i.test(input);
}

function playerPath(nick) {
  return `/api/player/${encodeURIComponent(nick)}/`;
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

function isNotFound(err) {
  return err?.status === 404 || /not found/i.test(err?.message || "");
}

function takeHydratedPlayer(nick) {
  const el = typeof document !== "undefined" ? document.getElementById("__PLAYER__") : null;
  if (!el) return null;
  let parsed = null;
  try {
    parsed = JSON.parse(el.textContent || "null");
  } catch {
    parsed = null;
  }
  el.remove();
  if (!parsed || typeof parsed.nickname !== "string") return null;
  return parsed.nickname.toLowerCase() === String(nick).toLowerCase() ? parsed : null;
}

function buildNav(t, lang, flags = {}) {
  const item = (id, path, label, icon, hint, badge) => ({
    id, label, href: localePath(lang, path), icon, hint, badge,
  });
  const matchTools = [
    item("matchroom", "/matchroom", t("nav.matchRoom"), Icon.binoculars, t("hint.matchRoom")),
    ...(LobbyCheck ? [item(LOBBY_PAGE, `/${LOBBY_PAGE}`, t("nav.lobbyCheck"), Icon.personCheck, t("hint.lobbyCheck"), t("nav.new"))] : []),
    item("overlay", "/overlay", t("nav.overlay"), Icon.broadcastPin, t("hint.overlay"), t("nav.new")),
    item("discordbot", "/discordbot", t("nav.discordbot"), <DiscordIcon size={16} />, t("hint.discordbot"), t("nav.new")),
  ];
  return [
    { label: t("nav.leaderboards"), items: [
      item("leaderboard", "/leaderboard/EU", t("nav.europe"), Icon.trophy, t("hint.europe")),
      item("leaderboard:NA", "/leaderboard/NA", t("nav.northAmerica"), Icon.award),
      item("leaderboard:SA", "/leaderboard/SA", t("nav.southAmerica"), Icon.barChartLine),
      item("leaderboard:SEA", "/leaderboard/SEA", t("nav.southeastAsia"), Icon.graphUpArrow),
      item("leaderboard:OCE", "/leaderboard/OCE", t("nav.oceania"), Icon.tags),
      item("leaderboard:map", "/leaderboard/map", t("nav.worldMap"), Icon.globe, t("hint.worldMap")),
    ]},
    { label: t("nav.tools"), sections: [
      { label: t("navsec.player"), items: [
        item("smurf-checker", "/smurf-checker", t("nav.smurf"), Icon.incognito, t("hint.smurf")),
        item("faceit-elo-checker", "/faceit-elo-checker", t("nav.elocheck"), Icon.search, t("hint.elocheck")),
        item("faceit-levels", "/faceit-levels", t("nav.levels"), Icon.sliders, t("hint.levels")),
        item("compare", "/compare", t("nav.compare"), Icon.arrowLeftRight, t("hint.compare")),
        item("squad", "/squad", t("nav.squad"), Icon.people, t("hint.squad")),
        item("watchlist", "/watchlist", t("nav.watchlist"), Icon.star, t("hint.watchlist")),
      ]},
      { label: t("navsec.match"), items: matchTools },
      { label: t("navsec.community"), items: [
        item("community", "/community", t("nav.community"), Icon.people, t("hint.community"), t("nav.new")),
        item("hubs", "/hubs", t("nav.hubs"), Icon.diagram3, t("hint.hubs")),
        item("teams", "/teams", t("nav.teams"), Icon.grid1x2, t("hint.teams")),
      ]},
      { label: t("navsec.esports"), items: [
        item("competitions", "/competitions", t("nav.competitions"), Icon.cashCoin, t("hint.competitions")),
        item("pickem", "/pickem", t("nav.pickem"), Icon.checkLg, t("hint.pickem"), t("nav.new")),
      ]},
    ]},
    { label: t("nav.live"), items: [
      item("faceitstatus", "/faceitstatus", t("nav.faceitStatus"), Icon.activity, t("hint.faceitStatus")),
      item("steamstatus", "/steamstatus", t("nav.steamStatus"), Icon.steam, t("hint.steamStatus")),
      item("bans", "/bans", t("nav.recentBans"), Icon.slashCircle, t("hint.recentBans")),
    ]},
    { label: t("nav.pros"), items: [
      item("prosettings", "/prosettings", t("nav.proSettings"), Icon.crosshair, t("hint.proSettings")),
      item("proguesser", "/proguesser", t("nav.proGuesser"), Icon.lightbulb, t("hint.proGuesser")),
      item("games", "/games", t("nav.minigames"), Icon.controller, t("hint.minigames")),
      item("higherlower", "/higherlower", t("nav.higherLower"), Icon.graphUpArrow, t("hint.higherLower"), t("nav.new")),
    ]},
    { label: t("nav.more"), items: [
      item("docs", "/docs", t("nav.apiDocs"), Icon.codeSlash, t("hint.apiDocs")),
      item("whatsnew", "/whatsnew", t("nav.whatsNew"), Icon.stars, t("hint.whatsNew"), flags.changelogUnread ? t("nav.new") : undefined),
      item("news", "/news", t("chrome.statusNews"), Icon.exclamationTriangle, undefined, flags.incidentActive ? t("nav.new") : undefined),
      item("faq", "/faq", t("nav.faq"), Icon.patchCheckFill, t("hint.faq")),
      item("feedback", "/feedback", t("nav.feedback"), Icon.chatDots, t("hint.feedback")),
      item("support", "/support", t("nav.support"), Icon.shieldCheck, t("hint.support")),
    ],
      tail: [
        { label: t("chrome.joinDiscord"), href: DISCORD_INVITE, cls: "tn-discord", icon: <DiscordIcon size={16} /> },
        { label: t("chrome.coffee"), href: COFFEE_URL, cls: "tn-coffee", icon: <CoffeeIcon size={16} /> },
      ],
    },
  ];
}

function buildHomeFeatures() {
  return [
    { key: "trust", icon: Icon.shieldCheck, nav: null },
    { key: "matchroom", icon: Icon.binoculars, nav: "matchroom" },
    ...(LobbyCheck ? [{ key: "lobby", icon: Icon.personCheck, nav: LOBBY_PAGE }] : []),
    { key: "leaderboards", icon: Icon.trophy, nav: "leaderboard" },
    { key: "compare", icon: Icon.arrowLeftRight, nav: "compare" },
    { key: "prosettings", icon: Icon.sliders, nav: "prosettings" },
    { key: "proguesser", icon: Icon.controller, nav: "proguesser" },
    { key: "status", icon: Icon.broadcastPin, nav: "faceitstatus" },
  ];
}

const OG_LOCALE = { en: "en_US", ru: "ru_RU", pl: "pl_PL", uk: "uk_UA" };

function upsertMeta(attr, key, content) {
  let tag = document.querySelector(`meta[${attr}="${key}"]`);
  if (content == null) {
    if (tag) tag.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function applyMeta(title, desc, { robots = "index, follow", lang = DEFAULT_LOCALE, image } = {}) {
  document.title = title;
  upsertMeta("name", "description", desc);
  upsertMeta("name", "robots", robots);

  const indexable = !robots.includes("noindex");
  const canonical = indexable
    ? SITE_URL + window.location.pathname.replace(/\/+$/, "").replace(/^$/, "/")
    : null;

  let link = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", canonical);
  } else if (link) {
    link.remove();
  }
  upsertMeta("property", "og:url", canonical);

  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
  if (indexable) {
    const base = stripLocalePath(window.location.pathname).replace(/\/+$/, "") || "/";
    const add = (hreflang, href) => {
      const el = document.createElement("link");
      el.setAttribute("rel", "alternate");
      el.setAttribute("hreflang", hreflang);
      el.setAttribute("href", href);
      document.head.appendChild(el);
    };
    for (const l of ALL_LOCALES) add(l, SITE_URL + localePath(l, base));
    add("x-default", SITE_URL + base);
  }
  upsertMeta("property", "og:locale", indexable ? OG_LOCALE[lang] || "en_US" : null);

  const img = image || `${SITE_URL}/og.png`;
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", desc);
  upsertMeta("property", "og:image", img);
  upsertMeta("property", "og:image:width", "1200");
  upsertMeta("property", "og:image:height", "630");
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", desc);
  upsertMeta("name", "twitter:image", img);
}

const PRIMARY_TABS = ["overview", "matches", "maps", "teammates", "season", "analysis"];
const MORE_TABS = ["demos", "hubs", "highlights", "activity", "compare", "bans", "leetify", "csrep", "clips", "hltv", "steam", "met", "nicknames"];
const TAB_ALIASES = { account: "bans", trust: "bans" };

function tabLabels(t) {
  return {
    overview: t("tab.overview"), matches: t("tab.matches"), maps: t("tab.maps"),
    teammates: t("tab.teammates"), season: t("tab.season"), analysis: t("tab.analysis"),
    hubs: t("tab.hubs"), highlights: t("tab.highlights"), activity: t("tab.activity"),
    compare: t("tab.compare"), bans: t("tab.bansTrust"), leetify: t("tab.leetify"),
    csrep: t("tab.csrep"), clips: t("tab.clips"), hltv: t("tab.hltv"), steam: t("tab.steam"),
    met: t("tab.met"), nicknames: t("tab.nicknames"), demos: t("tab.demos"),
  };
}

function normalizeTab(id) {
  const v = TAB_ALIASES[id] || id;
  return PRIMARY_TABS.includes(v) || MORE_TABS.includes(v) ? v : "overview";
}

function readTabFromUrl() {
  if (typeof window === "undefined") return "overview";
  return normalizeTab(new URLSearchParams(window.location.search).get("tab") || "overview");
}

function writeTabToUrl(tab) {
  const url = new URL(window.location.href);
  if (tab === "overview") url.searchParams.delete("tab");
  else url.searchParams.set("tab", tab);
  const next = url.pathname + (url.search ? url.search : "") + url.hash;
  if (next !== window.location.pathname + window.location.search + window.location.hash) {
    window.history.replaceState(window.history.state, "", next);
  }
}

function Lazy({ children, tall }) {
  return (
    <Suspense fallback={<div className={`sh-lazy ${tall ? "tall" : ""}`} aria-busy="true" />}>
      {children}
    </Suspense>
  );
}

export default function App({ lang = DEFAULT_LOCALE }) {
  const {
    nickname: routeNick, steamid: routeSteam, page: routePage,
    handle: routeHandle, region: routeRegion,
  } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const nav = (to, opts) =>
    navigate(typeof to === "string" ? localePath(lang, to) : to, opts);

  const t = makeT(lang);
  const hero = HERO[lang] || HERO[DEFAULT_LOCALE];

  const [nickname, setNickname] = useState(routeNick || "");
  const [mode, setMode] = useState("single");
  const [compareInputs, setCompareInputs] = useState(["", ""]);
  const [squadInput, setSquadInput] = useState("");

  const [data, setData] = useState(null);
  const [comparePlayers, setComparePlayers] = useState(null);
  const [squad, setSquad] = useState(null);
  const [steamProfile, setSteamProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(0);
  const [notice, setNotice] = useState(null);
  const [recent, setRecent] = useState([]);
  const [favs, setFavs] = useState(getFavorites());
  const [user, setUser] = useState(null);
  const [incidentStatus, setIncidentStatus] = useState(null);
  const [copied, setCopied] = useState(false);
  const [mapFilter, setMapFilter] = useState(null);
  const [profileTab, setProfileTab] = useState(readTabFromUrl);
  const [gameView, setGameView] = useState("cs2");
  const [refreshing, setRefreshing] = useState(false);
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteLoaded, setPaletteLoaded] = useState(false);
  const changelog = useChangelog();

  const currentNick = useRef(routeNick || "");
  const playerCtrl = useRef(null);
  const hydrated = useRef(false);
  const steamFetched = useRef(false);
  const aiRef = useRef(null);
  const roastRef = useRef(null);

  currentNick.current = routeNick || "";

  useEffect(() => {
    try {
      localStorage.removeItem("faceitlens_theme");
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    getJson("/api/auth/me/", { credentials: "include", ttl: 0 })
      .then((j) => {
        if (j.authenticated) {
          setUser(j);
          setFavs(j.favorites || []);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getJson("/api/incidents/")
      .then((j) => setIncidentStatus(j))
      .catch(() => setIncidentStatus({ system: { state: "operational", active: false }, incidents: [] }));
  }, []);

  async function logout() {
    try {
      await fetch(`${API_BASE}/api/auth/logout/`, { method: "POST", credentials: "include" });
    } catch {
      setUser(null);
    }
    setUser(null);
    setFavs(getFavorites());
  }

  useEffect(() => {
    function onKey(e) {
      const el = document.activeElement;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName || "") || el?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteLoaded(true);
        setPaletteOpen((o) => !o);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setPaletteLoaded(true);
        setPaletteOpen(true);
      }
    }
    function onOpen() {
      setPaletteLoaded(true);
      setPaletteOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("fl:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("fl:palette", onOpen);
    };
  }, []);

  useEffect(() => {
    setAiText("");
    setAiError("");
    setRoastText("");
    setRoastError("");
    setRoastCopied(false);
    setNotice(null);
  }, [routeNick, data?.nickname]);

  function scrollToRef(ref) {
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function runAnalysis() {
    if (!data) return;
    const nick = data.nickname;
    setAiLoading(true);
    setAiError("");
    scrollToRef(aiRef);
    try {
      const json = await getJson(`/api/analyze/${encodeURIComponent(nick)}/`, { ttl: 0, retry: 0 });
      if (currentNick.current.toLowerCase() !== nick.toLowerCase()) return;
      setAiText(json.analysis);
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
      scrollToRef(aiRef);
    }
  }

  async function runRoast() {
    if (!data) return;
    const nick = data.nickname;
    setRoastLoading(true);
    setRoastError("");
    setRoastCopied(false);
    try {
      const json = await getJson(`/api/roast/${encodeURIComponent(nick)}/`, { ttl: 0, retry: 0 });
      if (currentNick.current.toLowerCase() !== nick.toLowerCase()) return;
      setRoastText(json.roast);
    } catch (e) {
      setRoastError(e.message);
    } finally {
      setRoastLoading(false);
      scrollToRef(roastRef);
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("player");
    if (p && !routeNick) nav(`/player/${encodeURIComponent(p)}`, { replace: true });
  }, []);

  useEffect(() => {
    if (!routePage) return;
    if (routePage === LOBBY_PAGE && LobbyCheck) {
      setMode(LOBBY_PAGE);
      return;
    }
    setMode(TOOL_PAGES.has(routePage) ? routePage : "notfound");
  }, [routePage]);

  useEffect(() => {
    if (routeRegion) {
      setMode(routeRegion.toLowerCase() === "map" ? "worldmap" : "leaderboard");
    }
  }, [routeRegion]);

  useEffect(() => {
    if (routeHandle) setMode("publicprofile");
  }, [routeHandle]);

  useEffect(() => {
    if (data && mode === "single") {
      const lvl = data.skill_level ? ` Level ${data.skill_level},` : "";
      const elo = data.elo ? ` ${data.elo} ELO` : "";
      applyMeta(
        `${data.nickname} — FACEIT CS2 Stats, ELO & Trust Score | Faceit-Lens`,
        `FACEIT CS2 stats for ${data.nickname}:${lvl}${elo}, win rate, K/D, map performance, match history and an account trust score to spot smurfing.`,
        { lang, image: `${SITE_URL}/og/${encodeURIComponent(data.nickname)}.png` },
      );
      return;
    }
    if (routeNick && mode === "single" && !data) {
      if (error) {
        applyMeta("Player not found | Faceit-Lens",
          "No FACEIT player with that nickname. Search for a CS2 player instead.", { robots: "noindex, follow", lang });
      }
      return;
    }
    if (steamProfile) {
      const name = steamProfile.persona || steamProfile.faceit_nickname || "Steam player";
      applyMeta(
        `${name} — Steam & CS2 Account Check | Faceit-Lens`,
        `Steam account overview for ${name}: CS2 hours, inventory value, bans, profile age and account trust signals.`,
        { lang },
      );
      return;
    }
    if (mode === "notfound") {
      applyMeta("Page not found | Faceit-Lens",
        "That page doesn't exist. Search for a CS2 player instead.", { robots: "noindex, follow", lang });
      return;
    }
    const regionMeta = mode === "leaderboard" && routeRegion ? leaderboardRegionMeta(lang, routeRegion) : null;
    if (regionMeta) {
      applyMeta(`${regionMeta[0]} | Faceit-Lens`, regionMeta[1], { lang });
      return;
    }
    const isPage = Boolean(PAGE_META[mode]);
    const [title, desc] = metaFor(
      lang, isPage ? mode : null, PAGE_META[mode], [DEFAULT_TITLE, DEFAULT_DESC],
    );
    applyMeta(isPage && !/faceit-lens/i.test(title) ? `${title} | Faceit-Lens` : title, desc, { lang });
  }, [mode, data, steamProfile, lang, routeNick, routeRegion, error]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const login = params.get("login");
    if (!login) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (login === "nolink") {
      setMode("settings");
      nav("/settings");
    }
  }, []);

  useEffect(() => {
    if (routeNick) {
      setNickname(routeNick);
      setMode("single");
      setSteamProfile(null);
      setGameView("cs2");
      setMapFilter(null);
      setProfileTab(readTabFromUrl());
      loadPlayer(routeNick);
    } else if (routeSteam) {
      setMode("single");
      loadSteamProfile(routeSteam);
    } else {
      playerCtrl.current?.abort();
      setData(null);
      setSquad(null);
      setSteamProfile(null);
      getJson("/api/recent/", { ttl: 15000 })
        .then((j) => setRecent(j.items || []))
        .catch(() => {});
    }
    return () => playerCtrl.current?.abort();
  }, [routeNick, routeSteam]);

  function newPlayerSignal() {
    playerCtrl.current?.abort();
    const ctrl = new AbortController();
    playerCtrl.current = ctrl;
    return ctrl.signal;
  }

  function resetResults() {
    setError("");
    setErrorStatus(0);
    setNotice(null);
    setData(null);
    setComparePlayers(null);
    setSquad(null);
  }

  async function loadSteamProfile(id) {
    const signal = newPlayerSignal();
    setLoading(true);
    resetResults();
    setSteamProfile(null);
    try {
      const json = await getJson(`/api/steamprofile/?id=${encodeURIComponent(id)}`, { signal });
      if (signal.aborted) return;
      setSteamProfile(json);
    } catch (e) {
      if (isAbort(e) || signal.aborted) return;
      setError(e.message);
      setErrorStatus(e.status || 0);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }

  async function refreshPlayer() {
    const nick = data?.nickname;
    if (!nick || refreshing) return;
    setRefreshing(true);
    setNotice(null);
    try {
      const fresh = await getJson(playerPath(nick), { force: true, notFoundMessage: PLAYER_NOT_FOUND });
      if (currentNick.current.toLowerCase() !== nick.toLowerCase()) return;
      setData(fresh);
      setMapFilter(null);
    } catch (e) {
      if (currentNick.current.toLowerCase() !== nick.toLowerCase()) return;
      setNotice({ message: `${t("err.refresh")} ${e.message}`, retry: refreshPlayer });
    } finally {
      setRefreshing(false);
    }
  }

  async function loadPlayer(nick) {
    const signal = newPlayerSignal();
    resetResults();

    if (!hydrated.current) {
      hydrated.current = true;
      const pre = takeHydratedPlayer(nick);
      if (pre) {
        primeCache(playerPath(nick), pre);
        setData(pre);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const json = await getJson(playerPath(nick), { signal, notFoundMessage: PLAYER_NOT_FOUND });
      if (signal.aborted || currentNick.current.toLowerCase() !== nick.toLowerCase()) return;
      setData(json);
    } catch (e) {
      if (isAbort(e) || signal.aborted) return;
      setError(e.message);
      setErrorStatus(e.status || 0);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }

  async function runCompare() {
    const names = compareInputs.map((n) => n.trim()).filter(Boolean);
    if (names.length < 2) {
      setError("Enter at least two players to compare.");
      return;
    }
    setLoading(true);
    resetResults();
    try {
      const results = await Promise.all(names.map((n) => getJson(playerPath(n), { notFoundMessage: `${PLAYER_NOT_FOUND} (${n})` })));
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
    resetResults();
    try {
      setSquad(await getJson(`/api/squad/?players=${encodeURIComponent(squadInput)}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function smartSearch(raw, { steamOnly = false } = {}) {
    const input = (raw || "").trim();
    if (!input) return;

    if (!steamOnly && !looksLikeSteam(input)) {
      nav(`/player/${encodeURIComponent(input)}`);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const json = await getJson(`/api/steam/?id=${encodeURIComponent(input)}`);
      nav(`/player/${encodeURIComponent(json.nickname)}`);
    } catch {
      try {
        const json = await getJson(`/api/steamprofile/?id=${encodeURIComponent(input)}`, { notFoundMessage: "Steam profile not found." });
        if (json.faceit_nickname) {
          nav(`/player/${encodeURIComponent(json.faceit_nickname)}`);
        } else {
          nav(`/steam/${json.steamid}`);
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
    const prev = mapFilter;
    setMapFilter(map);
    if (!data) return;
    const nick = data.nickname;
    setNotice(null);
    try {
      const qs = map ? `?map=${encodeURIComponent(map)}` : "";
      const json = await getJson(`${playerPath(nick)}${qs}`);
      if (currentNick.current.toLowerCase() !== nick.toLowerCase()) return;
      setData((d) => (d && d.nickname === nick ? { ...d, recent_avg: json.recent_avg } : d));
    } catch (e) {
      if (currentNick.current.toLowerCase() !== nick.toLowerCase()) return;
      setMapFilter(prev);
      setNotice({ message: `${t("err.mapFilter")} ${e.message}`, retry: () => applyMapFilter(map) });
    }
  }

  function go(nick) {
    setNickname(nick);
    setMode("single");
    nav(`/player/${encodeURIComponent(nick)}`);
  }

  function pickNav(id) {
    setError("");
    if (id === "single") {
      setMode("single");
      nav("/");
      return;
    }
    const [page, arg] = id.split(":");
    if (page === "leaderboard") {
      const seg = arg || "EU";
      setMode(seg === "map" ? "worldmap" : "leaderboard");
      nav(`/leaderboard/${seg}`);
      return;
    }
    setMode(id);
    if (TOOL_PAGES.has(id) || (id === LOBBY_PAGE && LobbyCheck)) nav(`/${id}`);
  }

  const selectTab = useCallback((id) => {
    const tab = normalizeTab(id);
    setProfileTab(tab);
    writeTabToUrl(tab);
  }, []);

  function goToTab(id) {
    selectTab(id);
    requestAnimationFrame(() => {
      const el = document.querySelector(".sh-ptabs-wrap");
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" });
    });
  }

  async function onToggleFav() {
    if (!data) return;
    if (!user) {
      setFavs(toggleFavorite(data.nickname));
      return;
    }
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
    } catch {
      setFavs((f) => f);
    }
  }

  const isFav = data ? favs.some((n) => n.toLowerCase() === data.nickname.toLowerCase()) : false;

  async function share() {
    if (!data) return;
    const link = `${window.location.origin}/p/${encodeURIComponent(data.nickname)}`;
    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (navigator.share && coarse) {
      try {
        await navigator.share({ title: `${data.nickname} — Faceit-Lens`, url: link });
        return;
      } catch (e) {
        if (e?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt(t("ph.share"), link);
    }
  }

  const eloSeries = [];
  if (data) {
    const d = eloData(data);
    if (d.length) eloSeries.push({ name: data.nickname, color: "var(--accent)", data: d });
  }

  const showProfile = mode === "single" && !loading && data;
  const showHome =
    mode === "single" && !routeNick && !routeSteam &&
    !loading && !data && !squad && !steamProfile;
  const playerMissing = mode === "single" && routeNick && !loading && !data && error &&
    isNotFound({ status: errorStatus, message: error });

  useEffect(() => {
    if (!showHome || steamFetched.current) return;
    steamFetched.current = true;
    getJson("/api/steamstatus/")
      .then((j) => {
        const n = j?.matchmaking?.online_players;
        if (n) setCs2Online(n);
      })
      .catch(() => {});
  }, [showHome]);

  const labels = tabLabels(t);
  const availableMore = MORE_TABS.filter((k) => k !== "clips" || data?.allstar_enabled);
  const primaryTabs = PRIMARY_TABS.map((k) => [k, labels[k]]);
  const moreTabs = availableMore.map((k) => [k, labels[k]]);
  const activeTab = profileTab === "clips" && !data?.allstar_enabled ? "overview" : profileTab;
  const navGroups = buildNav(t, lang, {
    changelogUnread: !!changelog.unread,
    incidentActive: !!incidentStatus?.system?.active,
  });
  const homeFeatures = buildHomeFeatures();

  function renderTab() {
    if (!data) return null;
    switch (activeTab) {
      case "season":
        return <Insights insights={data.insights} player={data} onPick={go} />;
      case "analysis":
        return <Analysis nickname={data.nickname} />;
      case "matches":
        return (
          <>
            <MatchHistory matches={data.recent_matches} me={data.nickname} onPick={go} />
            <AllMatches matches={data.all_matches} />
          </>
        );
      case "maps":
        return (
          <>
            <MapHighlights maps={data.map_stats} />
            <MapStats maps={data.map_stats} />
          </>
        );
      case "hubs":
        return <PlayerHubs competitions={data.competitions} />;
      case "highlights":
        return <Highlights highlights={data.highlights} />;
      case "activity":
        return <Activity activity={data.activity} />;
      case "compare":
        return <ProfileCompare player={data} onPick={go} />;
      case "bans":
        return (
          <>
            <BanStatus bans={data.bans} steam={data.steam} />
            <AccountView nickname={data.nickname} />
          </>
        );
      case "leetify":
        return <LeetifyStats nickname={data.nickname} />;
      case "csrep":
        return <CsrepStats nickname={data.nickname} matches={data.recent_matches} />;
      case "clips":
        return <Clips nickname={data.nickname} />;
      case "hltv":
        return <HltvStats hltv={data.hltv} />;
      case "teammates":
        return (
          <>
            <TeammatesFull mates={data.teammates_full} onPick={go} nickname={data.nickname} />
            <div className="duo">
              <div><BestTeammates mates={data.best_teammates} onPick={go} nickname={data.nickname} /></div>
              <div><Nemeses nemeses={data.nemeses} onPick={go} /></div>
            </div>
            <BannedOpponents nickname={data.nickname} onPick={go} hideWhenEmpty />
          </>
        );
      case "demos":
        return (
          <>
            <DemoCoach nickname={data.nickname} />
            <DemoTrends nickname={data.nickname} />
          </>
        );
      case "met":
        return <HaveWeMet player={data.nickname} />;
      case "steam":
        return <SteamInfo steam={data.steam} />;
      case "nicknames":
        return <Nicknames nicknames={data.nicknames} history={data.nickname_history} player={data.nickname} />;
      default:
        return (
          <>
            <OverviewGrid
              data={data}
              maps={data.maps_played}
              mapFilter={mapFilter}
              onMapFilter={applyMapFilter}
            />
            <InsightsTeaser insights={data.insights} onOpen={() => goToTab("season")} />
            <SkillRatings skills={data.skills} />
            <StatPanels stats={data.stats} recent={data.recent_roles} />
            {eloSeries.length > 0 && <Lazy tall><EloChart series={eloSeries} /></Lazy>}
            <EloProjector elo={data.elo} winRate={data.stats?.win_rate} />
            <PlayerTeams nickname={data.nickname} />
          </>
        );
    }
  }

  return (
    <div className="shell">
      <TopNav
        lang={lang}
        groups={navGroups}
        mode={mode}
        onNav={pickNav}
        brandHref={localePath(lang, "/")}
        onBrand={() => { setMode("single"); nav("/"); }}
        search={showHome ? null : (
          <>
            <span className="tn-search-ic" aria-hidden="true">{Icon.search}</span>
            <button
              type="button"
              className="tn-kbd"
              title={`${t("chrome.quickSearch")} (${IS_MAC ? "⌘K" : "Ctrl+K"})`}
              aria-label={t("chrome.quickSearch")}
              aria-keyshortcuts={IS_MAC ? "Meta+K" : "Control+K"}
              onClick={() => { setPaletteLoaded(true); setPaletteOpen(true); }}
            >
              {SHORTCUT_LABEL}
            </button>
            <SearchInput
              value={nickname}
              onChange={setNickname}
              onPick={go}
              onEnter={() => smartSearch(nickname)}
              placeholder={t("chrome.searchPlayer")}
            />
          </>
        )}
        actions={
          <>
            <NotificationBell user={user} onOpen={(link) => nav(link)} />
            <AccountMenu
              user={user}
              onLogout={logout}
              onSettings={() => { setMode("settings"); nav("/settings"); }}
              onMyGameProfile={() => {
                if (user?.profile?.faceit_nickname) {
                  go(user.profile.faceit_nickname);
                } else if (user?.steamid) {
                  nav(`/steam/${user.steamid}`);
                }
              }}
              onMyProfile={(handle, faceitStats) => {
                if (faceitStats && user?.profile?.faceit_nickname) {
                  go(user.profile.faceit_nickname);
                } else {
                  setMode("publicprofile");
                  nav(`/u/${handle}`);
                }
              }}
            />
          </>
        }
      />

      <div className={`main ${showHome ? "is-home" : ""}`}>
        <div className="content">
          {showHome && (
            <div className="home-hero">
              <h1 className="home-title">
                {hero.titleLead} <em>{hero.titleEm}</em>
              </h1>
              <p className="home-sub">{hero.sub}</p>

              {cs2Online && (
                <div className="home-live">
                  <span className="home-live-dot" aria-hidden="true" />
                  <b>{cs2Online.toLocaleString(lang)}</b> {hero.live}
                </div>
              )}

              <div className="home-search">
                <div className="search">
                  <SearchInput
                    value={nickname}
                    onChange={setNickname}
                    onPick={go}
                    onEnter={searchHome}
                    placeholder={hero.placeholder}
                    label={hero.placeholder}
                  />
                  <button onClick={searchHome} disabled={loading}>
                    {loading ? "..." : hero.search}
                  </button>
                </div>
              </div>

              {error && <div className="state error" role="alert">{error}</div>}

              {favs.length > 0 && (
                <div className="recent">
                  <div className="recent-label">{Icon.star} {t("home.favorites")}</div>
                  <div className="recent-chips">
                    {favs.map((n) => (
                      <button key={n} className="recent-chip" onClick={() => go(n)}>{n}</button>
                    ))}
                  </div>
                </div>
              )}

              {recent.length > 0 && (
                <div className="recent">
                  <div className="recent-label">{t("home.recent")}</div>
                  <div className="recent-chips">
                    {recent.map((r) => (
                      <button key={r.nickname} className="recent-chip" onClick={() => go(r.nickname)}>
                        {r.nickname}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <h2 className="home-section-label">{t("home.features")}</h2>
              <div className="home-features sh-home-features">
                {homeFeatures.map((f) => {
                  const body = (
                    <>
                      <div className="hf-ic" aria-hidden="true">{f.icon}</div>
                      <div className="hf-title">{t(`hf.${f.key}`)}</div>
                      <div className="hf-desc">{t(`hf.${f.key}D`)}</div>
                      <div className="hf-go" aria-hidden="true">{f.nav ? t("home.open") : t("home.searchPlayer")}</div>
                    </>
                  );
                  if (!f.nav) {
                    return (
                      <button
                        key={f.key}
                        type="button"
                        className="hf-card hf-clickable"
                        onClick={() => document.querySelector(".home-search input")?.focus()}
                      >
                        {body}
                      </button>
                    );
                  }
                  const href = f.nav === "leaderboard" ? "/leaderboard/EU" : `/${f.nav}`;
                  return (
                    <a
                      key={f.key}
                      className="hf-card hf-clickable sh-hf-link"
                      href={localePath(lang, href)}
                      onClick={(e) => { if (isPlainClick(e)) { e.preventDefault(); pickNav(f.nav); } }}
                    >
                      {body}
                    </a>
                  );
                })}
              </div>

              <a
                className="home-promo sh-home-promo"
                href={localePath(lang, "/discordbot")}
                onClick={(e) => { if (isPlainClick(e)) { e.preventDefault(); pickNav("discordbot"); } }}
              >
                <span className="home-promo-ic" aria-hidden="true"><DiscordIcon size={22} /></span>
                <span className="home-promo-txt">
                  <span className="home-promo-tag">{t("home.new")}</span>
                  <b>{t("home.discordTitle")}</b>
                  <span>{t("home.discordDesc")}</span>
                </span>
                <span className="home-promo-go">{t("home.discordGo")}</span>
              </a>

              <AdBanner />
            </div>
          )}

          <Suspense fallback={<Skeleton label={t("state.loading")} />}>
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
                        aria-label={`Player ${i + 1} nickname`}
                        aria-label={`Player ${i + 1}`}
                        value={v}
                        onChange={(e) => setCompareAt(i, e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && runCompare()}
                      />
                      {compareInputs.length > 2 && (
                        <button className="cmp-x" onClick={() => removeCompareSlot(i)} title="Remove" aria-label={`Remove player ${i + 1}`}>✕</button>
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
                    aria-label="Nicknames separated by commas"
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
                onCountry={(c) => nav(`/leaderboard/${c.region}?country=${c.country}`)}
              />
            )}
            {mode === "faceitstatus" && <FaceitStatus />}
            {mode === "steamstatus" && <SteamStatus />}
            {mode === "bans" && <FaceitBans onPick={go} />}
            {mode === "prosettings" && <ProSettings />}
            {mode === "matchroom" && <MatchRoom onPick={go} />}
            {mode === LOBBY_PAGE && LobbyCheck && <LobbyCheck onPick={go} />}
            {mode === "hubs" && <Hubs onPick={go} user={user} />}
            {mode === "teams" && <Teams onPick={go} />}
            {mode === "competitions" && <Competitions onPick={go} />}
            {mode === "pickem" && <Pickem />}
            {mode === "discordbot" && <DiscordBot />}
            {mode === "smurf-checker" && (
              <SmurfChecker
                onPick={go}
                onPath={(p) => { if (p.startsWith("/matchroom")) setMode("matchroom"); nav(p); }}
              />
            )}
            {mode === "faceit-elo-checker" && <EloChecker onPick={go} />}
            {mode === "faceit-levels" && <FaceitLevels />}
            {mode === "watchlist" && <Watchlist favs={favs} user={user} onPick={go} />}
            {mode === "games" && <Games />}
            {mode === "higherlower" && <ProHigherLower />}
            {mode === "community" && <Community onPick={go} onOpen={(p) => nav(p)} />}
            {mode === "proguesser" && <ProGuesser />}
            {mode === "docs" && <ApiDocs />}
            {mode === "news" && <NewsPage data={incidentStatus} />}
            {mode === "whatsnew" && <WhatsNew />}
            {mode === "feedback" && <Feedback user={user} />}
            {mode === "overlay" && <OverlaySettings user={user} />}
            {mode === "faq" && <Faq />}
            {mode === "support" && <Support initialCategory={searchParams.get("category") || undefined} />}
            {mode === "privacy" && <PrivacyPolicy />}
            {mode === "terms" && <Terms />}
            {mode === "settings" && (
              <ProfileSettings
                user={user}
                onSaved={(p) => setUser((u) => (u ? { ...u, profile: p, name: p.name, avatar: p.avatar ? `${API_BASE}${p.avatar}` : u.steam_avatar } : u))}
                onOpenProfile={go}
              />
            )}
            {mode === "settings" && user && <Goals user={user} />}
            {mode === "publicprofile" && (
              <PublicProfile
                handle={routeHandle}
                currentUser={user}
                onPick={go}
                onEdit={() => { setMode("settings"); nav("/settings"); }}
              />
            )}
          </Suspense>

          {mode === "notfound" && (
            <NotFound
              nickname={nickname}
              setNickname={setNickname}
              onSearch={searchHome}
              onPick={go}
              onNav={pickNav}
              lang={lang}
            />
          )}

          {playerMissing ? (
            <PlayerNotFound
              query={routeNick}
              message={error}
              nickname={nickname}
              setNickname={setNickname}
              onSearch={searchHome}
              onPick={go}
              lang={lang}
            />
          ) : error && !showHome ? (
            <div className="state error sh-error" role="alert">
              {error}
              {routeNick && mode === "single" && (
                <button type="button" className="act-btn sh-retry" onClick={() => loadPlayer(routeNick)}>
                  {t("err.retry")}
                </button>
              )}
            </div>
          ) : null}

          {loading && (routeNick && mode === "single"
            ? <ProfileSkeleton label={t("state.loading")} />
            : <Skeleton label={t("state.loading")} />)}

          <Suspense fallback={<Skeleton label={t("state.loading")} />}>
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
          </Suspense>

          {showProfile && (
            <>
              <BanBanner bans={data.bans} />
              <MiniHeader
                player={data}
                tabs={gameView !== "csgo" ? primaryTabs : []}
                active={activeTab}
                activeLabel={labels[activeTab]}
                onTab={selectTab}
                lang={lang}
              />
              <PlayerHeader player={data} onRefresh={refreshPlayer} refreshing={refreshing} lang={lang}>
                <button
                  type="button"
                  className={`act-btn ${isFav ? "on" : ""}`}
                  onClick={onToggleFav}
                  aria-pressed={isFav}
                >
                  {isFav ? Icon.starFill : Icon.star}
                  {isFav ? t("ph.favorited") : t("ph.favorite")}
                </button>
                <button type="button" className="act-btn" onClick={share}>
                  {copied ? Icon.checkLg : Icon.link45deg}
                  {copied ? t("ph.copied") : t("ph.share")}
                </button>
                <span className={`sh-tools ${aiLoading || roastLoading ? "busy" : ""}`}>
                  <ProfileTools
                    onAnalyze={runAnalysis}
                    aiLoading={aiLoading}
                    onRoast={runRoast}
                    roastLoading={roastLoading}
                    onShareCard={() => setShowCard(true)}
                    onWrapped={() => setShowWrapped(true)}
                  />
                  {(aiLoading || roastLoading) && (
                    <span className="sh-spinner" role="status" aria-label={t("ph.generating")} />
                  )}
                </span>
              </PlayerHeader>

              <Suspense fallback={null}>
                {showCard && <ShareCard player={data} onClose={() => setShowCard(false)} />}
                {showWrapped && <Wrapped player={data} onClose={() => setShowWrapped(false)} />}
              </Suspense>

              <div ref={aiRef} className="sh-anchor">
                {aiError && <div className="state error" role="alert">{aiError}</div>}
                <AiReport text={aiText} loading={aiLoading} />
              </div>

              <div ref={roastRef} className="sh-anchor">
                {roastError && <div className="state error" role="alert">{roastError}</div>}
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
              </div>

              <AdInline />

              <div className="prof-layout">
                <ProfileSidebar
                  player={data}
                  onPick={go}
                  onTab={gameView !== "csgo" ? goToTab : undefined}
                  gameView={gameView}
                  onGameView={(g) => { setGameView(g); selectTab("overview"); }}
                  lang={lang}
                />
                <div className="prof-main">
                  {gameView !== "csgo" && (
                    <ProfileTabs
                      primary={primaryTabs}
                      more={moreTabs}
                      active={activeTab}
                      onTab={selectTab}
                      moreLabel={t("tab.more")}
                      menuLabel={t("tab.moreTabs")}
                    />
                  )}

                  {notice && (
                    <div className="sh-notice" role="alert">
                      <span>{notice.message}</span>
                      {notice.retry && (
                        <button type="button" className="act-btn" onClick={() => { const r = notice.retry; setNotice(null); r(); }}>
                          {t("err.retry")}
                        </button>
                      )}
                      <button type="button" className="sh-notice-x" onClick={() => setNotice(null)} aria-label={t("err.dismiss")}>
                        {Icon.xLg}
                      </button>
                    </div>
                  )}

                  <Lazy tall>
                    {gameView === "csgo" ? (
                      <CsgoOverview
                        nickname={data.nickname}
                        matches={(data.game_history || []).find((g) => g.game === "csgo")?.matches}
                      />
                    ) : renderTab()}
                  </Lazy>
                </div>
              </div>
            </>
          )}

          {!data && <ToolAbout page={mode} />}
          <SiteFooter onNav={pickNav} lang={lang} />
        </div>
      </div>

      <SocialDock />
      {paletteLoaded && (
        <Suspense fallback={null}>
          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            lang={lang}
            groups={navGroups}
            tabs={showProfile && gameView !== "csgo" ? [...primaryTabs, ...moreTabs] : null}
            tabsLabel={data ? `${data.nickname} · ${t("cp.profileTab")}` : undefined}
            onTab={goToTab}
            onPlayer={go}
            onNav={pickNav}
            onPath={(p) => {
              const page = p.split("?")[0].replace(/^\//, "");
              if (page === "matchroom") setMode("matchroom");
              nav(p);
            }}
          />
        </Suspense>
      )}

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
