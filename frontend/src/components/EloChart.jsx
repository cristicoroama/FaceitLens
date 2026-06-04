import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

function fmt(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function EloChart({ series }) {
  const valid = (series || []).filter((s) => s.data && s.data.length > 0);
  if (valid.length === 0) {
    return (
      <div className="state" style={{ padding: "30px 0" }}>
        Not enough matches for the ELO chart.
      </div>
    );
  }

  const maxLen = Math.max(...valid.map((s) => s.data.length));
  const merged = [];
  for (let i = 0; i < maxLen; i++) {
    const row = { idx: i };
    valid.forEach((s) => {
      if (s.data[i]) {
        row[s.name] = s.data[i].elo;
        row[`${s.name}_date`] = s.data[i].date;
      }
    });
    merged.push(row);
  }

  return (
    <>
      <div className="section-title">ELO Progression (approx.)</div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={merged} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
            <defs>
              {valid.map((s, i) => (
                <linearGradient id={`grad${i}`} key={i} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="idx"
              tick={{ fill: "var(--text-dim)", fontSize: 11 }}
              tickFormatter={(i) => {
                const d = merged[i]?.[`${valid[0].name}_date`];
                return d ? fmt(d) : "";
              }}
              interval="preserveStartEnd"
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
              labelFormatter={(i) => {
                const d = merged[i]?.[`${valid[0].name}_date`];
                return d ? fmt(d) : `Match ${i + 1}`;
              }}
            />
            {valid.map((s, i) => (
              <Area
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={s.color}
                strokeWidth={2.5}
                fill={`url(#grad${i})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls
                animationDuration={900}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
