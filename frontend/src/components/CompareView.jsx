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

// Compare two numeric values; returns 'a', 'b' or null (tie).
function winner(a, b, higherIsBetter) {
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (isNaN(na) || isNaN(nb) || na === nb) return null;
  if (higherIsBetter) return na > nb ? "a" : "b";
  return na < nb ? "a" : "b";
}

export default function CompareView({ a, b }) {
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

      {ROWS.map((row) => {
        const va = val(a, row);
        const vb = val(b, row);
        const w = row.top === "high" ? winner(va, vb, true) : null;
        return (
          <div className="compare-row" key={row.key}>
            <span className={`compare-val ${w === "a" ? "best" : ""}`}>
              {va ?? "—"}
            </span>
            <span className="compare-label">{row.label}</span>
            <span className={`compare-val right ${w === "b" ? "best" : ""}`}>
              {vb ?? "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
