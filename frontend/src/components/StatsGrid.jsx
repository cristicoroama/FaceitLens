const FIELDS = [
  { key: "matches", label: "Matches" },
  { key: "win_rate", label: "Win Rate", suffix: "%" },
  { key: "avg_kd", label: "Avg K/D" },
  { key: "avg_hs", label: "Avg HS", suffix: "%" },
  { key: "current_win_streak", label: "Win Streak" },
  { key: "longest_win_streak", label: "Best Streak" },
];

export default function StatsGrid({ stats }) {
  return (
    <div className="stats-grid">
      {FIELDS.map((f) => {
        const raw = stats?.[f.key];
        const value = raw == null || raw === "" ? "—" : `${raw}${f.suffix ?? ""}`;
        return (
          <div className="stat" key={f.key}>
            <div className="label">{f.label}</div>
            <div className="value">{value}</div>
          </div>
        );
      })}
    </div>
  );
}
