const FIELDS = [
  /* "Matches" here is FACEIT's lifetime count for the CS2 profile, which on a
     migrated account still includes every CS:GO match played before the
     changeover — FACEIT's own page lists the two separately. The title says so,
     because the kills figure two panels down covers CS2 only and the pair
     otherwise reads as a contradiction. */
  { key: "matches", label: "Matches", title: "Lifetime on this account, CS:GO history included" },
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
          <div className="stat" key={f.key} title={f.title || undefined}>
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
