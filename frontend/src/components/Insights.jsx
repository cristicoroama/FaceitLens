import { useEffect, useState } from "react";
import { MapIcon, mapLabel } from "../map-art.jsx";

function dateLabel(ts, opts) {
  if (!ts) return null;
  return new Date(ts * 1000).toLocaleDateString(undefined, opts || { day: "numeric", month: "short" });
}

function until(ts) {
  const s = ts - Date.now() / 1000;
  if (s <= 0) return null;
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h ${Math.floor((s % 3600) / 60)}m`;
}

function signed(n) {
  if (n == null) return "—";
  return n > 0 ? `+${n}` : `${n}`;
}

const VERDICT = {
  tilts: ["Tilts", "Win rate drops noticeably after losses. Take a break after two in a row."],
  resilient: ["Resilient", "Plays better after losses. Losing streaks don't stick."],
  steady: ["Steady", "Results don't swing much with the previous match."],
};

function Stat({ label, value, sub, tone }) {
  return (
    <div className="ins-stat">
      <span className={`ins-stat-val ${tone || ""}`}>{value ?? "—"}</span>
      <span className="ins-stat-lbl">{label}</span>
      {sub && <span className="ins-stat-sub">{sub}</span>}
    </div>
  );
}

function SeasonReport({ r, nickname }) {
  const [copied, setCopied] = useState(false);
  if (!r) return null;
  if (!r.matches) {
    return (
      <div className="ins-card">
        <div className="section-title">Season {r.season} report</div>
        <div className="state">No FACEIT matches in Season {r.season}.</div>
      </div>
    );
  }
  const ch = r.elo?.change;
  const est = r.elo?.estimated;

  function share() {
    const line = `My FACEIT Season ${r.season}: ${r.matches} matches, ${r.win_rate}% WR, ${r.kd} K/D, ${signed(ch)} ELO${est ? " (est.)" : ""} — "${r.title}"`;
    const url = `https://faceit-lens.com/player/${encodeURIComponent(nickname)}`;
    navigator.clipboard?.writeText(`${line}\n${url}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div className="ins-card ins-report">
      <div className="ins-report-head">
        <div>
          <div className="ins-eyebrow">Season {r.season} {r.ended ? "final report" : "so far"}</div>
          <div className="ins-title">{r.title}</div>
          <div className="ins-dim">
            {dateLabel(r.starts_at)} – {r.ends_at ? dateLabel(r.ends_at) : "now"}
            {r.partial && " · covers your last 250 matches"}
          </div>
        </div>
        <div className={`ins-elo ${ch > 0 ? "up" : ch < 0 ? "down" : ""}`}>
          <span className="ins-elo-num">{signed(ch)}</span>
          <span className="ins-elo-lbl">ELO{est ? " · est." : ""}</span>
        </div>
      </div>

      <div className="ins-stats">
        <Stat label="Matches" value={r.matches} sub={`${r.wins}W ${r.losses}L`} />
        <Stat label="Win rate" value={r.win_rate != null ? `${r.win_rate}%` : null} tone={r.win_rate >= 50 ? "pos" : "neg"} />
        <Stat label="K/D" value={r.kd} tone={r.kd >= 1 ? "pos" : "neg"} />
        <Stat label="ADR" value={r.adr} />
        <Stat label="HS" value={r.hs != null ? `${r.hs}%` : null} />
        <Stat label="Aces" value={r.aces} />
      </div>

      <div className="ins-facts">
        {r.best_map && (
          <div className="ins-fact">
            <MapIcon map={r.best_map.map} size={18} />
            <span>Best map <b>{mapLabel(r.best_map.map)}</b> · {r.best_map.win_rate}% in {r.best_map.matches}</span>
          </div>
        )}
        {r.most_played && (
          <div className="ins-fact">
            <MapIcon map={r.most_played.map} size={18} />
            <span>Most played <b>{mapLabel(r.most_played.map)}</b> · {r.most_played.matches} matches</span>
          </div>
        )}
        {r.best_game && (
          <div className="ins-fact">
            <span className="ins-dot" />
            <span>Best game <b>{r.best_game.kills}-{r.best_game.deaths}</b> on {mapLabel(r.best_game.map)}, {dateLabel(r.best_game.date)}</span>
          </div>
        )}
        <div className="ins-fact">
          <span className="ins-dot" />
          <span>Longest streaks <b className="pos">{r.longest_win_streak}W</b> / <b className="neg">{r.longest_loss_streak}L</b></span>
        </div>
        {r.busiest_day && (
          <div className="ins-fact">
            <span className="ins-dot" />
            <span>Busiest day <b>{r.busiest_day.matches} matches</b> on {new Date(r.busiest_day.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
          </div>
        )}
        {r.longest_session > 1 && (
          <div className="ins-fact">
            <span className="ins-dot" />
            <span>Longest session <b>{r.longest_session} matches</b></span>
          </div>
        )}
      </div>

      <div className="ins-actions">
        <button className="act-btn" onClick={share}>{copied ? "Copied" : "Copy season summary"}</button>
      </div>
    </div>
  );
}

function Placement({ p }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (p?.status !== "upcoming") return undefined;
    const id = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, [p?.status]);
  if (!p) return null;

  if (p.status === "upcoming") {
    const left = until(p.starts_at);
    return (
      <div className="ins-card ins-place">
        <div className="section-title">Season {p.season} placements</div>
        <div className="ins-place-up">
          <span>Season {p.season} starts {dateLabel(p.starts_at, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          {left && <b>{left}</b>}
        </div>
        <div className="ins-dim">Soft ELO reset, then {p.need} placement matches. They will be tracked here live.</div>
      </div>
    );
  }

  const slots = Array.from({ length: p.need }, (_, i) => p.results[i] || null);
  return (
    <div className="ins-card ins-place">
      <div className="section-title">
        Season {p.season} placements
        <span className="section-count">{p.played}/{p.need}</span>
      </div>
      <div className="ins-place-row">
        {slots.map((r, i) => (
          <span key={i} className={`ins-slot ${r === "W" ? "w" : r === "L" ? "l" : ""}`}>{r || i + 1}</span>
        ))}
      </div>
      <div className="ins-dim">
        {p.wins}W {p.losses}L{p.kd != null ? ` · ${p.kd} K/D` : ""}
        {p.status === "done" ? " · placements complete" : ` · ${p.need - p.played} to go`}
      </div>
    </div>
  );
}

function Bar({ label, row, base }) {
  if (!row) return null;
  const d = base != null && row.win_rate != null ? row.win_rate - base : null;
  return (
    <div className="ins-bar">
      <span className="ins-bar-lbl">{label}</span>
      <div className="ins-bar-track">
        <i style={{ width: `${row.win_rate || 0}%` }} className={row.win_rate >= 50 ? "pos" : "neg"} />
        {base != null && <b style={{ left: `${base}%` }} title={`Overall ${base}%`} />}
      </div>
      <span className="ins-bar-val">{row.win_rate}%</span>
      <span className={`ins-bar-d ${d > 0 ? "pos" : d < 0 ? "neg" : ""}`}>{d == null ? "" : signed(d)}</span>
      <span className="ins-bar-n">{row.matches}</span>
    </div>
  );
}

function Tilt({ t }) {
  if (!t) return null;
  const [name, desc] = VERDICT[t.verdict] || VERDICT.steady;
  return (
    <div className="ins-card">
      <div className="section-title">
        Tilt &amp; sessions
        <span className="section-count">last {t.matches}</span>
      </div>
      <div className={`ins-verdict v-${t.verdict}`}>
        <b>{name}</b><span>{desc}</span>
      </div>
      <div className="ins-bars">
        <div className="ins-bar ins-bar-head">
          <span /><span>Win rate vs overall {t.win_rate}%</span><span /><span /><span>n</span>
        </div>
        <Bar label="After a win" row={t.after_win} base={t.win_rate} />
        <Bar label="After a loss" row={t.after_loss} base={t.win_rate} />
        <Bar label="After 2 losses" row={t.after_two_losses} base={t.win_rate} />
        {t.by_game.map((g) => (
          <Bar key={g.n} label={g.n >= 5 ? "Game 5+ of session" : `Game ${g.n} of session`} row={g} base={t.win_rate} />
        ))}
        <Bar label="Close games (±3)" row={t.close} base={t.win_rate} />
        <Bar label="Overtime" row={t.overtime} base={t.win_rate} />
      </div>
      <div className="ins-dim">
        {t.stomps} stomp win{t.stomps === 1 ? "" : "s"} (8+ rounds)
        {t.consistency != null && ` · K/D swing ±${t.consistency}`}
      </div>
    </div>
  );
}

function Achievements({ list, compact }) {
  if (!list?.length) return null;
  return (
    <div className={compact ? "" : "ins-card"}>
      {!compact && <div className="section-title">Achievements <span className="section-count">{list.length}</span></div>}
      <div className="ins-badges">
        {list.map((a) => (
          <span key={a.id} className={`ins-badge t-${a.tier}`} title={a.desc}>
            <i aria-hidden="true" />
            <b>{a.name}</b>
            {!compact && <small>{a.desc}</small>}
          </span>
        ))}
      </div>
    </div>
  );
}

function Encounters({ e, onPick }) {
  if (!e || !e.count) return null;
  return (
    <div className="ins-card">
      <div className="section-title">
        Challenger encounters
        <span className="section-count">{e.count}</span>
      </div>
      <div className="ins-dim" style={{ marginBottom: 10 }}>Top-1000 FACEIT players met in the last 250 matches.</div>
      <div className="ins-enc">
        {e.players.map((p) => (
          <button key={p.player_id} type="button" className="ins-enc-row" onClick={() => onPick?.(p.nickname)}>
            {p.avatar ? <img src={p.avatar} alt="" loading="lazy" /> : <span className="ins-enc-ph" />}
            <span className="ins-enc-name">{p.nickname}</span>
            <span className="ins-enc-pos">#{p.position} {p.region}</span>
            <span className="ins-enc-wa">
              {p.with > 0 && <span className="pos">{p.with} with</span>}
              {p.against > 0 && <span className="neg">{p.against} vs</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function InsightsTeaser({ insights, onOpen }) {
  if (!insights) return null;
  const r = insights.season_report;
  const p = insights.placement;
  const ach = insights.achievements || [];
  if (!r?.matches && !ach.length && p?.status !== "in_progress") return null;
  return (
    <div className="ins-teaser">
      {r?.matches > 0 && (
        <button type="button" className="ins-teaser-btn" onClick={onOpen}>
          <span className="ins-eyebrow">Season {r.season} {r.ended ? "report" : "so far"}</span>
          <b>{r.title}</b>
          <span className="ins-dim">{r.matches} matches · {r.win_rate}% WR · {signed(r.elo?.change)} ELO{r.elo?.estimated ? " est." : ""}</span>
          <span className="ins-teaser-go">Open →</span>
        </button>
      )}
      {p?.status === "in_progress" && (
        <button type="button" className="ins-teaser-btn" onClick={onOpen}>
          <span className="ins-eyebrow">Season {p.season} placements</span>
          <b>{p.played}/{p.need}</b>
          <span className="ins-dim">{p.wins}W {p.losses}L</span>
        </button>
      )}
      {ach.length > 0 && <Achievements list={ach.slice(0, 6)} compact />}
    </div>
  );
}

export default function Insights({ insights, player, onPick }) {
  if (!insights) return <div className="state">Season data isn't available for this player yet.</div>;
  return (
    <div className="ins">
      <div className="ins-top">
        <SeasonReport r={insights.season_report} nickname={player?.nickname} />
        <Placement p={insights.placement} />
      </div>
      <Achievements list={insights.achievements} />
      <Tilt t={insights.tilt} />
      <Encounters e={insights.encounters} onPick={onPick} />
    </div>
  );
}
