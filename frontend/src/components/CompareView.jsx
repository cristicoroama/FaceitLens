import { FaceitLevel } from "./RankIcons.jsx";

const ROWS = [
  { key: "elo", label: "ELO", better: "high" },
  { key: "skill_level", label: "Level", better: "high" },
  { key: "matches", label: "Matches", stat: true, better: null },
  { key: "win_rate", label: "Win Rate", stat: true, better: "high", suffix: "%" },
  { key: "avg_kd", label: "Avg K/D", stat: true, better: "high" },
  { key: "avg_hs", label: "Avg HS", stat: true, better: "high", suffix: "%" },
  { key: "current_win_streak", label: "Win Streak", stat: true, better: "high" },
  { key: "longest_win_streak", label: "Best Streak", stat: true, better: "high" },
];

function raw(player, row) {
  const v = row.stat ? player.stats?.[row.key] : player[row.key];
  return v == null || v === "" ? null : v;
}

function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

/** Index(es) of the best value in a row (ties highlight all). */
function bestIndexes(players, row) {
  if (!row.better) return new Set();
  const nums = players.map((p) => {
    const v = parseFloat(raw(p, row));
    return isNaN(v) ? null : v;
  });
  const valid = nums.filter((n) => n != null);
  if (valid.length < 2) return new Set();
  const target = row.better === "high" ? Math.max(...valid) : Math.min(...valid);
  const out = new Set();
  nums.forEach((n, i) => { if (n === target) out.add(i); });
  return out;
}

export default function CompareView({ players, onPick }) {
  // Back-compat: also accept the old {a, b} shape.
  const list = players.filter(Boolean);
  if (list.length < 2) return null;

  return (
    <div className="cmp">
      <div className="cmp-grid" style={{ "--cols": list.length }}>
        {/* header row: player cards */}
        <div className="cmp-cell cmp-corner" />
        {list.map((p, i) => (
          <div className="cmp-head" key={p.nickname} style={{ "--i": i }}>
            <div
              className="cmp-head-inner"
              onClick={() => onPick && onPick(p.nickname)}
              title={`Open ${p.nickname}`}
            >
              {p.avatar ? (
                <img className="cmp-ava" src={p.avatar} alt={p.nickname} />
              ) : (
                <span className="cmp-ava ph">{initials(p.nickname)}</span>
              )}
              <div className="cmp-head-name">{p.nickname}</div>
              <FaceitLevel level={p.skill_level || 1} size={22} />
            </div>
          </div>
        ))}

        {/* metric rows */}
        {ROWS.map((row) => {
          const best = bestIndexes(list, row);
          return (
            <div className="cmp-line" key={row.key} style={{ display: "contents" }}>
              <div className="cmp-cell cmp-label">{row.label}</div>
              {list.map((p, i) => {
                const v = raw(p, row);
                return (
                  <div className={`cmp-cell cmp-val ${best.has(i) ? "best" : ""}`} key={p.nickname}>
                    {v ?? "—"}{v != null && row.suffix ? row.suffix : ""}
                    {best.has(i) && <span className="cmp-crown">▲</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
