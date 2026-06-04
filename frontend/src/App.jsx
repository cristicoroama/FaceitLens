import { useState, useEffect } from "react";
import PlayerHeader from "./components/PlayerHeader.jsx";
import StatsGrid from "./components/StatsGrid.jsx";
import MatchHistory from "./components/MatchHistory.jsx";
import EloChart from "./components/EloChart.jsx";
import CompareView from "./components/CompareView.jsx";
import MapStats from "./components/MapStats.jsx";
import Squad from "./components/Squad.jsx";
import Skeleton from "./components/Skeleton.jsx";
import BanBanner from "./components/BanBanner.jsx";

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

// Prefer real ELO snapshots if we have at least 2; else the reconstructed curve.
function eloData(player) {
  if (player.elo_snapshots && player.elo_snapshots.length >= 2) {
    return player.elo_snapshots.map((s) => ({
      date: Math.floor(new Date(s.date).getTime() / 1000),
      elo: s.elo,
    }));
  }
  return player.elo_history || [];
}

// Modes: "single" | "compare" | "squad"
export default function App() {
  const [nickname, setNickname] = useState("");
  const [mode, setMode] = useState("single");
  const [nickname2, setNickname2] = useState("");
  const [squadInput, setSquadInput] = useState("");

  const [data, setData] = useState(null);
  const [data2, setData2] = useState(null);
  const [squad, setSquad] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("player");
    if (p) {
      setNickname(p);
      runSearch(p, "single");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(nick, m) {
    if (!nick) return;
    setLoading(true);
    setError("");
    setData(null);
    setData2(null);
    setSquad(null);
    try {
      if (m === "squad") {
        setSquad(await fetchSquad(nick));
      } else {
        const a = await fetchPlayer(nick);
        setData(a);
        const url = new URL(window.location);
        url.searchParams.set("player", a.nickname);
        window.history.replaceState({}, "", url);
        if (m === "compare" && nickname2.trim()) {
          setData2(await fetchPlayer(nickname2.trim()));
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function search() {
    if (mode === "squad") runSearch(squadInput, "squad");
    else runSearch(nickname.trim(), mode);
  }

  function onKeyDown(e) {
    if (e.key === "Enter") search();
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
      <div className="brand">
        Faceit<span>Lens</span>
      </div>
      <div className="tagline">CS2 Stats Tracker</div>

      <div className="mode-tabs">
        {["single", "compare", "squad"].map((m) => (
          <button
            key={m}
            className={`mode-tab ${mode === m ? "active" : ""}`}
            onClick={() => setMode(m)}
          >
            {m === "single" ? "Player" : m === "compare" ? "Compare 1v1" : "Squad"}
          </button>
        ))}
      </div>

      {mode === "squad" ? (
        <div className="search">
          <input
            type="text"
            placeholder="Nicknames separated by commas (e.g. s1mple, ZywOo, NiKo)"
            value={squadInput}
            onChange={(e) => setSquadInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button onClick={search} disabled={loading}>
            {loading ? "..." : "Search"}
          </button>
        </div>
      ) : (
        <>
          <div className="search">
            <input
              type="text"
              placeholder="FACEIT nickname (e.g. s1mple)"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button onClick={search} disabled={loading}>
              {loading ? "..." : "Search"}
            </button>
          </div>
          {mode === "compare" && (
            <div className="search">
              <input
                type="text"
                className="compare-input"
                placeholder="Second player"
                value={nickname2}
                onChange={(e) => setNickname2(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>
          )}
        </>
      )}

      {error && <div className="state error">{error}</div>}
      {loading && <Skeleton />}

      {!loading && !error && !data && !squad && (
        <div className="state">Search for a player to see their stats.</div>
      )}

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
          <PlayerHeader player={data} />
          <StatsGrid stats={data.stats} />
          {eloSeries.length > 0 && <EloChart series={eloSeries} />}
          <MapStats maps={data.map_stats} />
          <MatchHistory matches={data.recent_matches} />
        </>
      )}
    </div>
  );
}
