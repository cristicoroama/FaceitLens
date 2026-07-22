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
    <div className="m2-block">
      <div
        className={`m2 ${m.won === true ? "won" : m.won === false ? "lost" : ""} ${open ? "open" : ""}`}
        onClick={toggle}
      >
        <div className="m2-pill">{m.won === true ? "W" : m.won === false ? "L" : "?"}</div>
        <div className="m2-main">
          <div className="m2-teams">{teamNames || "—"}</div>
          <div className="m2-comp">{m.competition || "CS2"}</div>
        </div>
        <span className="m2-date">{formatDate(m.finished_at)}</span>
        <span className="m2-chev">▾</span>
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
      <div className="panel-head" style={{ marginBottom: 12 }}>
        <div className="panel-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3.5 2" />
          </svg>
        </div>
        <div className="panel-title">Match History</div>
        <span className="panel-count">{matches.length}</span>
        <div className="panel-sub">click a match for the scoreboard</div>
      </div>
      <div className="stagger">
        {matches.map((m) => (
          <MatchRow m={m} me={me} key={m.match_id} />
        ))}
      </div>
    </>
  );
}
