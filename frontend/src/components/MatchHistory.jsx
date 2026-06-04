import { useState } from "react";

function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

async function fetchMatch(id) {
  const API_BASE = import.meta.env.VITE_API_URL || "";
  const resp = await fetch(`${API_BASE}/api/match/${id}/`);
  if (!resp.ok) throw new Error("Failed to load match");
  return resp.json();
}

function Team({ team, me }) {
  return (
    <div className={`mt ${team.win ? "win" : "loss"}`}>
      <div className="mt-head">
        <span className="mt-result">{team.win ? "WIN" : "LOSS"}</span>
        <span className="mt-name">{team.name || "Team"}</span>
        <span className="mt-score">{team.score}</span>
      </div>
      <div className="mt-cols">
        <span>Player</span>
        <span>K</span>
        <span>D</span>
        <span>A</span>
        <span>K/D</span>
        <span>HS%</span>
        <span>ADR</span>
      </div>
      {team.players.map((p, i) => (
        <div className={`mt-row ${p.nickname === me ? "me" : ""}`} key={i}>
          <span className="mt-player">{p.nickname}</span>
          <span>{p.kills}</span>
          <span>{p.deaths}</span>
          <span>{p.assists ?? "—"}</span>
          <span>{p.kd}</span>
          <span>{p.hs ?? "—"}</span>
          <span>{p.adr ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

function MatchRow({ m, me }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const teamNames = Object.values(m.teams || {})
    .map((t) => t.nickname)
    .filter(Boolean)
    .join("  vs  ");

  async function toggle() {
    if (!open && !detail) {
      setLoading(true);
      try {
        setDetail(await fetchMatch(m.match_id));
      } catch {
        setDetail({ error: true });
      } finally {
        setLoading(false);
      }
    }
    setOpen(!open);
  }

  return (
    <div className="match-block">
      <div
        className={`match clickable ${m.won === true ? "won" : m.won === false ? "lost" : ""}`}
        onClick={toggle}
      >
        <span className="comp">{m.competition || "CS2"}</span>
        <span className="teams">{teamNames || "—"}</span>
        <span className="date">{formatDate(m.finished_at)}</span>
        <span className="chev">{open ? "▴" : "▾"}</span>
      </div>
      {open && (
        <div className="match-detail">
          {loading && <div className="match-detail-loading">Loading...</div>}
          {detail && detail.error && (
            <div className="match-detail-loading">Could not load details.</div>
          )}
          {detail && !detail.error && (
            <>
              {detail.map && (
                <div className="match-detail-head">
                  {detail.map}
                  {detail.score ? ` · ${detail.score}` : ""}
                </div>
              )}
              {detail.teams.map((t, ti) => (
                <Team team={t} me={me} key={ti} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function MatchHistory({ matches, me }) {
  if (!matches || matches.length === 0) {
    return <div className="state">No recent matches.</div>;
  }
  return (
    <>
      <div className="section-title">Match History</div>
      {matches.map((m) => (
        <MatchRow m={m} me={me} key={m.match_id} />
      ))}
    </>
  );
}
