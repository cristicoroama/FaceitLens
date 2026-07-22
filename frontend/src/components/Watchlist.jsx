import { useState, useEffect } from "react";
import { FaceitLevel, Flag } from "./RankIcons.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
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

      {!loading && rows.length === 0 && (
        <div className="state">
          No favorites yet. Open a player and hit ☆ Favorite to add them here.
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
