import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";

import { Icon } from "../icons.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

const RANGES = [
  ["7", "7D"], ["30", "30D"], ["90", "90D"], ["all", "All"],
];

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** A signed number that colours itself, or an em dash when we don't know yet. */
function Delta({ value, suffix = "" }) {
  if (value === null || value === undefined) return <span className="ep-dash">—</span>;
  const cls = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const sign = value > 0 ? "+" : "";
  return <span className={`ep-delta ${cls}`}>{sign}{value}{suffix}</span>;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ep-tip">
      <div className="ep-tip-date">{fmtDate(label)}</div>
      <div className="ep-tip-elo">{payload[0].value.toLocaleString()} ELO</div>
    </div>
  );
}

/**
 * The long-run ELO chart for a member.
 *
 * Members get snapshotted daily, so unlike the usual "last 30 matches" chart
 * this is a real timeline — including the days they didn't play.
 */
export default function EloProgress({ handle, isOwner }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30");

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/profile/${encodeURIComponent(handle)}/progress/`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => !cancelled && setData(j))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [handle]);

  const points = useMemo(() => {
    if (!data?.points?.length) return [];
    if (range === "all") return data.points;
    const days = parseInt(range, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const inRange = data.points.filter((p) => new Date(p.date) >= cutoff);
    // Always show something, even if the window is emptier than the range.
    return inRange.length >= 2 ? inRange : data.points.slice(-Math.max(2, days));
  }, [data, range]);

  if (loading) return <div className="panel"><div className="skeleton tall" /></div>;
  if (!data?.tracking) return null;

  const s = data.stats;

  // Fewer than two readings: nothing to plot yet, so explain rather than
  // showing an empty chart.
  if (!s || points.length < 2) {
    return (
      <div className="panel">
        <div className="panel-head"><h2 className="panel-title">ELO progress</h2></div>
        <div className="empty-state">
          <div className="empty-ico">{Icon.graphUpArrow}</div>
          <h3>Building your history</h3>
          <p>
            {isOwner
              ? "We record your ELO once a day. Come back tomorrow and your chart starts filling in — over a few weeks it becomes a real record of your climb."
              : "Not enough readings yet to draw a chart."}
          </p>
          {s?.current && (
            <div className="ep-first">
              Today: <b>{s.current.toLocaleString()} ELO</b> · Level {s.level}
            </div>
          )}
        </div>
      </div>
    );
  }

  const elos = points.map((p) => p.elo);
  const lo = Math.min(...elos);
  const hi = Math.max(...elos);
  const pad = Math.max(25, Math.round((hi - lo) * 0.18));
  const rising = points[points.length - 1].elo >= points[0].elo;
  const stroke = rising ? "var(--accent)" : "#ff6b81";

  return (
    <div className="panel ep-panel">
      <div className="panel-head">
        <h2 className="panel-title">ELO progress</h2>
        <div className="ep-ranges">
          {RANGES.map(([val, lbl]) => (
            <button
              key={val}
              className={`ep-range ${range === val ? "on" : ""}`}
              onClick={() => setRange(val)}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* --- headline numbers ------------------------------------------- */}
      <div className="ep-stats">
        <div className="ep-stat main">
          <div className="ep-stat-val">{s.current.toLocaleString()}</div>
          <div className="ep-stat-lbl">Current · Level {s.level}</div>
        </div>
        {/* The two deltas follow the selected range, so the numbers always
            describe the period you're actually looking at. */}
        {(range === "90" || range === "all"
          ? [["30 days", s.change_30d], ["90 days", s.change_90d]]
          : [["7 days", s.change_7d], ["30 days", s.change_30d]]
        ).map(([label, value]) => (
          <div className="ep-stat" key={label}>
            <div className="ep-stat-val"><Delta value={value} /></div>
            <div className="ep-stat-lbl">{label}</div>
          </div>
        ))}
        <div className="ep-stat">
          <div className="ep-stat-val ep-peak">{s.peak.elo.toLocaleString()}</div>
          <div className="ep-stat-lbl">Peak · {fmtDate(s.peak.date)}</div>
        </div>
      </div>

      {/* --- the chart ---------------------------------------------------- */}
      <div className="ep-chart">
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={points} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="epFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fill: "var(--text-dim)", fontSize: 11 }}
              stroke="var(--border)"
              minTickGap={28}
            />
            <YAxis
              domain={[lo - pad, hi + pad]}
              tick={{ fill: "var(--text-dim)", fontSize: 11 }}
              stroke="var(--border)"
              width={52}
            />
            <Tooltip content={<ChartTooltip />} />
            {s.peak.elo <= hi && s.peak.elo >= lo && (
              <ReferenceLine
                y={s.peak.elo}
                stroke="var(--accent-2)"
                strokeDasharray="4 4"
                strokeOpacity={0.55}
              />
            )}
            <Area
              type="monotone"
              dataKey="elo"
              stroke={stroke}
              strokeWidth={2.4}
              fill="url(#epFill)"
              dot={points.length <= 40 ? { r: 2.5, fill: stroke, strokeWidth: 0 } : false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--bg)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* --- the interesting bits ---------------------------------------- */}
      <div className="ep-facts">
        {s.to_next_level !== null && s.to_next_level > 0 && (
          <span className="ep-fact">
            <b>{s.to_next_level}</b> ELO to level {s.next_level}
          </span>
        )}
        {s.streak > 1 && (
          <span className="ep-fact">
            <b>{s.streak}</b> days without dropping
          </span>
        )}
        {s.best_day && (
          <span className="ep-fact">
            Best day <b className="ep-delta up">+{s.best_day.delta}</b> on {fmtDate(s.best_day.date)}
          </span>
        )}
        <span className="ep-fact dim">
          Tracked {s.days_tracked} day{s.days_tracked === 1 ? "" : "s"} since {fmtDate(s.since)}
        </span>
      </div>
    </div>
  );
}
