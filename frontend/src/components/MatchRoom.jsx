import { useState } from "react";
import { FaceitLevel, Flag } from "./RankIcons.jsx";
import { ResultChip } from "./FormStrip.jsx";
import { mapKey, mapLabel, MapIcon } from "../map-art.jsx";
import { Icon } from "../icons.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

/* Maps we ship art for, mirrored from map-art.jsx.
 *
 * MapThumb is a 54px chip — the right size in a match list, far too small for
 * a banner. This uses the same files at full width, so the set has to agree
 * with that one or the banner silently falls back on a map the thumb can draw. */
const HAS_ART = new Set([
  "agency", "ancient", "anubis", "baggage", "basalt", "cache", "dust2",
  "edin", "grail", "inferno", "italy", "jura", "mills", "mirage", "nuke",
  "office", "overpass", "palais", "pool_day", "shoots", "thera", "train",
  "vertigo", "whistle",
]);

function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

/* One number with its label. `mono` because these sit in columns that only
   line up with tabular figures. */
function Stat({ icon, value, label, tone }) {
  return (
    <div className={`mr-stat${tone ? ` t-${tone}` : ""}`} title={label}>
      <span className="mr-stat-ic">{icon}</span>
      <span className="mr-stat-v">{value ?? "—"}</span>
      <span className="mr-stat-l">{label}</span>
    </div>
  );
}

/* The ceiling FACEIT scales its rating bar against.
 *
 * Read off the live scoreboard, not guessed: every bar's width divided by its
 * rating came back at 2.00 (2.006, 2.013, 2.017, 2.000 … the drift is only the
 * displayed figure being rounded to two decimals while the bar uses the raw
 * one), and a 2.00 rating filled the cell exactly.
 *
 * A fixed ceiling rather than the best rating in the room, which is what this
 * used to do. Scaling to the room makes every match look the same — the top
 * player always fills the bar, whether they went 2.00 or 1.05. Against a fixed
 * 2.00 the bar means the same thing in every match you open, which is the
 * whole point of looking at more than one. */
const RATING_MAX = 2;

function ratingPct(r) {
  const v = Number(r);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(100, (v / RATING_MAX) * 100);
}

/* Rating bands, matching the ones FACEIT puts on its own scoreboard.
 *
 * It bands the number rather than shading it continuously, and the bands are
 * what players actually quote at each other: under ~0.90 was a bad night, 1.15
 * and up a good one, and 1.60 up is the tier it labels "high impact" on the
 * MVP card. Four buckets and no gradient, because a per-hundredth ramp would
 * imply the figure is precise to the hundredth, and it isn't.
 *
 * Every rating visible on the reference room lands in the same band FACEIT
 * gives it: 2.00 and 1.83 gold, 1.41 green, 1.02/0.96/0.94 white, 0.87 down
 * red. The exact cut points between those are inference — the observations
 * only bracket them. */
function ratingTier(r) {
  const v = Number(r);
  if (!Number.isFinite(v)) return null;
  if (v >= 1.6) return "elite";
  if (v >= 1.15) return "good";
  if (v >= 0.9) return "mid";
  return "poor";
}

/* K/D over 30 matches, read against the 1.00 break-even that every CS2 player
   already has in their head. Deliberately only three buckets: a per-hundredth
   gradient would imply a precision a 30-match sample doesn't have. */
function kdTone(kd) {
  if (kd == null) return null;
  if (kd >= 1.15) return "good";
  if (kd < 0.95) return "bad";
  return null;
}

