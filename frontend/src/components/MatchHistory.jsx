import { useState, useEffect } from "react";
import { MapThumb, mapLabel } from "../map-art.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

/** "3d ago" — the question a match list answers is how long ago, not the date. */
function relTime(ts) {
  if (!ts) return "—";
  const secs = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (secs < 3600) return `${Math.max(1, Math.floor(secs / 60))}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 86400 * 30) return `${Math.floor(secs / 86400)}d ago`;
  return new Date(ts * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function fullDate(ts) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function minutes(secs) {
  if (!secs || secs < 0) return "—";
  const m = Math.round(secs / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

const num = (v) => (v == null || v === "" ? null : Number(v));

async function fetchMatch(id) {
  const resp = await fetch(`${API_BASE}/api/match/${id}/`);
  if (!resp.ok) throw new Error("Failed to load match");
  return resp.json();
}

/**
 * A scoreboard avatar. Falls back to initials both when FACEIT has no picture
 * on file and when it has one that 404s — a dead <img> in a grid cell renders
 * as the browser's broken-image glyph, which is louder than the placeholder it
 * replaces.
 */
function Avatar({ src, nickname }) {
  const [dead, setDead] = useState(false);
  if (!src || dead) {
    return (
      <span className="mt-ava ph" aria-hidden="true">
        {(nickname || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?"}
      </span>
    );
  }
  return (
    <img
      className="mt-ava"
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setDead(true)}
    />
  );
}

/* ---------------------------------------------------------------- expanded */

/**
 * The four columns where one player's number only means something next to the
 * other nine get a fill behind the cell, scaled to the best in the match.
 * Deaths invert: on that column the fullest cell is the one who died least.
 */
const HEAT = {
  kills: (v, hi, lo) => (hi > lo ? (v - lo) / (hi - lo) : 1),
  deaths: (v, hi, lo) => (hi > lo ? 1 - (v - lo) / (hi - lo) : 1),
  adr: (v, hi, lo) => (hi > lo ? (v - lo) / (hi - lo) : 1),
  rating: (v, hi, lo) => (hi > lo ? (v - lo) / (hi - lo) : 1),
};

function heatScale(teams) {
  const all = teams.flatMap((t) => t.players || []);
  const range = {};
  for (const key of Object.keys(HEAT)) {
    const vals = all.map((p) => num(p[key])).filter((v) => v != null && !isNaN(v));
    range[key] = vals.length ? { hi: Math.max(...vals), lo: Math.min(...vals) } : null;
  }
  return (key, value) => {
    const v = num(value);
    const r = range[key];
    if (v == null || isNaN(v) || !r) return undefined;
    // Never a full-bleed cell: at 100% the fill reads as a selected row.
    return { "--f": `${Math.round(HEAT[key](v, r.hi, r.lo) * 78)}%` };
  };
}

function TeamBoard({ team, me, onPick, heat }) {
  const halves = [team.half1, team.half2, team.overtime]
    .filter((h) => h != null)
    .join(" · ");

  return (
    <div className={`mt ${team.win ? "win" : "loss"}`}>
      <div className="mt-head">
        <span className="mt-result">{team.win ? "WIN" : "LOSS"}</span>
        <span className="mt-name">{team.name || "Team"}</span>
        {halves && <span className="mt-halves" title="First half · second half · overtime">{halves}</span>}
        <span className="mt-score">{team.score}</span>
      </div>
      <div className="mt-cols">
        <span>Player</span>
        <span>K</span>
        <span>D</span>
        <span>A</span>
        <span>K/D</span>
        <span>K/R</span>
        <span>HS%</span>
        <span>MVP</span>
        <span>ADR</span>
        <span className="mt-rating-h" title="Estimated HLTV-style rating (approximated from per-match stats)">Rating*</span>
      </div>
      {(team.players || []).map((p, i) => (
        <div className={`mt-row ${p.nickname === me ? "me" : ""}`} key={p.player_id || i}>
          <span
            className={`mt-player ${onPick && p.nickname ? "mt-link" : ""}`}
            onClick={onPick && p.nickname ? (e) => { e.stopPropagation(); onPick(p.nickname); } : undefined}
          >
            <Avatar src={p.avatar} nickname={p.nickname} />
            <span className="mt-nick">{p.nickname}</span>
          </span>
          <span className="mt-n heat" style={heat("kills", p.kills)}>{p.kills ?? "—"}</span>
          <span className="mt-n heat" style={heat("deaths", p.deaths)}>{p.deaths ?? "—"}</span>
          <span className="mt-n">{p.assists ?? "—"}</span>
          <span className="mt-n">{p.kd ?? "—"}</span>
          <span className="mt-n">{p.kr ?? "—"}</span>
          <span className="mt-n">{p.hs ?? "—"}</span>
          <span className="mt-n mt-dim">{p.mvps ?? "—"}</span>
          <span className="mt-n heat" style={heat("adr", p.adr)}>{p.adr ?? "—"}</span>
          <span
            className={`mt-n heat mt-rating ${p.rating >= 1.1 ? "good" : p.rating != null && p.rating < 0.9 ? "bad" : ""}`}
            style={heat("rating", p.rating)}
          >
            {p.rating != null ? p.rating.toFixed(2) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* Which side of each comparison is the better one. Deaths are the only stat
   here where the smaller number is the achievement. */
const AVG_ROWS = [
  { key: "kills", label: "Kills", dp: 1 },
  { key: "deaths", label: "Deaths", dp: 1, lowerWins: true },
  { key: "assists", label: "Assists", dp: 1 },
  { key: "kd", label: "K/D", dp: 2 },
  { key: "kr", label: "K/R", dp: 2 },
  { key: "hs", label: "HS%", dp: 0, suffix: "%" },
  { key: "adr", label: "ADR", dp: 1 },
];

function avgOf(team, key) {
  const vals = (team.players || []).map((p) => num(p[key])).filter((v) => v != null && !isNaN(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Team comparison. Rather than two bars racing to opposite edges — where the
 * eye has to measure both to find the winner — one bar leaves the centre line
 * and points at whichever side is ahead, its length being the size of the gap.
 * A glance gives you the answer; the numbers on the flanks give the detail.
 */
function TeamAverages({ teams }) {
  if (teams.length !== 2) return null;
  const [a, b] = teams;

  const rows = AVG_ROWS.map((r) => {
    const va = avgOf(a, r.key);
    const vb = avgOf(b, r.key);
    if (va == null || vb == null) return null;
    const bigger = Math.max(Math.abs(va), Math.abs(vb)) || 1;
    // Share of the leader's value that the gap represents, so a 17-vs-17 kill
    // line stays flat and a 0.4-vs-1.2 K/D line runs long.
    const gap = Math.min(1, Math.abs(va - vb) / bigger);
    let leader = 0;
    if (va !== vb) leader = (r.lowerWins ? va < vb : va > vb) ? -1 : 1;
    return { ...r, va, vb, gap, leader };
  }).filter(Boolean);

  if (!rows.length) return null;

  return (
    <div className="ta">
      <div className="ta-head">
        <span className="ta-team left">{a.name || "Team 1"}</span>
        <span className="ta-title">Head to head</span>
        <span className="ta-team right">{b.name || "Team 2"}</span>
      </div>
      {rows.map((r) => {
        const len = `${Math.max(5, Math.round(r.gap * 100))}%`;
        return (
          <div className="ta-row" key={r.key}>
            <span className={`ta-val left ${r.leader === -1 ? "on" : ""}`}>
              {r.va.toFixed(r.dp)}{r.suffix || ""}
            </span>
            <span className="ta-half left">
              <i style={{ width: r.leader === -1 ? len : 0 }} />
            </span>
            <span className="ta-label">{r.label}</span>
            <span className="ta-half right">
              <i style={{ width: r.leader === 1 ? len : 0 }} />
            </span>
            <span className={`ta-val right ${r.leader === 1 ? "on" : ""}`}>
              {r.vb.toFixed(r.dp)}{r.suffix || ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MetaBar({ d }) {
  const facts = [
    ["Region", d.region],
    ["Mode", d.game_mode],
    ["Best of", d.best_of],
    ["Score", d.score],
    ["Duration", d.duration ? minutes(d.duration) : null],
    ["Server", d.server],
  ].filter(([, v]) => v != null && v !== "");

  return (
    <div className="md-meta">
      <div className="md-meta-top">
        {d.map && <MapThumb map={d.map} className="md-map-art" />}
        <div className="md-meta-id">
          <div className="md-comp">{d.competition || "Match"}</div>
          <div className="md-when">{fullDate(d.finished_at)}</div>
        </div>
        {d.faceit_url && (
          <a
            className="md-link"
            href={d.faceit_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            Match room ↗
          </a>
        )}
      </div>
      <div className="md-facts">
        {facts.map(([k, v]) => (
          <div className="md-fact" key={k}>
            <span className="md-fact-k">{k}</span>
            <span className="md-fact-v">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- collapsed */

function MatchRow({ m, me, onPick }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

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

  const kd = num(m.kd);
  const heat = detail && !detail.error ? heatScale(detail.teams || []) : null;

  return (
    <div className="mh-block">
      <div
        className={`mh-row ${m.won === true ? "won" : m.won === false ? "lost" : ""} ${open ? "open" : ""}`}
        onClick={toggle}
        title={m.competition || ""}
      >
        <span className="mh-res">{m.won === true ? "WIN" : m.won === false ? "LOSS" : "—"}</span>
        <span className="mh-map">
          <MapThumb map={m.map} />
          <span className="mh-map-name">{m.map ? mapLabel(m.map) : "Unknown"}</span>
        </span>
        <span className="mh-score">{m.score || "—"}</span>
        <span className="mh-kda">
          {m.kills ?? "—"} <i>/</i> {m.deaths ?? "—"} <i>/</i> {m.assists ?? "—"}
        </span>
        <span className={`mh-kd ${kd >= 1 ? "good" : kd != null ? "bad" : ""}`}>
          {m.kd ?? "—"}
        </span>
        <span className="mh-adr" title={m.adr_estimated ? "Estimated — FACEIT recorded no ADR for this match" : undefined}>
          {m.adr ?? "—"}{m.adr != null && m.adr_estimated ? "*" : ""}
        </span>
        <span className="mh-hs">{m.hs != null ? `${m.hs}%` : "—"}</span>
        <span
          className={`mh-rating ${m.rating >= 1.1 ? "good" : m.rating != null && m.rating < 0.9 ? "bad" : ""}`}
          title="Estimated rating (this match)"
        >
          {m.rating != null ? m.rating.toFixed(2) : "—"}
        </span>
        <span className="mh-when" title={fullDate(m.finished_at)}>{relTime(m.finished_at)}</span>
        <span className="mh-chev" aria-hidden="true">›</span>
      </div>

      {open && (
        <div className="match-detail">
          {loading && <div className="match-detail-loading">Loading…</div>}
          {detail && detail.error && (
            <div className="match-detail-loading">Could not load details.</div>
          )}
          {detail && !detail.error && (
            <>
              <MetaBar d={detail} />
              {(detail.teams || []).map((t, ti) => (
                <TeamBoard team={t} me={me} onPick={onPick} heat={heat} key={ti} />
              ))}
              <TeamAverages teams={detail.teams || []} />
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

  const n = (v, d = 2) => (v == null ? "—" : Math.round(v * 10 ** d) / 10 ** d);

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
                  {p.leetify_rating != null ? `${p.leetify_rating >= 0 ? "+" : ""}${n(p.leetify_rating, 3)}` : "—"}
                </td>
                <td>{p.total_kills ?? "—"}</td>
                <td>{p.total_deaths ?? "—"}</td>
                <td>{p.total_assists ?? "—"}</td>
                <td>{n(p.dpr, 1)}</td>
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

export default function MatchHistory({ matches, me, onPick }) {
  if (!matches || matches.length === 0) {
    return <div className="state">No recent matches.</div>;
  }
  return (
    <div className="mh">
      <div className="panel-head mh-panel-head">
        <div className="panel-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3.5 2" />
          </svg>
        </div>
        <div className="panel-title">Recent Matches</div>
        {/* The count belongs in the sentence, not in a badge of its own: it was
            a bare "10" floating beside the title with nothing saying what it
            counted. */}
        <div className="panel-sub">last {matches.length} · click a row for the scoreboard</div>
      </div>

      <div className="mh-cols" aria-hidden="true">
        <span>Result</span>
        <span>Map</span>
        <span>Score</span>
        <span>K / D / A</span>
        <span>K/D</span>
        <span>ADR</span>
        <span>HS%</span>
        <span>Rating*</span>
        <span>When</span>
        <span />
      </div>

      {matches.map((m) => (
        <MatchRow m={m} me={me} onPick={onPick} key={m.match_id} />
      ))}
    </div>
  );
}
