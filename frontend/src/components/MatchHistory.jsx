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

function MatchRow({ m }) {
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
      <div className="match clickable" onClick={toggle}>
        <span className="comp">{m.competition || "CS2"}</span>
        <span className="teams">{teamNames || "—"}</span>
        <span className="date">{formatDate(m.finished_at)}</span>
      </div>
      {open && (
        <div className="match-detail">
          {loading && <div className="match-detail-loading">Loading...</div>}
          {detail && detail.error && (
            <div className="match-detail-loading">Could not load details.</div>
          )}
          {detail && !detail.error && (
            <>
              <div className="match-detail-head">
                {detail.map || "Map"} {detail.score ? `· ${detail.score}` : ""}
              </div>
              {detail.teams.map((t, ti) => (
                <div key={ti} className={`match-team ${t.win ? "win" : ""}`}>
                  {t.players.map((p, pi) => (
                    <div className="match-player" key={pi}>
                      <span>{p.nickname}</span>
                      <span className="match-kd">
                        {p.kills}/{p.deaths} ({p.kd})
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function MatchHistory({ matches }) {
  if (!matches || matches.length === 0) {
    return <div className="state">No recent matches.</div>;
  }
  return (
    <>
      <div className="section-title">Match History</div>
      {matches.map((m) => (
        <MatchRow m={m} key={m.match_id} />
      ))}
    </>
  );
}
