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

function TeamBoard({ team, me, onPick }) {
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
          <span className="mt-n">{p.kills ?? "—"}</span>
          <span className="mt-n">{p.deaths ?? "—"}</span>
          <span className="mt-n">{p.assists ?? "—"}</span>
          <span className={`mt-n mt-kd ${num(p.kd) >= 1 ? "good" : num(p.kd) != null ? "bad" : ""}`}>
            {p.kd ?? "—"}
          </span>
          <span className="mt-n">{p.kr ?? "—"}</span>
          <span className="mt-n">{p.hs != null ? `${p.hs}%` : "—"}</span>
          <span className="mt-n mt-dim">{p.mvps ?? "—"}</span>
          <span className="mt-n">{p.adr ?? "—"}</span>
          <span
            className={`mt-n mt-rating ${p.rating >= 1.1 ? "good" : p.rating != null && p.rating < 0.9 ? "bad" : ""}`}
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

/** Green when this side won the row, red when it lost, neutral on a tie. */
function sideClass(leader, side) {
  if (leader === 0) return "tie";
  return leader === side ? "up" : "down";
}

/**
 * Team comparison, one row per stat.
 *
 * Both sides always draw a bar. Length is the value measured against the
 * bigger of the pair, so the row compares magnitudes and the bar agrees with
 * the number printed beside it. Colour carries the judgement instead: green
 * for the side that came out ahead, which on the deaths row is the smaller
 * number. Leaving the losing side blank said nothing and read as missing data.
 */
function TeamAverages({ teams }) {
  if (teams.length !== 2) return null;
  const [a, b] = teams;

  const rows = AVG_ROWS.map((r) => {
    const va = avgOf(a, r.key);
    const vb = avgOf(b, r.key);
    if (va == null || vb == null) return null;
    const top = Math.max(Math.abs(va), Math.abs(vb));
    // A floor of 4%, so a side that got shut out on a stat still shows as a
    // stub rather than vanishing into the track.
    const len = (v) => (top ? Math.max(4, Math.round((Math.abs(v) / top) * 100)) : 0);
    let leader = 0;
    if (va !== vb) leader = (r.lowerWins ? va < vb : va > vb) ? -1 : 1;
    return { ...r, va, vb, lenA: len(va), lenB: len(vb), leader };
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
        const left = sideClass(r.leader, -1);
        const right = sideClass(r.leader, 1);
        return (
          <div className="ta-row" key={r.key}>
            <span className={`ta-val left ${left}`}>
              {r.va.toFixed(r.dp)}{r.suffix || ""}
            </span>
            <span className="ta-half left">
              <i className={left} style={{ width: `${r.lenA}%` }} />
            </span>
            <span className="ta-label">{r.label}</span>
            <span className="ta-half right">
              <i className={right} style={{ width: `${r.lenB}%` }} />
            </span>
            <span className={`ta-val right ${right}`}>
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
                <TeamBoard team={t} me={me} onPick={onPick} key={ti} />
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
const LM_SHORT = {
  leetify_rating: "Rating",
  ct_leetify_rating: "CT",
  t_leetify_rating: "T",
  total_kills: "K",
  total_deaths: "D",
  total_assists: "A",
  kd_ratio: "K/D",
  total_damage: "DMG",
  dpr: "ADR",
  total_hs_kills: "HS",
  mvps: "MVP",
  score: "Score",
  rounds_count: "Rds",
  rounds_won: "W",
  rounds_lost: "L",
  rounds_survived: "Surv",
  rounds_survived_percentage: "Surv%",
  multi1k: "1K", multi2k: "2K", multi3k: "3K", multi4k: "4K", multi5k: "5K",
  preaim: "Preaim",
  reaction_time: "React",
  accuracy: "Acc",
  accuracy_enemy_spotted: "Acc spotted",
  accuracy_head: "Acc head",
  spray_accuracy: "Spray",
  counter_strafing_shots_good_ratio: "C-strafe%",
  counter_strafing_shots_all: "C-strafe all",
  counter_strafing_shots_good: "C-strafe good",
  counter_strafing_shots_bad: "C-strafe bad",
  shots_fired: "Fired",
  shots_fired_enemy_spotted: "Fired spotted",
  shots_hit_enemy_spotted: "Hit spotted",
  shots_hit_foe: "Hit foe",
  shots_hit_foe_head: "Hit foe head",
  shots_hit_friend: "Hit friend",
  shots_hit_friend_head: "Hit friend head",
  flash_assist: "Flash assist",
  flashbang_thrown: "Flashes",
  flashbang_hit_foe: "Enemies flashed",
  flashbang_hit_friend: "Friends flashed",
  flashbang_hit_foe_avg_duration: "Flash dur",
  flashbang_leading_to_kill: "Flash→kill",
  he_thrown: "HE",
  he_foes_damage_avg: "HE dmg foes",
  he_friends_damage_avg: "HE dmg friends",
  molotov_thrown: "Molly",
  smoke_thrown: "Smoke",
  utility_on_death_avg: "Util on death",
  trade_kill_opportunities: "TK opp",
  trade_kill_attempts: "TK att",
  trade_kills_succeed: "TK ok",
  trade_kill_attempts_percentage: "TK att%",
  trade_kills_success_percentage: "TK succ%",
  trade_kill_opportunities_per_round: "TK opp/rd",
  traded_death_opportunities: "TD opp",
  traded_death_attempts: "TD att",
  traded_deaths_succeed: "TD ok",
  traded_death_attempts_percentage: "TD att%",
  traded_deaths_success_percentage: "TD succ%",
  traded_deaths_opportunities_per_round: "TD opp/rd",
};

const LM_RATINGS = new Set(["leetify_rating", "ct_leetify_rating", "t_leetify_rating"]);
const LM_PERCENT = new Set([
  "accuracy", "accuracy_enemy_spotted", "accuracy_head", "spray_accuracy",
  "counter_strafing_shots_good_ratio", "rounds_survived_percentage",
  "trade_kill_attempts_percentage", "trade_kills_success_percentage",
  "traded_death_attempts_percentage", "traded_deaths_success_percentage",
]);
const LM_ONE_DP = new Set([
  "dpr", "he_foes_damage_avg", "he_friends_damage_avg",
  "utility_on_death_avg", "flashbang_hit_foe_avg_duration",
]);

function lmFormat(key, v) {
  if (v == null) return "—";
  if (LM_RATINGS.has(key)) {
    const r = Math.round(v * 1000) / 1000;
    return `${r >= 0 ? "+" : ""}${r}`;
  }
  if (LM_PERCENT.has(key)) {
    const pct = v > 1.5 ? v : v * 100;
    return `${Math.round(pct * 10) / 10}%`;
  }
  if (key === "reaction_time") {
    const ms = v > 10 ? v : v * 1000;
    return `${Math.round(ms)}ms`;
  }
  if (key === "preaim") return `${Math.round(v * 10) / 10}°`;
  if (LM_ONE_DP.has(key)) return Math.round(v * 10) / 10;
  return Number.isInteger(v) ? v : Math.round(v * 100) / 100;
}

function LeetifyMatch({ matchId, me }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState("core");

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

  const used = (f) => data.players.some((p) => p[f.key] != null);
  const allFields = (data.fields || []).filter(used);
  const groups = (data.groups || []).filter((g) =>
    allFields.some((f) => f.group === g.key)
  );
  const active = groups.some((g) => g.key === group) ? group : groups[0]?.key;
  const cols = groups.length
    ? allFields.filter((f) => f.group === active)
    : allFields;

  if (!cols.length) return null;

  return (
    <div className="lm-wrap">
      <div className="lm-head">
        <span className="lm-title">Demo stats</span>
        {data.has_banned_player && (
          <span className="lm-flag" title="Leetify has since banned at least one player from this match">
            Banned player
          </span>
        )}
        <a className="lm-credit" href="https://leetify.com/" target="_blank" rel="noopener noreferrer">
          via Leetify
        </a>
      </div>
      {(data.map_name || data.data_source || (data.team_scores || []).length > 0) && (
        <div className="lm-meta">
          {[
            data.map_name,
            data.data_source,
            (data.team_scores || []).length
              ? data.team_scores.map((t) => t.score).join(" – ")
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}
      {groups.length > 1 && (
        <div className="lm-tabs">
          {groups.map((g) => (
            <button
              key={g.key}
              type="button"
              className={`lm-tab ${g.key === active ? "on" : ""}`}
              onClick={() => setGroup(g.key)}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
      <div className="lm-scroll">
        <table className="lm-table">
          <thead>
            <tr>
              <th className="lm-l">Player</th>
              {cols.map((f) => (
                <th key={f.key} title={f.label}>{LM_SHORT[f.key] || f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.players.map((p) => (
              <tr key={p.steam64_id}
                  className={me && p.name && p.name.toLowerCase() === me.toLowerCase() ? "lm-me" : ""}>
                <td className="lm-l">{p.name}</td>
                {cols.map((f) => (
                  <td
                    key={f.key}
                    style={
                      LM_RATINGS.has(f.key) && p[f.key] != null
                        ? { color: p[f.key] >= 0 ? "#22c55e" : "#ef4444" }
                        : undefined
                    }
                  >
                    {lmFormat(f.key, p[f.key])}
                  </td>
                ))}
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
