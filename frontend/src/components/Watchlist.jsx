import { useState, useEffect } from "react";
import { FaceitLevel, Flag } from "./RankIcons.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

const WEEK = 7 * 86400;

function weekly(rows) {
  const since = Date.now() / 1000 - WEEK;
  return rows.filter((p) => !p.missing).map((p) => {
    const ms = (p.all_matches || []).filter((m) => m.finished_at && m.finished_at >= since);
    const wins = ms.filter((m) => m.won).length;
    const avg = (k) => {
      const v = ms.map((m) => Number(m[k])).filter((x) => Number.isFinite(x));
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    return {
      nickname: p.nickname, avatar: p.avatar, matches: ms.length, wins, losses: ms.length - wins,
      elo: (wins - (ms.length - wins)) * 25, kills: ms.reduce((a, m) => a + (m.kills || 0), 0),
      kd: avg("kd"), adr: avg("adr"), rating: avg("rating"),
    };
  }).filter((r) => r.matches > 0);
}

function WeeklyBoard({ rows, onPick }) {
  const [by, setBy] = useState("elo");
  const list = weekly(rows);
  if (list.length < 1) return null;
  const sorted = [...list].sort((a, b) => (b[by] ?? -1e9) - (a[by] ?? -1e9));
  const pick = (k, min = 3) => {
    const c = list.filter((r) => r.matches >= min && r[k] != null);
    return c.length ? c.reduce((a, b) => (b[k] > a[k] ? b : a)) : null;
  };
  const awards = [
    ["Climber of the week", (() => { const r = pick("elo", 1); return r && r.elo > 0 ? r : null; })(), (r) => `+${r.elo} ELO`],
    ["Best K/D", pick("kd"), (r) => r.kd.toFixed(2)],
    ["Grinder", pick("matches", 1), (r) => `${r.matches} matches`],
    ["Free fall", list.filter((r) => r.elo < 0).sort((a, b) => a.elo - b.elo)[0] || null, (r) => `${r.elo} ELO`],
  ].filter(([, r]) => r);

  return (
    <div className="wk">
      <div className="section-title">
        This week
        <span className="section-count">last 7 days</span>
        <div className="hub-view">
          {[["elo", "ELO"], ["matches", "Matches"], ["kd", "K/D"], ["adr", "ADR"]].map(([k, l]) => (
            <button key={k} type="button" className={`hub-view-opt ${by === k ? "on" : ""}`} onClick={() => setBy(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="wk-awards">
        {awards.map(([label, r, fmt]) => (
          <button type="button" key={label} className="wk-award" onClick={() => onPick(r.nickname)}>
            <span className="wk-award-lbl">{label}</span>
            <b>{r.nickname}</b>
            <span className="wk-award-val">{fmt(r)}</span>
          </button>
        ))}
      </div>
      <div className="wk-table">
        {sorted.map((r, i) => (
          <button type="button" className="wk-row" key={r.nickname} onClick={() => onPick(r.nickname)}>
            <span className="wk-pos">{i + 1}</span>
            <span className="wk-name">{r.nickname}</span>
            <span className={`wk-num ${r.elo > 0 ? "pos" : r.elo < 0 ? "neg" : ""}`}>{r.elo > 0 ? "+" : ""}{r.elo}</span>
            <span className="wk-num">{r.wins}-{r.losses}</span>
            <span className="wk-num">{r.kd != null ? r.kd.toFixed(2) : "—"}</span>
            <span className="wk-num">{r.adr != null ? Math.round(r.adr) : "—"}</span>
          </button>
        ))}
      </div>
      <div className="lrow-dim" style={{ marginTop: 6 }}>ELO change is estimated at ±25 per match.</div>
    </div>
  );
}

/**
 * Watchlist: live ELO/level for every favorited player.
 * `favs` are the nicknames (from the account when signed in, else localStorage).
 */
export default function Watchlist({ favs, user, onPick }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("elo"); // elo | name | level

  useEffect(() => {
    let alive = true;
    setLoading(true);
    if (!favs || favs.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    Promise.all(
      favs.map((nick) =>
        fetch(`${API_BASE}/api/player/${encodeURIComponent(nick)}/`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    ).then((results) => {
      if (!alive) return;
      const ok = results
        .map((p, i) => (p && !p.error ? p : { nickname: favs[i], missing: true }))
        .filter(Boolean);
      setRows(ok);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [favs]);

  const sorted = [...rows].sort((a, b) => {
    if (sort === "name") return (a.nickname || "").localeCompare(b.nickname || "");
    if (sort === "level") return (b.skill_level || 0) - (a.skill_level || 0);
    return (b.elo || 0) - (a.elo || 0);
  });

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-title">
          <div className="panel-ic" style={{ width: 38, height: 38 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
              <path d="m12 2 2.9 6.3 6.8.7-5 4.6 1.4 6.7L12 17.8 5.9 20.3l1.4-6.7-5-4.6 6.8-.7L12 2Z" />
            </svg>
          </div>
          Your <em>Watchlist</em>
        </div>
        <div className="page-hero-sub">
          {user
            ? "Favorited players, synced to your account — live ELO and level."
            : "Favorited players from this browser. Sign in with Steam to sync across devices."}
        </div>
      </div>

      {!loading && rows.length > 0 && (
        <div className="lb-controls" style={{ justifyContent: "flex-end" }}>
          <select className="map-filter" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="elo">Sort: ELO</option>
            <option value="level">Sort: Level</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      )}

      {loading && <div className="state">Loading your watchlist…</div>}

      {!loading && rows.length > 1 && <WeeklyBoard rows={rows} onPick={onPick} />}

      {!loading && rows.length === 0 && (
        <div className="state">
          No favorites yet. Open a player and hit Favorite to add them here.
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <div className="lrows stagger">
          {sorted.map((p, i) => (
            <div
              className="lrow wl-row"
              key={p.nickname}
              onClick={() => onPick(p.nickname)}
            >
              <span className="lrow-rank">#{i + 1}</span>
              {p.avatar ? (
                <img className="wl-ava" src={p.avatar} alt="" loading="lazy" />
              ) : (
                <span className="wl-ava ph">{initials(p.nickname)}</span>
              )}
              <div className="lrow-main">
                <div className="lrow-name">
                  {p.country && <Flag country={p.country} size={15} />}
                  {p.nickname}
                  {p.missing && <span className="wl-missing"> · not found</span>}
                </div>
                {!p.missing && p.stats?.win_rate != null && (
                  <div className="lrow-dim">
                    {p.stats.win_rate}% WR · {p.stats.avg_kd ?? "—"} K/D
                  </div>
                )}
              </div>
              {!p.missing && <FaceitLevel level={p.skill_level || 1} size={26} />}
              <div className="lrow-side">
                <div className="lrow-big" style={{ color: "var(--accent)" }}>{p.elo ?? "—"}</div>
                <div className="lrow-dim">ELO</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
