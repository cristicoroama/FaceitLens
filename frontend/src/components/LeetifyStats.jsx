import { useState, useEffect } from "react";
import leetifyBadge from "../assets/leetify-badge.jpg";

const API_BASE = import.meta.env.VITE_API_URL || "";

// Skill ratings are 0-100 (higher better). Colour by tier, don't rescale.
function ratingColor(v) {
  if (v >= 70) return "#22c55e";
  if (v >= 50) return "#84cc16";
  if (v >= 30) return "#eab308";
  return "#ef4444";
}

function fmt(value, unit) {
  if (value == null) return "—";
  if (unit === "ms") return Math.round(value).toLocaleString();
  // one decimal, but drop a trailing .0
  const r = Math.round(value * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// Required by Leetify's developer guidelines.
// Rule 1/3.2: official "Data provided by Leetify" logo, unmodified (scaled only),
// linking to leetify.com. Rule 3.1: "View on Leetify" links back to the source.
function Attribution({ url }) {
  return (
    <div className="leet-attrib">
      <a href="https://leetify.com/" target="_blank" rel="noopener noreferrer" className="leet-credit">
        <img src={leetifyBadge} alt="Data provided by Leetify" className="leet-badge" />
      </a>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="leet-view">
          View on Leetify →
        </a>
      )}
    </div>
  );
}

function Ring({ label, value }) {
  const color = ratingColor(value);
  return (
    <div className="leet-ring">
      <div className="leet-ring-val" style={{ color }}>
        {Math.round(value)}
      </div>
      <div className="leet-ring-bar">
        <div style={{ width: `${Math.max(3, Math.min(100, value))}%`, background: color }} />
      </div>
      <div className="leet-ring-label">{label}</div>
    </div>
  );
}

export default function LeetifyStats({ nickname }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setData(null);
    fetch(`${API_BASE}/api/player/${encodeURIComponent(nickname)}/leetify/`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.error) setError(j.error);
        else setData(j);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [nickname]);

  if (loading) return <div className="state">Loading Leetify stats…</div>;
  if (error) return <div className="state error">{error}</div>;
  if (!data) return null;

  if (!data.available) {
    return (
      <div className="leet-empty">
        <div className="real-empty-title">Not tracked on Leetify</div>
        <p>
          Leetify has no demo-based data for this player yet. These stats (aim,
          utility, preaim, reaction time, ranks) come from the{" "}
          <a href="https://leetify.com/" target="_blank" rel="noopener noreferrer">
            Leetify
          </a>{" "}
          public API for players it has parsed.
        </p>
        {data.profile_url && <Attribution url={data.profile_url} />}
      </div>
    );
  }

  const { ranks = {}, rating = {}, stats = [] } = data;
  const rankTiles = [
    ranks.premier != null && { label: "Premier", value: ranks.premier.toLocaleString() },
    ranks.faceit != null && {
      label: "FACEIT",
      value: `Lvl ${ranks.faceit}${ranks.faceit_elo ? ` · ${ranks.faceit_elo}` : ""}`,
    },
    ranks.wingman != null && { label: "Wingman", value: `Lvl ${ranks.wingman}` },
    ranks.leetify != null && { label: "Leetify Rating", value: ranks.leetify },
  ].filter(Boolean);

  return (
    <>
      {rankTiles.length > 0 && (
        <>
          <div className="section-title">Ranks</div>
          <div className="leet-ranks">
            {rankTiles.map((r) => (
              <div className="leet-rank" key={r.label}>
                <div className="leet-rank-val">{r.value}</div>
                <div className="leet-rank-label">{r.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {(rating.aim != null || rating.positioning != null || rating.utility != null) && (
        <>
          <div className="section-title">Leetify Skill Rating</div>
          <div className="leet-rings">
            {rating.aim != null && <Ring label="Aim" value={rating.aim} />}
            {rating.positioning != null && <Ring label="Positioning" value={rating.positioning} />}
            {rating.utility != null && <Ring label="Utility" value={rating.utility} />}
          </div>
        </>
      )}

      {stats.length > 0 && (
        <>
          <div className="section-title">Detailed stats</div>
          <div className="real-grid">
            {stats.map((s) => (
              <div className="real-stat" key={s.key}>
                <div className="real-stat-val">
                  {fmt(s.value, s.unit)}
                  {s.unit && <span className="leet-unit">{s.unit}</span>}
                </div>
                <div className="real-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <Attribution url={data.profile_url} />
    </>
  );
}
