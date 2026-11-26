import { useEffect, useMemo, useState } from "react";
import { fetchDemoMatches } from "../lib/demo-api.js";
import "../styles/demo.css";

const W = 640;
const H = 200;
const PAD = { l: 36, r: 36, t: 14, b: 24 };

function scale(v, lo, hi, a, b) {
  if (hi === lo) return (a + b) / 2;
  return a + ((v - lo) / (hi - lo)) * (b - a);
}

function TrendChart({ matches }) {
  const pts = useMemo(() => [...matches].reverse(), [matches]);
  const ratings = pts.map((m) => m.rating);
  const rLo = Math.min(0.5, ...ratings);
  const rHi = Math.max(1.6, ...ratings);
  const x = (i) => scale(i, 0, Math.max(1, pts.length - 1), PAD.l, W - PAD.r);
  const yR = (v) => scale(v, rLo, rHi, H - PAD.b, PAD.t);
  const yK = (v) => scale(v, 0, 100, H - PAD.b, PAD.t);
  const path = (fn, key) =>
    pts
      .map((m, i) => (m[key] == null ? null : `${x(i).toFixed(1)},${fn(m[key]).toFixed(1)}`))
      .filter(Boolean)
      .join(" ");

  return (
    <svg className="demo-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rating and KAST per match">
      <line x1={PAD.l} x2={W - PAD.r} y1={yR(1)} y2={yR(1)} className="demo-chart-ref" />
      <text x={PAD.l - 6} y={yR(1) + 4} className="demo-chart-axis" textAnchor="end">1.00</text>
      <text x={W - PAD.r + 6} y={yK(70) + 4} className="demo-chart-axis">70%</text>
      <line x1={PAD.l} x2={W - PAD.r} y1={yK(70)} y2={yK(70)} className="demo-chart-ref demo-chart-ref-kast" />
      <polyline points={path(yK, "kast")} className="demo-line-kast" />
      <polyline points={path(yR, "rating")} className="demo-line-rating" />
      {pts.map((m, i) => (
        <circle key={m.match_id} cx={x(i)} cy={yR(m.rating)} r="3.5" className={m.result === "win" ? "demo-dot-win" : "demo-dot-loss"}>
          <title>{`${m.map || "?"} · ${m.score || ""} · rating ${m.rating.toFixed(2)} · KAST ${m.kast ?? "—"}%`}</title>
        </circle>
      ))}
    </svg>
  );
}

export default function DemoTrends({ nickname }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setData(null);
    fetchDemoMatches(nickname)
      .then((j) => alive && setData(j))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [nickname]);

  if (loading) return <div className="demo-card demo-muted">Loading demo trends…</div>;
  if (error) return <div className="demo-card demo-status-error">{error}</div>;
  const matches = data?.matches || [];
  if (!matches.length) {
    return (
      <div className="demo-card demo-muted">
        No parsed demos yet. Open a match and press “Parse this demo” to start building a trend.
      </div>
    );
  }

  const avg = (key) => {
    const vals = matches.map((m) => m[key]).filter((v) => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const ar = avg("rating");
  const ak = avg("kast");

  return (
    <div className="demo-card">
      <div className="demo-card-head">
        <div>
          <div className="demo-title">Rating &amp; KAST trend</div>
          <div className="demo-sub">
            Last {matches.length} parsed matches · avg rating {ar != null ? ar.toFixed(2) : "—"} · avg KAST{" "}
            {ak != null ? `${ak.toFixed(1)}%` : "—"}
          </div>
        </div>
        <div className="demo-legend">
          <span><i className="demo-key demo-key-rating" />Rating</span>
          <span><i className="demo-key demo-key-kast" />KAST</span>
        </div>
      </div>
      {matches.length > 1 ? <TrendChart matches={matches} /> : <div className="demo-muted">One parsed match so far. Parse more to see a trend.</div>}
      <div className="demo-table-wrap">
        <table className="demo-table">
          <thead>
            <tr>
              <th className="demo-left">Map</th>
              <th>Score</th>
              <th>Rating</th>
              <th>KAST</th>
              <th>Open</th>
              <th>Trades</th>
              <th>Clutch</th>
              <th>Flash eff.</th>
              <th>Eco won</th>
              <th>Full buy won</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.match_id}>
                <td className="demo-left">{m.map || "—"}</td>
                <td className={m.result === "win" ? "demo-good" : m.result === "loss" ? "demo-bad" : ""}>{m.score || "—"}</td>
                <td className="demo-strong">{m.rating.toFixed(2)}</td>
                <td>{m.kast != null ? `${m.kast}%` : "—"}</td>
                <td>{`${m.opening_kills}/${m.opening_deaths}`}</td>
                <td>{`${m.trade_kills}/${m.traded_deaths}`}</td>
                <td>{`${m.clutch_won}/${m.clutch_attempts}`}</td>
                <td>{m.utility?.flash_efficiency ?? "—"}</td>
                <td>{m.economy ? `${m.economy.eco.wins}/${m.economy.eco.rounds}` : "—"}</td>
                <td>{m.economy ? `${m.economy.full_buy.wins}/${m.economy.full_buy.rounds}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