function PlayerRow({ p, onPick, top }) {
  const r = p.recent;
  const trend = r?.kd_trend;

  return (
    <div
      className="mr-p"
      onClick={() => p.nickname && onPick(p.nickname)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          p.nickname && onPick(p.nickname);
        }
      }}
    >
      <div className="mr-p-top">
        {p.avatar ? (
          <img className="mr-p-ava" src={p.avatar} alt="" loading="lazy" />
        ) : (
          <span className="mr-p-ava ph">{initials(p.nickname)}</span>
        )}

        <div className="mr-p-main">
          <div className="mr-p-name">
            {p.country && <Flag country={p.country} size={15} />}
            <span className="mr-p-nick">{p.nickname || "—"}</span>
            {/* The highest ELO in the room, not just on this team — the one
                player whose day decides the match more than anyone else's. */}
            {top && (
              <span className="mr-p-top-badge" title="Highest ELO in the room">
                {Icon.starFill}
              </span>
            )}
          </div>
          <div className="mr-p-sub">
            <FaceitLevel level={p.level || 1} size={18} />
            {r?.form && <span className="mr-p-form">{r.form} last 10</span>}
          </div>
        </div>

        <div className="mr-p-elo">
          {p.elo ?? "—"}
          <small>elo</small>
        </div>
      </div>

      {r ? (
        <>
          <div className="mr-p-stats">
            <Stat icon={Icon.crosshair} value={r.kd} label="K/D" tone={kdTone(r.kd)} />
            <Stat icon={Icon.barChartLine} value={r.adr} label="ADR" />
            <Stat icon={Icon.activity} value={r.hs != null ? `${r.hs}%` : null} label="HS" />
            <Stat
              icon={Icon.trophy}
              value={r.win_rate != null ? `${r.win_rate}%` : null}
              label="Win"
              tone={r.win_rate == null ? null : r.win_rate >= 55 ? "good" : r.win_rate < 45 ? "bad" : null}
            />
            {trend && trend !== "flat" && (
              <span className={`mr-p-trend ${trend}`} title={`K/D trending ${trend}`}>
                {Icon.graphUpArrow}
              </span>
            )}
          </div>

          {r.results?.length > 0 && (
            <div className="mr-p-chips">
              {r.results.map((m, i) => (
                <ResultChip
                  key={m.match_id || i}
                  won={m.won}
                  title={[
                    m.won === true ? "Win" : m.won === false ? "Loss" : "Unknown",
                    m.map ? mapLabel(m.map) : null,
                  ].filter(Boolean).join(" · ")}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        /* Said plainly rather than shown as zeros. A new account and an account
           the API had no history for look identical in a stat grid, and only
           one of them is interesting when you're checking for a smurf. */
        <div className="mr-p-nodata">{Icon.incognito} No recent matches on record</div>
      )}
    </div>
  );
}

/* How far this match sat from the player's own 30-match baseline.
 *
 * This is the column FACEIT's scoreboard structurally cannot have: it knows
 * what happened tonight, not what usually happens. A 1.10 K/D means nothing on
 * its own — from a 0.80 player it's a great night, from a 1.40 player it's a
 * bad one, and that difference is the entire reason to look someone up. */
function Delta({ now, base, digits = 2 }) {
  const a = Number(now), b = Number(base);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !b) return <span className="mr-d">—</span>;
  const d = a - b;
  // Under a twentieth of a K/D is inside the noise of a 30-match sample;
  // marking it up or down would invent a signal that isn't there.
  const flat = Math.abs(d) < (digits === 0 ? 5 : 0.05);
  return (
    <span className={`mr-d${flat ? "" : d > 0 ? " up" : " down"}`}
      title={`Career-recent baseline: ${b}`}>
      {d > 0 ? "+" : d < 0 ? "−" : ""}{Math.abs(d).toFixed(digits)}
    </span>
  );
}


/* A player chip used across every award card. */
function AwardFace({ p, onPick, size = 32 }) {
  if (!p) return null;
  return (
    <button
      type="button"
      className="mr-aw-face"
      onClick={() => p.nickname && onPick(p.nickname)}
      title={`Open ${p.nickname}`}
    >
      {p.avatar
        ? <img className="mr-aw-ava" src={p.avatar} alt="" loading="lazy"
               style={{ width: size, height: size }} />
        : <span className="mr-aw-ava ph" style={{ width: size, height: size }}>
            {initials(p.nickname)}
          </span>}
      <span className="mr-aw-who">
        <span className="mr-aw-nick">{p.nickname}</span>
        <span className="mr-aw-team">{p.team}</span>
      </span>
    </button>
  );
}

function AwardCard({ label, award, format, onPick, tone, icon }) {
  if (!award?.player) return null;
  return (
    <div className={`card mr-aw-card${tone ? ` ${tone}` : ""}`}>
      <div className="card-body">
        <span className="mr-aw-ic" aria-hidden="true">{icon}</span>
        <AwardFace p={award.player} onPick={onPick} />
        <div className="mr-aw-val">
          <b>{format(award)}</b>
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}

/* The headline row of a finished room.
 *
 * MVP and the three superlatives are the same shape FACEIT uses, because it is
 * the shape that reads instantly. The last two cards are the ones FACEIT can't
 * build: they compare a player's night to their own 30-match average, which a
 * match room has no way of knowing. That comparison is the whole reason to
 * open this page instead of the FACEIT one. */
function Awards({ awards, onPick }) {
  if (!awards) return null;
  const { mvp, kills, damage, kast, overperformer, underperformer } = awards;
  const swing = (a) => `${a.value > 0 ? "+" : "−"}${Math.abs(a.value).toFixed(2)}`;

  return (
    <div className="mr-aw">
      {mvp?.player && (
        <div className="card mr-aw-mvp">
          <div className="card-body">
          <span className="mr-aw-mvp-tag">{Icon.trophy} Player of the match</span>
          <AwardFace p={mvp.player} onPick={onPick} size={52} />
          <div className="mr-aw-mvp-stats">
            <span><b>{mvp.value.toFixed(2)}</b><small>Rating</small></span>
            <span><b>{mvp.player.match?.kills ?? "—"}/{mvp.player.match?.deaths ?? "—"}/{mvp.player.match?.assists ?? "—"}</b><small>K/D/A</small></span>
            <span><b>{mvp.player.match?.adr ?? "—"}</b><small>ADR</small></span>
            <span><b>{mvp.player.match?.hs != null ? `${mvp.player.match.hs}%` : "—"}</b><small>HS</small></span>
          </div>
          </div>
        </div>
      )}

      <div className="mr-aw-grid">
        <AwardCard label="Most kills" award={kills} onPick={onPick}
                   icon={Icon.crosshair} format={(a) => Math.round(a.value)} />
        <AwardCard label="Most damage" award={damage} onPick={onPick}
                   icon={Icon.fire} format={(a) => Math.round(a.value).toLocaleString()} />
        <AwardCard label="Best KAST" award={kast} onPick={onPick}
                   icon={Icon.shieldCheck} format={(a) => `${Math.round(a.value)}%`} />
        <AwardCard label="Above their average" award={overperformer} onPick={onPick}
                   tone="up" icon={Icon.graphUpArrow} format={swing} />
        <AwardCard label="Below their average" award={underperformer} onPick={onPick}
                   tone="down" icon={Icon.graphDownArrow} format={swing} />
      </div>
    </div>
  );
}

function Scoreboard({ team, side, onPick }) {
  return (
    <div className={`mr-sb ${side}`}>
      <div className="mr-sb-head">
        <span className={`mr-sb-score${team.win ? " win" : ""}`}>{team.score ?? "—"}</span>
        <span className="mr-sb-name">{team.name}</span>
        {team.win && <span className="mr-sb-win">{Icon.trophy} Winner</span>}
        {(team.half1 != null || team.half2 != null) && (
          <span className="mr-sb-halves">
            <b>{team.half1 ?? "—"}</b> first · <b>{team.half2 ?? "—"}</b> second
            {team.overtime ? <> · <b>{team.overtime}</b> OT</> : null}
          </span>
        )}
        <span className="mr-sb-avg">{team.avg_elo ?? "—"} <small>avg elo</small></span>
      </div>

      <div className="mr-sb-scroll">
        <table className="mr-sb-table">
          <thead>
            <tr>
              <th className="l">Player</th>
              <th>Rating</th><th>K</th><th>D</th><th>A</th>
              <th>ADR</th><th>K/D</th><th>HS%</th>
              <th title="Triple kills">3k</th>
              <th title="Quadro kills">4k</th>
              <th title="Ace">5k</th>
              <th>MVP</th>
              {/* Two columns, one idea: this match against their own last 30. */}
              <th className="sep">K/D vs 30</th><th>ADR vs 30</th>
            </tr>
          </thead>
          <tbody>
            {team.players.map((p, i) => {
              const m = p.match;
              const r = p.recent;
              return (
                <tr key={p.player_id || i} onClick={() => p.nickname && onPick(p.nickname)}>
                  <td className="l">
                    <span className="mr-sb-p">
                      {p.avatar
                        ? <img className="mr-sb-ava" src={p.avatar} alt="" loading="lazy" />
                        : <span className="mr-sb-ava ph">{initials(p.nickname)}</span>}
                      <FaceitLevel level={p.level || 1} size={16} />
                      {p.country && <Flag country={p.country} size={13} />}
                      <span className="mr-sb-nick">{p.nickname || "—"}</span>
                    </span>
                  </td>
                  <td className="mr-sb-rt">
                    {/* Two separate things, both copied off FACEIT's live
                        scoreboard: a neutral bar filling the cell behind
                        everything, and the tinted box holding the figure. */}
                    {m?.rating != null && (
                      <span
                        className="mr-rt-cell"
                        style={{ width: `${ratingPct(m.rating)}%` }}
                        role="progressbar"
                        aria-label={`Rating ${m.rating} of ${RATING_MAX}`}
                        aria-valuenow={Number(m.rating)}
                        aria-valuemin="0"
                        aria-valuemax={RATING_MAX}
                      />
                    )}
                    <b
                      className={`mr-sb-rating${ratingTier(m?.rating) ? ` r-${ratingTier(m.rating)}` : ""}`}
                      title={ratingTier(m?.rating) === "elite" ? "High impact" : undefined}
                    >
                      <span className="mr-rt-v">{m?.rating ?? "—"}</span>
                      <span className="mr-rt-rule" aria-hidden="true" />
                    </b>
                  </td>
                  <td>{m?.kills ?? "—"}</td>
                  <td>{m?.deaths ?? "—"}</td>
                  <td>{m?.assists ?? "—"}</td>
                  <td>{m?.adr ?? "—"}</td>
                  <td>{m?.kd ?? "—"}</td>
                  <td>{m?.hs != null ? `${m.hs}%` : "—"}</td>
                  <td className={m?.k3 ? "hit" : ""}>{m?.k3 || "—"}</td>
                  <td className={m?.k4 ? "hit" : ""}>{m?.k4 || "—"}</td>
                  <td className={m?.k5 ? "ace" : ""}>{m?.k5 || "—"}</td>
                  <td>{m?.mvps ?? "—"}</td>
                  <td className="sep"><Delta now={m?.kd} base={r?.kd} /></td>
                  <td><Delta now={m?.adr} base={r?.adr} digits={0} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamAgg({ team }) {
  const bits = [
    team.avg_kd != null && ["K/D", team.avg_kd],
    team.avg_adr != null && ["ADR", team.avg_adr],
    team.avg_win_rate != null && ["Win", `${team.avg_win_rate}%`],
  ].filter(Boolean);

  if (!bits.length) return null;
  return (
    <div className="mr-team-agg">
      <span className="mr-team-agg-label">last 30</span>
      {bits.map(([l, v]) => (
        <span className="mr-team-agg-i" key={l}>
          <b>{v}</b> {l}
        </span>
      ))}
    </div>
  );
}

function Team({ team, onPick, side, topElo }) {
  return (
    <div className={`mr-team ${side}`}>
      <div className="mr-team-head">
        <div className="mr-team-id">
          <span className="mr-team-name">{team.name}</span>
          <TeamAgg team={team} />
        </div>
        <span className="mr-team-avg">
          {team.avg_elo ?? "—"} <small>avg elo</small>
        </span>
      </div>
      <div className="mr-team-players">
        {team.players.map((p, i) => (
          <PlayerRow
            p={p}
            onPick={onPick}
            top={topElo != null && p.elo === topElo}
            key={p.player_id || i}
          />
        ))}
      </div>
    </div>
  );
}

/* A day like "17 Aug", from the epoch seconds the API hands back.
 *
 * The year is deliberately missing: a match room is something you open hours
 * after it happened, so the year is noise 364 days out of 365. */
function matchDay(ts) {
  if (!ts) return null;
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/* The team picture on a matchmaking room is not a club crest — it is the
 * profile picture of whoever owns the team, the leader. The payload carries
 * `leader` as a player_id and every player carries an avatar, so the image is
 * already in the roster we fetched; no extra call. Falls back to initials,
 * because a leader who never set an avatar is common. */
function teamAvatar(team) {
  if (!team?.leader) return null;
  const lead = team.players?.find((p) => p.player_id === team.leader);
  return lead?.avatar || null;
}

function Crest({ team }) {
  const src = teamAvatar(team);
  if (src) {
    return <img className="mr-crest" src={src} alt="" aria-hidden="true" loading="lazy" />;
  }
  return <span className="mr-crest ph" aria-hidden="true">{initials(team?.name || "?")}</span>;
}

/* One side of the scoreline: the winner label sits above the name so the eye
 * lands on it before the number, the way it does on FACEIT's own room. */
function BannerSide({ team, side, won }) {
  return (
    <div className={`mr-side s-${side}${won ? " is-win" : ""}`}>
      <span className="mr-side-text">
        {won && <span className="mr-winner">Winner</span>}
        <span className="mr-side-name">{team?.name || (side === "left" ? "Team 1" : "Team 2")}</span>
      </span>
      <Crest team={team} />
    </div>
  );
}

function MapBanner({ data }) {
  const key = mapKey(data.map);
  const art = key && HAS_ART.has(key) ? `/maps/${key}.webp` : null;

  const s1 = data.team1?.score;
  const s2 = data.team2?.score;
  const scored = data.finished && s1 != null && s2 != null;
  /* 0 = nobody yet (or a draw), 1 = team1, 2 = team2. */
  const won = !scored || s1 === s2 ? 0 : s1 > s2 ? 1 : 2;
  const when = matchDay(data.finished_at || data.started_at);
  const live = String(data.status || "").toLowerCase() === "ongoing";

  return (
    <div className={`mr-banner${art ? " has-art" : ""}`}>
      {art && (
        <img className="mr-banner-art" src={art} alt="" aria-hidden="true" loading="lazy" />
      )}

      <div className="mr-banner-top">
        <div className="mr-chips">
          {data.competition && (
            <span className="mr-chip">{Icon.trophy} {data.competition}</span>
          )}
          {data.region && <span className="mr-chip">{Icon.globe} {data.region}</span>}
          {data.best_of ? <span className="mr-chip">Bo{data.best_of}</span> : null}
          {/* Said in words, not just colour: "Live" and "Finished" are the
              first thing you need and the last thing the old header showed. */}
          {live && <span className="mr-chip is-live"><i className="mr-dot" />Live</span>}
          {data.finished && <span className="mr-chip">Finished</span>}
        </div>
        <div className="mr-chips">
          <span className="mr-chip">
            {data.map ? <MapIcon map={data.map} /> : Icon.grid1x2}
            {data.map ? mapLabel(data.map) : "No map yet"}
          </span>
          {when && <span className="mr-chip">{when}</span>}
          {data.faceit_url && (
            <a
              className="mr-chip mr-banner-link"
              href={data.faceit_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {Icon.link45deg} FACEIT
            </a>
          )}
        </div>
      </div>

      <div className="mr-banner-score">
        <BannerSide team={data.team1} side="left" won={won === 1} />
        <div className="mr-nums">
          {scored ? (
            <>
              <span className={`mr-num${won === 1 ? " is-win" : ""}`}>{s1}</span>
              <span className="mr-banner-vs">vs</span>
              <span className={`mr-num${won === 2 ? " is-win" : ""}`}>{s2}</span>
            </>
          ) : (
            <span className="mr-banner-vs">vs</span>
          )}
        </div>
        <BannerSide team={data.team2} side="right" won={won === 2} />
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

  /* Who actually won, once there is a result to compare the forecast against.
     null while the match is unplayed, and on a draw. */
  const winner =
    data?.finished && data.team1?.score != null && data.team2?.score != null &&
    data.team1.score !== data.team2.score
      ? data.team1.score > data.team2.score ? 1 : 2
      : null;
  /* The forecast is worth more after the match, not less: "the favourite lost"
     is the single most interesting thing a scoreboard can tell you. */
  const calledIt = winner && favored ? winner === favored : null;

  /* Across both teams, so the star marks the best player in the room rather
     than the best on each side — five stars would mark nothing. */
  const topElo = data
    ? Math.max(
        0,
        ...[...data.team1.players, ...data.team2.players].map((p) => p.elo || 0),
      ) || null
    : null;

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-title">
          <div className="panel-ic" style={{ width: 38, height: 38 }}>
            <span style={{ fontSize: 18, display: "grid" }}>{Icon.binoculars}</span>
          </div>
          Match Room <em>Analyzer</em>
        </div>
        <div className="page-hero-sub">
          Paste a FACEIT match room link to scout both teams — live ELO and level,
          each player's form over their last 30 matches, and an ELO-based win
          prediction.
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
          <MapBanner data={data} />

          {/* Shown on finished rooms too. Calling it trivia after the fact was
              wrong: the forecast is how you tell a comfortable win from an
              upset, and that reading only exists once the score is in. */}
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
                {calledIt != null && (
                  <span className={`mr-predict-verdict ${calledIt ? "hit" : "miss"}`}>
                    {calledIt ? "called it" : "upset"}
                  </span>
                )}
              </div>
            </div>
          )}

          {data.finished ? (
            <>
              <Awards awards={data.awards} onPick={onPick} />
              <Scoreboard team={data.team1} side="a" onPick={onPick} />
              <Scoreboard team={data.team2} side="b" onPick={onPick} />
              <div className="hltv-note">
                The last two columns are what this site is for: each player's
                result in this match against their own average over their last 30.
                A 1.10 K/D is a good night for some of these players and a bad one
                for others — the scoreboard alone can't tell you which.
              </div>
            </>
          ) : (
            <>
              <div className="mr-grid">
                <Team team={data.team1} onPick={onPick} side="a" topElo={topElo} />
                <div className="mr-vs">VS</div>
                <Team team={data.team2} onPick={onPick} side="b" topElo={topElo} />
              </div>
              <div className="hltv-note">
                Averages cover each player's last 30 matches; the chips are their
                last 10 results, newest first. The prediction is a logistic
                estimate from average team ELO alone — it doesn't know the map,
                the roles or who is playing on a stand-in. Treat it as a scout,
                not a lock.
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
