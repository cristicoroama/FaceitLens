import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PlayerHeader from "./components/PlayerHeader.jsx";
import StatsGrid from "./components/StatsGrid.jsx";
import MatchHistory from "./components/MatchHistory.jsx";
import EloChart from "./components/EloChart.jsx";
import CompareView from "./components/CompareView.jsx";
import MapStats from "./components/MapStats.jsx";
import Squad from "./components/Squad.jsx";
import Skeleton from "./components/Skeleton.jsx";
import BanBanner from "./components/BanBanner.jsx";
import SessionCard from "./components/SessionCard.jsx";
import SearchInput from "./components/SearchInput.jsx";
import BestTeammates from "./components/BestTeammates.jsx";
import RecentAverages from "./components/RecentAverages.jsx";
import MultiKills from "./components/MultiKills.jsx";
import HltvStats from "./components/HltvStats.jsx";
import LevelProgress from "./components/LevelProgress.jsx";
import Activity from "./components/Activity.jsx";
import TeammatesFull from "./components/TeammatesFull.jsx";
import Hubs from "./components/Hubs.jsx";
import SteamInfo from "./components/SteamInfo.jsx";
import Nicknames from "./components/Nicknames.jsx";
import HaveWeMet from "./components/HaveWeMet.jsx";
import OverviewGrid from "./components/OverviewGrid.jsx";
import Leaderboard from "./components/Leaderboard.jsx";
import { getFavorites, isFavorite, toggleFavorite } from "./favorites.js";

const API_BASE = import.meta.env.VITE_API_URL || "";

async function fetchPlayer(nick) {
  const resp = await fetch(`${API_BASE}/api/player/${encodeURIComponent(nick)}/`);
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
  return json;
}

async function fetchSquad(nicks) {
  const resp = await fetch(`${API_BASE}/api/squad/?players=${encodeURIComponent(nicks)}`);
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
  return json;
}

