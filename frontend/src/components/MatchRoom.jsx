import { useState } from "react";
import { FaceitLevel, Flag } from "./RankIcons.jsx";
import { ResultChip } from "./FormStrip.jsx";
import { mapKey, mapLabel } from "../map-art.jsx";
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
              <th>ADR</th><th>K/D</th><th>HS%</th><th>MVP</th>
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
                  <td><b className="mr-sb-rating">{m?.rating ?? "—"}</b></td>
                  <td>{m?.kills ?? "—"}</td>
                  <td>{m?.deaths ?? "—"}</td>
                  <td>{m?.assists ?? "—"}</td>
                  <td>{m?.adr ?? "—"}</td>
                  <td>{m?.kd ?? "—"}</td>
                  <td>{m?.hs != null ? `${m.hs}%` : "—"}</td>
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

function MapBanner({ data }) {
  const key = mapKey(data.map);
  const art = key && HAS_ART.has(key) ? `/maps/${key}.webp` : null;

  return (
    <div className={`mr-banner${art ? " has-art" : ""}`}>
      {art && (
        <img className="mr-banner-art" src={art} alt="" aria-hidden="true" loading="lazy" />
      )}
      <div className="mr-banner-body">
        <div className="mr-banner-map">
          {data.map ? mapLabel(data.map) : "Map not picked yet"}
        </div>
        <div className="mr-banner-meta">
          {data.competition && (
            <span className="mr-chip">{Icon.trophy} {data.competition}</span>
          )}
          {data.region && <span className="mr-chip">{Icon.globe} {data.region}</span>}
          {/* Said in words, not just colour: "ONGOING" and "FINISHED" are the
              first thing you need and the last thing the old header showed. */}
          {data.status && (
            <span className={`mr-chip status s-${data.finished ? "finished" : String(data.status).toLowerCase()}`}>
              {data.finished ? "Finished" : String(data.status).toLowerCase() === "ongoing" ? "Live" : data.status}
            </span>
          )}
          {data.finished && data.team1?.score != null && data.team2?.score != null && (
            <span className="mr-chip score">
              {data.team1.score} – {data.team2.score}
            </span>
          )}
        </div>
      </div>
      {data.faceit_url && (
        <a
          className="mr-banner-link"
          href={data.faceit_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {Icon.link45deg} FACEIT
        </a>
      )}
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

          {/* A win probability for a match that has already been played is
              trivia. It stays in the payload; it comes off the page. */}
          {!data.finished && p1 != null && (
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

          {data.finished ? (
            <>
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
