const FIELDS = [
  { key: "matches", label: "Matches" },
  { key: "win_rate", label: "Win Rate", suffix: "%" },
  { key: "avg_kd", label: "Avg K/D", trendKey: "kd_trend" },
  { key: "avg_hs", label: "Avg HS", suffix: "%" },
  { key: "current_win_streak", label: "Win Streak" },
  { key: "longest_win_streak", label: "Best Streak" },
];

function TrendArrow({ trend }) {
  if (!trend || trend === "flat") return null;
  const up = trend === "up";
  return (
    <span className={`trend ${up ? "up" : "down"}`}>{up ? "▲" : "▼"}</span>
  );
}

export default function StatsGrid({ stats, trends }) {
  return (
    <div className="stats-grid">
      {FIELDS.map((f) => {
        const raw = stats?.[f.key];
        const value = raw == null || raw === "" ? "—" : `${raw}${f.suffix ?? ""}`;
        const trend = f.trendKey ? trends?.[f.trendKey] : null;
        return (
          <div className="stat" key={f.key}>
            <div className="label">{f.label}</div>
            <div className="value">
              {value}
              <TrendArrow trend={trend} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