async function resolveSteam(steamInput) {
  const resp = await fetch(`${API_BASE}/api/steam/?id=${encodeURIComponent(steamInput)}`);
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
  return json.nickname;
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

export default function App() {
  const { nickname: routeNick } = useParams();
  const navigate = useNavigate();

  const [nickname, setNickname] = useState(routeNick || "");
  const [mode, setMode] = useState("single");
  const [nickname2, setNickname2] = useState("");
  const [squadInput, setSquadInput] = useState("");

  const [data, setData] = useState(null);
  const [data2, setData2] = useState(null);
  const [squad, setSquad] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState([]);
  const [favs, setFavs] = useState(getFavorites());
  const [copied, setCopied] = useState(false);
  const [bySteam, setBySteam] = useState(false);
  const [steamInput, setSteamInput] = useState("");
  const [mapFilter, setMapFilter] = useState(null);
  const [profileTab, setProfileTab] = useState("overview");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
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

  // React to the URL: /player/<nick> loads that player.
  useEffect(() => {
    if (routeNick) {
      setNickname(routeNick);
      loadPlayer(routeNick);
    } else {
      // homepage: clear and load recents
      setData(null);
      setSquad(null);
      fetch(`${API_BASE}/api/recent/`)
        .then((r) => r.json())
        .then((j) => setRecent(j.items || []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeNick]);

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

  async function runCompare(n1, n2) {
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

  async function runSquad(nick) {
    setLoading(true);
    setError("");
    setData(null);
    setData2(null);
    setSquad(null);
    try {
      setSquad(await fetchSquad(nick));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function search() {
    if (mode === "squad") {
      runSquad(squadInput);
      return;
    }
    if (mode === "compare") {
      const n1 = nickname.trim();
      const n2 = nickname2.trim();
      if (!n1 || !n2) {
        setError("Enter both players to compare.");
        return;
      }
      runCompare(n1, n2);
      return;
    }
    if (bySteam) {
      const raw = steamInput.trim();
      if (!raw) return;
      setLoading(true);
      setError("");
      try {
        const nick = await resolveSteam(raw);
        navigate(`/player/${encodeURIComponent(nick)}`);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
      return;
    }
    const nick = nickname.trim();
    if (nick) navigate(`/player/${encodeURIComponent(nick)}`);
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
    navigate(`/player/${encodeURIComponent(nick)}`);
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
    if (d.length) eloSeries.push({ name: data2.nickname, color: "#3b82f6", data: d });
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
          Faceit<span>Lens</span>
        </div>
        <button
          className="github-link theme-toggle"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          title="Toggle light / dark"
        >
          {theme === "dark" ? "☀" : "🌙"}
        </button>
        <a
          className="github-link"
          href="https://github.com/cristicoroama/FaceitLens"
          target="_blank"
          rel="noopener noreferrer"
          title="Got an idea or a bug? Open an issue on GitHub"
        >
          <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"></path>
          </svg>
          <span>GitHub</span>
        </a>
      </div>
      <div className="tagline">CS2 Stats Tracker</div>

      <div className="mode-tabs">
        {["single", "compare", "squad", "leaderboard"].map((m) => (
          <button
            key={m}
            className={`mode-tab ${mode === m ? "active" : ""}`}
            onClick={() => setMode(m)}
          >
            {m === "single" ? "Player" : m === "compare" ? "Compare 1v1" : m === "squad" ? "Squad" : "Leaderboard"}
          </button>
        ))}
      </div>

      {mode === "leaderboard" ? null : mode === "squad" ? (
        <div className="search">
          <input
            type="text"
            placeholder="Nicknames separated by commas (e.g. s1mple, ZywOo, NiKo)"
            value={squadInput}
            onChange={(e) => setSquadInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <button onClick={search} disabled={loading}>
            {loading ? "..." : "Search"}
          </button>
        </div>
      ) : (
        <>
          <div className="search">
            {bySteam ? (
              <input
                type="text"
                placeholder="Steam ID64 or steamcommunity.com/profiles/ link"
                value={steamInput}
                onChange={(e) => setSteamInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
            ) : (
              <SearchInput
                value={nickname}
                onChange={setNickname}
                onPick={go}
                onEnter={search}
                placeholder="FACEIT nickname (e.g. s1mple)"
              />
            )}
            <button onClick={search} disabled={loading}>
              {loading ? "..." : "Search"}
            </button>
          </div>
          <label className="steam-toggle">
            <input type="checkbox" checked={bySteam} onChange={(e) => setBySteam(e.target.checked)} />
            Search by Steam
          </label>
          {mode === "compare" && (
            <div className="search">
              <input
                type="text"
                className="compare-input"
                placeholder="Second player"
                value={nickname2}
                onChange={(e) => setNickname2(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
            </div>
          )}
        </>
      )}

      {error && <div className="state error">{error}</div>}
      {loading && <Skeleton />}

      {!loading && !error && !data && !squad && (
        <div className="state">
          Search for a player to see their stats.
          {favs.length > 0 && (
            <div className="recent">
              <div className="recent-label">⭐ Favorites</div>
              <div className="recent-chips">
                {favs.map((n) => (
                  <button key={n} className="recent-chip" onClick={() => go(n)}>
                    {n}
                  </button>
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
        </div>
      )}

      {mode === "leaderboard" && <Leaderboard onPick={go} />}

      {!loading && squad && <Squad data={squad} />}

      {!loading && data && data2 && (
        <>
          <CompareView a={data} b={data2} />
          {eloSeries.length > 0 && <EloChart series={eloSeries} />}
        </>
      )}

      {!loading && data && !data2 && (
        <>
          <BanBanner bans={data.bans} />
          <div className="player-actions">
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
          </div>
          {aiError && <div className="state error">{aiError}</div>}
          {aiText && (
            <div className="ai-panel">
              <div className="ai-panel-head">✨ AI Scouting Report</div>
              <div className="ai-panel-body">{aiText}</div>
            </div>
          )}
          <PlayerHeader player={data} />
          <LevelProgress elo={data.elo} level={data.skill_level} />

          <div className="sub-tabs">
            {[
              ["overview", "Overview"],
              ["hltv", "HLTV"],
              ["teammates", "Teammates"],
              ["hubs", "Hubs"],
              ["met", "Have We Met?"],
              ["steam", "Steam"],
              ["nicknames", "Nicknames"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`sub-tab ${profileTab === key ? "active" : ""}`}
                onClick={() => setProfileTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {profileTab === "hltv" ? (
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
  );
}
