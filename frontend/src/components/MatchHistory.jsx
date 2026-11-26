import { useState, useEffect, lazy, Suspense } from "react";
import { MapThumb, mapLabel } from "../map-art.jsx";
import { tier, tone } from "../rating-scale.js";
import { fmtDate, fmtDateTime } from "../stats-format.js";
import StatsPlayerLink from "./StatsPlayerLink.jsx";
import "../styles/stats.css";

const DemoMatchPanel = lazy(() => import("./DemoMatchPanel.jsx"));

const API_BASE = import.meta.env.VITE_API_URL || "";

/** "3d ago" — the question a match list answers is how long ago, not the date. */
function relTime(ts) {
  if (!ts) return "—";
  const secs = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (secs < 3600) return `${Math.max(1, Math.floor(secs / 60))}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 86400 * 30) return `${Math.floor(secs / 86400)}d ago`;
  return fmtDate(ts);
}

function fullDate(ts) {
  if (!ts) return "";
  return fmtDateTime(ts);
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

const ROLE_LABEL = { awp: "AWP", entry: "Entry", support: "Support" };

function multiCell(p) {
  const counts = [["ACE", p.k5], ["4K", p.k4], ["3K", p.k3], ["2K", p.k2]];
  const known = counts.some(([, v]) => v != null);
  if (!known) return { text: "—", label: "No multi-kill data" };
  const top = counts.find(([, v]) => v > 0);
  const label = counts.map(([k, v]) => `${k} ${v ?? 0}`).reverse().join(", ");
  if (!top) return { text: "—", label: "No multi-kills" };
  return { text: top[1] > 1 ? `${top[0]}×${top[1]}` : top[0], label };
}

function frac(wins, count) {
  if (count == null) return "—";
  return `${wins ?? 0}/${count}`;
}

const BASIC_COLS = [
  { key: "k", label: "K", full: "Kills" },
  { key: "d", label: "D", full: "Deaths" },
  { key: "a", label: "A", full: "Assists" },
  { key: "kd", label: "K/D", full: "Kill/death ratio" },
  { key: "adr", label: "ADR", full: "Average damage per round" },
  { key: "hs", label: "HS%", full: "Headshot percentage" },
  { key: "kast", label: "KAST*", full: "Estimated KAST: rounds with a kill, assist, survival or trade" },
  { key: "multi", label: "Multi", full: "Best multi-kill round" },
  { key: "rating", label: "Rating*", full: "Estimated HLTV-style rating (approximated from per-match stats)" },
];

const ADV_COLS = [
  { key: "role", label: "Role", full: "Role read from this match's stats" },
  { key: "entries", label: "Entry", full: "Opening duels won / taken" },
  { key: "fk", label: "FK", full: "First kills" },
  { key: "clutch", label: "Clutch", full: "Clutches won / attempted (1v1 and 1v2)" },
  { key: "ck", label: "CK", full: "Clutch kills" },
  { key: "flash", label: "Flash", full: "Enemies flashed / flashes thrown" },
  { key: "util", label: "UD/r", full: "Utility damage per round" },
  { key: "awp", label: "AWP", full: "Sniper kills" },
  { key: "fp", label: "FP*", full: "Estimated firepower, 0-100" },
  { key: "mvp", label: "MVP", full: "Round MVPs" },
];

function basicCells(p) {
  const multi = multiCell(p);
  return {
    k: [p.kills ?? "—"],
    d: [p.deaths ?? "—"],
    a: [p.assists ?? "—"],
    kd: [p.kd ?? "—", tier("kd", p.kd)],
    adr: [p.adr ?? "—", tier("adr", p.adr)],
    hs: [p.hs != null ? `${p.hs}%` : "—", "mt-dim"],
    kast: [p.kast != null ? `${p.kast}%` : "—", "mt-dim"],
    multi: [multi.text, multi.text === "—" ? "mt-dim" : "", multi.label],
    rating: [p.rating != null ? p.rating.toFixed(2) : "—", tier("rating", p.rating)],
  };
}

function advCells(p) {
  return {
    role: [
      p.role ? <span className={`mt-role mt-role-${p.role}`}>{ROLE_LABEL[p.role] || p.role}</span> : "—",
      p.role ? "" : "mt-dim",
    ],
    entries: [frac(p.entry_wins, p.entries)],
    fk: [p.first_kills ?? "—"],
    clutch: [
      frac(p.clutch_wins, p.clutch_count),
      "",
      p.clutch_count != null ? `1v1 ${frac(p.v1_wins, p.v1_count)}, 1v2 ${frac(p.v2_wins, p.v2_count)}` : undefined,
    ],
    ck: [p.clutch_kills ?? "—", "mt-dim"],
    flash: [frac(p.enemies_flashed, p.flashes)],
    util: [p.util_dpr != null ? Number(p.util_dpr).toFixed(1) : "—"],
    awp: [p.sniper_kills ?? "—", "mt-dim"],
    fp: [p.firepower ?? "—", "mt-dim"],
    mvp: [p.mvps ?? "—", "mt-dim"],
  };
}

function TeamBoard({ team, me, onPick, advanced }) {
  const halves = [team.half1, team.half2, team.overtime]
    .filter((h) => h != null)
    .join(" · ");
  const cols = advanced ? ADV_COLS : BASIC_COLS;
  const teamName = team.name || "Team";

  return (
    <div className={`mt ${team.win ? "win" : "loss"}`}>
      <div className="mt-head">
        <span className="mt-result">{team.win ? "WIN" : "LOSS"}</span>
        <span className="mt-name">{teamName}</span>
        {halves && <span className="mt-halves" title="First half · second half · overtime">{halves}</span>}
        <span className="mt-score">{team.score}</span>
      </div>
      <div className="mt-scroll">
        <div
          className={`mt-table ${advanced ? "mt-adv" : "mt-basic"}`}
          role="table"
          aria-label={`${teamName} scoreboard${advanced ? ", advanced stats" : ""}`}
        >
          <div className="mt-cols" role="row">
            <span role="columnheader">Player</span>
            {cols.map((c) => (
              <span role="columnheader" key={c.key} title={c.full}>
                <span aria-hidden="true">{c.label}</span>
                <span className="sr-only">{c.full}</span>
              </span>
            ))}
          </div>
          {(team.players || []).map((p, i) => {
            const cells = advanced ? advCells(p) : basicCells(p);
            return (
              <div className={`mt-row ${p.nickname === me ? "me" : ""}`} role="row" key={p.player_id || i}>
                <span className="mt-player" role="cell">
                  {onPick && p.nickname ? (
                    <StatsPlayerLink nickname={p.nickname} onPick={onPick} className="mt-link-a" title={`Open ${p.nickname}`}>
                      <Avatar src={p.avatar} nickname={p.nickname} />
                      <span className="mt-nick">{p.nickname}</span>
                    </StatsPlayerLink>
                  ) : (
                    <>
                      <Avatar src={p.avatar} nickname={p.nickname} />
                      <span className="mt-nick">{p.nickname}</span>
                    </>
                  )}
                </span>
                {cols.map((c) => {
                  const [value, cls, title] = cells[c.key];
                  return (
                    <span className={`mt-n ${cls || ""}`} role="cell" key={c.key} title={title}>
                      {value}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function hasAdvanced(teams) {
  return teams.some((t) =>
    (t.players || []).some((p) => p.entries != null || p.flashes != null || p.v1_count != null || p.role)
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

function MatchRow({ m, me, onPick, advanced, onAdvanced }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const panelId = `mh-detail-${m.match_id}`;

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

  const result = m.won === true ? "WIN" : m.won === false ? "LOSS" : "—";
  const mapName = m.map ? mapLabel(m.map) : "Unknown";
  const teams = detail && !detail.error ? detail.teams || [] : [];
  const adv = hasAdvanced(teams);

  return (
    <div className="mh-block" role="rowgroup">
      <div
        className={`mh-row ${m.won === true ? "won" : m.won === false ? "lost" : ""} ${open ? "open" : ""}`}
        role="row"
        onClick={toggle}
        title={m.competition || ""}
      >
        <span className="mh-res" role="cell">
          <button
            type="button"
            className="mh-toggle"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={(e) => { e.stopPropagation(); toggle(); }}
          >
            {result}
            <span className="sr-only">{`, ${mapName}, ${open ? "hide" : "show"} scoreboard`}</span>
          </button>
        </span>
        <span className="mh-map" role="cell">
          <MapThumb map={m.map} />
          <span className="mh-map-name">{mapName}</span>
        </span>
        <span className="mh-score" role="cell">{m.score || "—"}</span>
        <span className="mh-kda" role="cell" data-label="K/D/A">
          {m.kills ?? "—"} <i>/</i> {m.deaths ?? "—"} <i>/</i> {m.assists ?? "—"}
        </span>
        <span className={`mh-kd ${tier("kd", m.kd)}`} role="cell" data-label="K/D">
          {m.kd ?? "—"}
        </span>
        <span
          className="mh-adr"
          role="cell"
          data-label="ADR"
          title={m.adr_estimated ? "Estimated — FACEIT recorded no ADR for this match" : undefined}
        >
          {m.adr ?? "—"}{m.adr != null && m.adr_estimated ? "*" : ""}
        </span>
        <span className="mh-hs" role="cell" data-label="HS">{m.hs != null ? `${m.hs}%` : "—"}</span>
        <span
          className={`mh-rating ${tier("rating", m.rating)}`}
          role="cell"
          data-label="Rating*"
          title="Estimated rating (this match)"
        >
          {m.rating != null ? m.rating.toFixed(2) : "—"}
        </span>
        <span className="mh-when" role="cell" title={fullDate(m.finished_at)}>{relTime(m.finished_at)}</span>
        <span className="mh-chev" role="cell" aria-hidden="true">›</span>
      </div>

      {open && (
        <div className="mh-detail-row" role="row">
          <div className="match-detail" role="cell" aria-colspan={10} id={panelId}>
            {loading && <div className="match-detail-loading">Loading…</div>}
            {detail && detail.error && (
              <div className="match-detail-loading">Could not load details.</div>
            )}
            {detail && !detail.error && (
              <>
                <MetaBar d={detail} />
                {adv && (
                  <div className="mt-view" role="group" aria-label="Scoreboard columns">
                    <button
                      type="button"
                      className={`mt-view-btn ${!advanced ? "on" : ""}`}
                      aria-pressed={!advanced}
                      onClick={() => onAdvanced(false)}
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      className={`mt-view-btn ${advanced ? "on" : ""}`}
                      aria-pressed={advanced}
                      onClick={() => onAdvanced(true)}
                    >
                      Advanced
                    </button>
                    <span className="mt-view-note">* estimated</span>
                  </div>
                )}
                {teams.map((t, ti) => (
                  <TeamBoard team={t} me={me} onPick={onPick} advanced={advanced && adv} key={ti} />
                ))}
                <TeamAverages teams={teams} />
                <Suspense fallback={<div className="match-detail-loading">Loading demo tools…</div>}>
                  <DemoMatchPanel matchId={m.match_id} />
                </Suspense>
                <LeetifyMatch matchId={m.match_id} me={me} />
              </>
            )}
          </div>
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
                    className={LM_RATINGS.has(f.key) ? tone(p[f.key]) : undefined}
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
  const [advanced, setAdvanced] = useState(false);
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
        <div className="panel-title" id="mh-title">Recent Matches</div>
        <div className="panel-sub">last {matches.length} · open a row for the scoreboard</div>
      </div>

      <div className="mh-table" role="table" aria-labelledby="mh-title">
        <div className="mh-cols" role="row">
          <span role="columnheader">Result</span>
          <span role="columnheader">Map</span>
          <span role="columnheader">Score</span>
          <span role="columnheader">K / D / A</span>
          <span role="columnheader">K/D</span>
          <span role="columnheader">ADR</span>
          <span role="columnheader">HS%</span>
          <span role="columnheader" title="Estimated rating">Rating*</span>
          <span role="columnheader">When</span>
          <span role="columnheader"><span className="sr-only">Expand</span></span>
        </div>

        {matches.map((m) => (
          <MatchRow
            m={m}
            me={me}
            onPick={onPick}
            advanced={advanced}
            onAdvanced={setAdvanced}
            key={m.match_id}
          />
        ))}
      </div>
    </div>
  );
}
