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
import LevelProgress from "./components/LevelProgress.jsx";
import Activity from "./components/Activity.jsx";
import TeammatesFull from "./components/TeammatesFull.jsx";
import Hubs from "./components/Hubs.jsx";
import SteamInfo from "./components/SteamInfo.jsx";
import Nicknames from "./components/Nicknames.jsx";
import HaveWeMet from "./components/HaveWeMet.jsx";
import OverviewGrid from "./components/OverviewGrid.jsx";
import Games from "./components/Games.jsx";
import Crosshair from "./components/Crosshair.jsx";
import Leaderboard from "./components/Leaderboard.jsx";
import HltvView from "./components/HltvView.jsx";
import SteamProfileView from "./components/SteamProfileView.jsx";
import { getFavorites, isFavorite, toggleFavorite } from "./favorites.js";

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
};

const NAV = [
  { group: "FACEIT", items: [
    { id: "single", label: "Player Search", icon: I.search },
    { id: "leaderboard", label: "Leaderboard", icon: I.board },
  ]},
  { group: "HLTV — Pro Scene", items: [
    { id: "hltv", label: "HLTV Hub", icon: I.hltv },
  ]},
  { group: "Tools", items: [
    { id: "compare", label: "Compare 1v1", icon: I.vs },
    { id: "squad", label: "Squad", icon: I.squad },
  ]},
  { group: "Extras", items: [
    { id: "games", label: "Minigames", icon: I.game },
    { id: "crosshair", label: "Crosshair", icon: I.xhair },
  ]},
];

const PROFILE_TABS = [
  ["account", "◈ Trust"],
  ["overview", "Overview"],
  ["leetify", "Leetify"],
  ["real", "Demos"],
  ["hltv", "HLTV"],
  ["teammates", "Teammates"],
  ["hubs", "Hubs"],
  ["met", "Have We Met?"],
  ["steam", "Steam"],
  ["nicknames", "Nicknames"],
];

export default function App() {
  const { nickname: routeNick, steamid: routeSteam } = useParams();
  const navigate = useNavigate();

  const [nickname, setNickname] = useState(routeNick || "");
  const [mode, setMode] = useState("single");
  const [nickname2, setNickname2] = useState("");
  const [squadInput, setSquadInput] = useState("");

  const [data, setData] = useState(null);
  const [data2, setData2] = useState(null);
  const [squad, setSquad] = useState(null);
  const [steamProfile, setSteamProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState([]);
  const [favs, setFavs] = useState(getFavorites());
  const [copied, setCopied] = useState(false);
  const [bySteam, setBySteam] = useState(false);
  const [steamInput, setSteamInput] = useState("");
  const [mapFilter, setMapFilter] = useState(null);
  const [profileTab, setProfileTab] = useState("account");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [sideOpen, setSideOpen] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("faceitlens_theme") || "dark"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("faceitlens_theme", theme);
  }, [theme]);

  // reset AI panel when the player changes
  useEffect(() => {
    setAiText("");
    setAiError("");
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

  // Backward-compat: old ?player= links -> /player/<nick>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("player");
    if (p && !routeNick) navigate(`/player/${encodeURIComponent(p)}`, { replace: true });
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
    const n1 = nickname.trim();
    const n2 = nickname2.trim();
    if (!n1 || !n2) {
      setError("Enter both players to compare.");
      return;
    }
    setLoading(true);
    setError("");
    setData(null);
    setData2(null);
    setSquad(null);
    try {
      const [a, b] = await Promise.all([fetchPlayer(n1), fetchPlayer(n2)]);
      setData(a);
      setData2(b);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function runSquad() {
    setLoading(true);
    setError("");
    setData(null);
    setData2(null);
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
      if (!routeNick) navigate("/");
      return;
    }
    setMode(id);
  }

  function onToggleFav() {
    if (data) setFavs(toggleFavorite(data.nickname));
  }

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

        <div className="side-foot">
          <a href="https://github.com/cristicoroama/FaceitLens" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
            GitHub — issues &amp; ideas
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
            <button
              className="tb-btn"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              title="Toggle light / dark"
            >
              {theme === "dark" ? "☀" : "🌙"}
            </button>
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
              <div className="section-title">Compare 1v1</div>
              <div className="search">
                <input
                  type="text"
                  className="compare-input"
                  placeholder="First player"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runCompare()}
                />
                <input
                  type="text"
                  className="compare-input"
                  placeholder="Second player"
                  value={nickname2}
                  onChange={(e) => setNickname2(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runCompare()}
                />
                <button onClick={runCompare} disabled={loading}>
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
          {mode === "games" && <Games />}
          {mode === "crosshair" && <Crosshair />}

          {/* ---------- STATES ---------- */}
          {error && <div className="state error">{error}</div>}
          {loading && <Skeleton />}

          {/* ---------- RESULTS ---------- */}
          {!loading && squad && <Squad data={squad} />}

          {mode === "single" && !loading && steamProfile && (
            <SteamProfileView profile={steamProfile} />
          )}

          {!loading && data && data2 && (
            <>
              <CompareView a={data} b={data2} />
              {eloSeries.length > 0 && <EloChart series={eloSeries} />}
            </>
          )}

          {showProfile && (
            <>
              <BanBanner bans={data.bans} />
              <PlayerHeader player={data}>
                <button className={`act-btn ${isFavorite(data.nickname) ? "on" : ""}`} onClick={onToggleFav}>
                  {isFavorite(data.nickname) ? "★ Favorited" : "☆ Favorite"}
                </button>
                <button className="act-btn" onClick={share}>
                  {copied ? "✓ Copied" : "🔗 Share"}
                </button>
                <button className="act-btn ai" onClick={runAnalysis} disabled={aiLoading}>
                  {aiLoading ? "Analyzing…" : "✨ AI Analysis"}
                </button>
                {data.form && <span className="form-badge">Last 10: {data.form}</span>}
              </PlayerHeader>

              {aiError && <div className="state error">{aiError}</div>}
              {aiText && (
                <div className="ai-panel">
                  <div className="ai-panel-head">✨ AI Scouting Report</div>
                  <div className="ai-panel-body">{aiText}</div>
                </div>
              )}

              <LevelProgress elo={data.elo} level={data.skill_level} />

              <div className="ptabs">
                {PROFILE_TABS.map(([key, label]) => (
                  <button
                    key={key}
                    className={`ptab ${profileTab === key ? "active" : ""}`}
                    onClick={() => setProfileTab(key)}
                  >
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
                <TeammatesFull mates={data.teammates_full} />
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
                  <OverviewGrid
                    data={data}
                    maps={data.maps_played}
                    mapFilter={mapFilter}
                    onMapFilter={applyMapFilter}
                  />
                  {eloSeries.length > 0 && <EloChart series={eloSeries} />}
                  <MapStats maps={data.map_stats} />
                  <Activity activity={data.activity} />
                  <BestTeammates mates={data.best_teammates} />
                  <MatchHistory matches={data.recent_matches} me={data.nickname} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
