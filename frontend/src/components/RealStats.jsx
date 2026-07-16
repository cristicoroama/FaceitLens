import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

function ratingTier(r) {
  if (r >= 1.2) return { color: "#22c55e", text: "GREAT" };
  if (r >= 1.05) return { color: "#84cc16", text: "GOOD" };
  if (r >= 0.9) return { color: "#eab308", text: "OKAY" };
  return { color: "#ef4444", text: "POOR" };
}

function Stat({ label, value, sub }) {
  return (
    <div className="real-stat">
      <div className="real-stat-val">{value}</div>
      <div className="real-stat-label">{label}</div>
      {sub != null && <div className="real-stat-sub">{sub}</div>}
    </div>
  );
}

export default function RealStats({ nickname }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setData(null);
    fetch(`${API_BASE}/api/player/${encodeURIComponent(nickname)}/real/`)
      .then((r) => r.json())
      .then((j) => {
        if (alive) setData(j);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [nickname]);

  if (loading) return <div className="state">Loading real demo stats…</div>;
  if (error) return <div className="state error">{error}</div>;

  if (!data || !data.available) {
    return (
      <div className="real-empty">
        <div className="real-empty-title">No parsed demos yet</div>
        <p>
          These are the stats sites like csrep.gg show — real HLTV Rating 2.0,
          KAST, opening duels, clutches, trades and utility. They can&apos;t come
          from the FACEIT API; they&apos;re computed by <b>downloading and parsing
          the match demos</b>.
        </p>
        <p className="real-empty-cmd">
          Run the worker to parse this player&apos;s recent matches:
          <code>python manage.py parse_demos --player {nickname} --limit 10</code>
        </p>
      </div>
    );
  }

  const tier = ratingTier(data.rating);

  return (
    <>
      <div className="real-hero">
        <div className="real-hero-main">
          <div className="real-badge">✓ REAL · parsed from demos</div>
          <div className="real-rating" style={{ color: tier.color }}>
            {data.rating.toFixed(2)}
          </div>
          <div className="real-rating-label">
            HLTV Rating 2.0 · <span style={{ color: tier.color }}>{tier.text}</span>
          </div>
        </div>
        <div className="real-hero-meta">
          {data.matches} matches · {data.rounds} rounds
        </div>
      </div>

      <div className="real-grid">
        <Stat label="KAST" value={`${data.kast}%`} />
        <Stat label="ADR" value={data.adr} />
        <Stat label="K/D" value={data.kd} />
        <Stat label="KPR" value={data.kpr} />
        <Stat label="DPR" value={data.dpr} />
        <Stat label="HS %" value={`${data.hs_pct}%`} />
      </div>

      <div className="section-title">Opening duels</div>
      <div className="real-grid">
        <Stat label="Opening kills" value={data.opening_kills} />
        <Stat label="Opening deaths" value={data.opening_deaths} />
        <Stat
          label="Opening success"
          value={data.opening_success != null ? `${data.opening_success}%` : "—"}
          sub="rounds won after taking the duel"
        />
      </div>

      <div className="section-title">Clutch &amp; trades</div>
      <div className="real-grid">
        <Stat
          label="Clutches won"
          value={`${data.clutch_won}/${data.clutch_attempts}`}
          sub="1vX situations"
        />
        <Stat label="Trade kills" value={data.trade_kills} sub="avenged a teammate" />
        <Stat label="Traded deaths" value={data.traded_deaths} sub="you got avenged" />
      </div>

      <div className="section-title">Utility</div>
      <div className="real-grid">
        <Stat label="Flash assists" value={data.flash_assists} />
        <Stat label="Enemies flashed" value={data.enemies_flashed} />
        <Stat label="Blind time" value={`${data.blind_time}s`} sub="enemy blindness caused" />
      </div>

      <div className="hltv-note">
        Computed from {data.matches} parsed match{data.matches === 1 ? "" : "es"} (
        {data.rounds} rounds). Unlike the HLTV tab, nothing here is estimated —
        every value comes from the actual demo files.
      </div>
    </>
  );
}
