import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from "recharts";

const ROWS = [
  { key: "elo", label: "ELO", top: "high" },
  { key: "skill_level", label: "Level", top: "high" },
  { key: "matches", label: "Matches", stat: true },
  { key: "win_rate", label: "Win Rate %", stat: true, top: "high" },
  { key: "avg_kd", label: "Avg K/D", stat: true, top: "high" },
  { key: "avg_hs", label: "Avg HS %", stat: true, top: "high" },
  { key: "longest_win_streak", label: "Best Streak", stat: true, top: "high" },
];

function val(player, row) {
  const raw = row.stat ? player.stats?.[row.key] : player[row.key];
  return raw == null || raw === "" ? null : raw;
}

function winner(a, b, higherIsBetter) {
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (isNaN(na) || isNaN(nb) || na === nb) return null;
  if (higherIsBetter) return na > nb ? "a" : "b";
  return na < nb ? "a" : "b";
}

// Normalize each metric to 0-100 for the radar.
function radarData(a, b) {
  const num = (p, k, stat) => parseFloat(stat ? p.stats?.[k] : p[k]) || 0;
  const axes = [
    { axis: "ELO", a: num(a, "elo") / 3000 * 100, b: num(b, "elo") / 3000 * 100 },
    { axis: "Win%", a: num(a, "win_rate", true), b: num(b, "win_rate", true) },
    { axis: "K/D", a: Math.min(num(a, "avg_kd", true) / 2 * 100, 100), b: Math.min(num(b, "avg_kd", true) / 2 * 100, 100) },
    { axis: "HS%", a: num(a, "avg_hs", true), b: num(b, "avg_hs", true) },
    { axis: "Level", a: num(a, "skill_level") / 10 * 100, b: num(b, "skill_level") / 10 * 100 },
  ];
  return axes.map((x) => ({ axis: x.axis, [a.nickname]: Math.round(x.a), [b.nickname]: Math.round(x.b) }));
}

export default function CompareView({ a, b }) {
  const data = radarData(a, b);
  return (
    <div className="compare">
      <div className="compare-head">
        <div className="compare-player">
          {a.avatar && <img src={a.avatar} alt={a.nickname} />}
          <span>{a.nickname}</span>
        </div>
        <span className="compare-vs">VS</span>
        <div className="compare-player right">
          <span>{b.nickname}</span>
          {b.avatar && <img src={b.avatar} alt={b.nickname} />}
        </div>
      </div>

      <div className="compare-radar">
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--text-dim)", fontSize: 12 }} />
            <Radar name={a.nickname} dataKey={a.nickname} stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} animationDuration={800} />
            <Radar name={b.nickname} dataKey={b.nickname} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} animationDuration={800} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {ROWS.map((row) => {
        const va = val(a, row);
        const vb = val(b, row);
        const w = row.top === "high" ? winner(va, vb, true) : null;
        return (
          <div className="compare-row" key={row.key}>
            <span className={`compare-val ${w === "a" ? "best" : ""}`}>{va ?? "—"}</span>
            <span className="compare-label">{row.label}</span>
            <span className={`compare-val right ${w === "b" ? "best" : ""}`}>{vb ?? "—"}</span>
          </div>
        );
      })}
    </div>
  );
}
