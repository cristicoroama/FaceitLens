import { useState } from "react";
import { FaceitLevel, Flag } from "./RankIcons.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

function PlayerRow({ p, onPick, side }) {
  return (
    <div className={`mr-p ${side}`} onClick={() => p.nickname && onPick(p.nickname)}>
      {p.avatar ? (
        <img className="mr-p-ava" src={p.avatar} alt="" loading="lazy" />
      ) : (
        <span className="mr-p-ava ph">{initials(p.nickname)}</span>
      )}
      <div className="mr-p-main">
        <div className="mr-p-name">
          {p.country && <Flag country={p.country} size={15} />}
          {p.nickname || "—"}
        </div>
      </div>
      <FaceitLevel level={p.level || 1} size={22} />
      <span className="mr-p-elo">{p.elo ?? "—"}</span>
    </div>
  );
}

function Team({ team, onPick, side }) {
  return (
    <div className={`mr-team ${side}`}>
      <div className="mr-team-head">
        <span className="mr-team-name">{team.name}</span>
        <span className="mr-team-avg">
          {team.avg_elo ?? "—"} <small>avg ELO</small>
        </span>
      </div>
      <div className="mr-team-players">
        {team.players.map((p, i) => (
          <PlayerRow p={p} onPick={onPick} side={side} key={p.player_id || i} />
        ))}
      </div>
    </div>
  );
}

export default function MatchRoom({ onPick }) {
  const [url, setUrl] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function scout() {
    const v = url.trim();
    if (!v) return;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const resp = await fetch(`${API_BASE}/api/matchroom/?url=${encodeURIComponent(v)}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const p1 = data?.prob1;
  const favored = p1 != null ? (p1 >= 50 ? 1 : 2) : null;

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-title">
          <div className="panel-ic" style={{ width: 38, height: 38 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 18, height: 18 }}>
              <path d="M16 3h5v5M8 21H3v-5M21 3l-7.5 7.5M3 21l7.5-7.5" />
            </svg>
          </div>
          Match Room <em>Analyzer</em>
        </div>
        <div className="page-hero-sub">
          Paste a FACEIT match room link to scout both teams — every player's live
          ELO &amp; level, team averages and an ELO-based win prediction.
        </div>
      </div>

      <div className="search">
        <input
          type="text"
          placeholder="https://www.faceit.com/en/cs2/room/1-…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && scout()}
        />
        <button onClick={scout} disabled={loading}>{loading ? "…" : "Scout"}</button>
      </div>

      {error && <div className="state error">{error}</div>}
      {loading && <div className="state">Scouting the lobby…</div>}

      {data && (
        <>
          {(data.map || data.competition || data.status) && (
            <div className="mr-meta">
              {data.competition && <span>{data.competition}</span>}
              {data.map && <span className="mr-meta-map">{data.map.replace(/^de_/, "")}</span>}
              {data.status && <span className="mr-meta-status">{data.status}</span>}
              {data.faceit_url && (
                <a href={data.faceit_url} target="_blank" rel="noopener noreferrer" className="mr-meta-link">
                  open on FACEIT →
                </a>
              )}
            </div>
          )}

          {p1 != null && (
            <div className="mr-predict">
              <div className="mr-predict-bar">
                <div className="mr-predict-1" style={{ width: `${p1}%` }}>
                  <span>{p1}%</span>
                </div>
                <div className="mr-predict-2" style={{ width: `${100 - p1}%` }}>
                  <span>{100 - p1}%</span>
                </div>
              </div>
              <div className="mr-predict-label">
                {favored === 1 ? data.team1.name : data.team2.name} favored by ELO
              </div>
            </div>
          )}

          <div className="mr-grid">
            <Team team={data.team1} onPick={onPick} side="a" />
            <div className="mr-vs">VS</div>
            <Team team={data.team2} onPick={onPick} side="b" />
          </div>

          <div className="hltv-note">
            Prediction is a simple logistic estimate from average team ELO — it
            doesn't know map, form or roles. Treat it as a rough scout, not a lock.
          </div>
        </>
      )}
    </>
  );
}
