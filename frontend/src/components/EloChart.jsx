import { useId } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { fmtDate } from "../stats-format.js";
import { useReducedMotion } from "./StatsMotion.js";
import "../styles/stats.css";

function mergeByTime(valid) {
  const rows = new Map();
  valid.forEach((s, si) => {
    s.data.forEach((pt) => {
      if (pt == null || pt.date == null || pt.elo == null) return;
      const key = Number(pt.date);
      if (!rows.has(key)) rows.set(key, { t: key });
      rows.get(key)[`s${si}`] = pt.elo;
    });
  });
  return [...rows.values()].sort((a, b) => a.t - b.t);
}

export default function EloChart({ series }) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const reduced = useReducedMotion();
  const valid = (series || []).filter((s) => s.data && s.data.length > 0);
  const merged = mergeByTime(valid);

  if (valid.length === 0) {
    return (
      <div className="state" style={{ padding: "30px 0" }}>
        Not enough matches for the ELO chart.
      </div>
    );
  }

  const nameOf = (key) => valid[Number(String(key).slice(1))]?.name || key;

  return (
    <>
      <div className="section-title">ELO Progression (approx.)</div>
      <div className="chart-wrap">
        {valid.length > 1 && (
          <ul className="elo-legend" aria-label="Players">
            {valid.map((s) => (
              <li key={s.name}>
                <span className="elo-legend-swatch" style={{ background: s.color }} aria-hidden="true" />
                {s.name}
              </li>
            ))}
          </ul>
        )}
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={merged} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
            <defs>
              {valid.map((s, i) => (
                <linearGradient id={`elo-grad-${uid}-${i}`} key={i} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tick={{ fill: "var(--text-dim)", fontSize: 11 }}
              tickFormatter={(t) => fmtDate(t)}
              minTickGap={28}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              domain={["dataMin - 30", "dataMax + 30"]}
              tick={{ fill: "var(--text-dim)", fontSize: 11 }}
              width={48}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--bg-elev-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                fontSize: 13,
              }}
              labelFormatter={(t) => fmtDate(t, { day: "2-digit", month: "short", year: "numeric" })}
              formatter={(value, key) => [value, nameOf(key)]}
            />
            {valid.map((s, i) => (
              <Area
                key={s.name}
                name={s.name}
                type="monotone"
                dataKey={`s${i}`}
                stroke={s.color}
                strokeWidth={2.5}
                fill={`url(#elo-grad-${uid}-${i})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls
                isAnimationActive={!reduced}
                animationDuration={900}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
