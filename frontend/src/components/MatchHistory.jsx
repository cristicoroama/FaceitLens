import { useState, useEffect } from "react";
import { ResultChip } from "./FormStrip.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

async function fetchMatch(id) {
  const resp = await fetch(`${API_BASE}/api/match/${id}/`);
  if (!resp.ok) throw new Error("Failed to load match");
  return resp.json();
}

function Team({ team, me, onPick }) {
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
        <span className="mt-rating-h" title="Estimated HLTV-style rating (approximated from per-match stats)">Rating*</span>
        <span className="mt-rating-h" title="Estimated firepower, 0-100 (raw fragging power)">FP*</span>
      </div>
      {team.players.map((p, i) => (
        <div className={`mt-row ${p.nickname === me ? "me" : ""}`} key={i}>
          <span
            className={`mt-player ${onPick && p.nickname ? "mt-link" : ""}`}
            onClick={onPick && p.nickname ? (e) => { e.stopPropagation(); onPick(p.nickname); } : undefined}
          >
            {p.nickname}
          </span>
          <span>{p.kills}</span>
          <span>{p.deaths}</span>
          <span>{p.assists ?? "—"}</span>
          <span>{p.kd}</span>
          <span>{p.hs ?? "—"}</span>
          <span>{p.adr ?? "—"}</span>
          <span className={`mt-rating ${p.rating >= 1.1 ? "good" : p.rating != null && p.rating < 0.9 ? "bad" : ""}`}>
            {p.rating != null ? p.rating.toFixed(2) : "—"}
          </span>
          <span className="mt-fp">{p.firepower != null ? p.firepower : "—"}</span>
        </div>
      ))}
    </div>
  );
}

function MatchRow({ m, me, onPick }) {
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
        <ResultChip won={m.won} size="lg" />
        <div className="m2-main">
          <div className="m2-teams">{teamNames || "—"}</div>
          <div className="m2-comp">{m.competition || "CS2"}</div>
        </div>
        {m.rating != null && (
          <span
            className={`m2-rating ${m.rating >= 1.1 ? "good" : m.rating < 0.9 ? "bad" : ""}`}
            title="Estimated rating (this match)"
          >
            {m.rating.toFixed(2)}
          </span>
        )}
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
                <Team team={t} me={me} onPick={onPick} key={ti} />
              ))}
              <LeetifyMatch matchId={m.match_id} me={me} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Demo-parsed stats for one match, courtesy of Leetify.
 *
 * FACEIT's own API stops at kills/deaths/K-D. Leetify has already downloaded
 * and parsed the demo, so for matches they cover we get ratings, multi-kills,
 * ADR and utility for free — no demo worker, no bandwidth.
 * Loaded lazily: only when someone actually opens the match.
 */
function LeetifyMatch({ matchId, me }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/leetify/match/?source=faceit&id=${encodeURIComponent(matchId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => alive && setData(j))
      .catch(() => alive && setData({ available: false }))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [matchId]);

  if (loading) return <div className="match-detail-loading">Checking Leetify…</div>;
  if (!data?.available || !data.players?.length) return null;

  const num = (v, d = 2) => (v == null ? "—" : Math.round(v * 10 ** d) / 10 ** d);

  return (
    <div className="lm-wrap">
      <div className="lm-head">
        <span className="lm-title">Demo stats</span>
        <a className="lm-credit" href="https://leetify.com/" target="_blank" rel="noopener noreferrer">
          via Leetify
        </a>
      </div>
      <div className="lm-scroll">
        <table className="lm-table">
          <thead>
            <tr>
              <th className="lm-l">Player</th>
              <th>Rating</th><th>K</th><th>D</th><th>A</th>
              <th>ADR</th><th>HS</th><th>MVP</th>
              <th>3K</th><th>4K</th><th>5K</th>
            </tr>
          </thead>
          <tbody>
            {data.players.map((p) => (
              <tr key={p.steam64_id}
                  className={me && p.name && p.name.toLowerCase() === me.toLowerCase() ? "lm-me" : ""}>
                <td className="lm-l">{p.name}</td>
                <td style={{ color: (p.leetify_rating ?? 0) >= 0 ? "#22c55e" : "#ef4444" }}>
                  {p.leetify_rating != null ? `${p.leetify_rating >= 0 ? "+" : ""}${num(p.leetify_rating, 3)}` : "—"}
                </td>
                <td>{p.total_kills ?? "—"}</td>
                <td>{p.total_deaths ?? "—"}</td>
                <td>{p.total_assists ?? "—"}</td>
                <td>{num(p.dpr, 1)}</td>
                <td>{p.total_hs_kills ?? "—"}</td>
                <td>{p.mvps ?? "—"}</td>
                <td>{p.multi3k || 0}</td>
                <td>{p.multi4k || 0}</td>
                <td>{p.multi5k || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
