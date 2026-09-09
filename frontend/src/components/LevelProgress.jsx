import { FaceitLevel, ChallengerBadge } from "./RankIcons.jsx";

// FACEIT CS2 ELO level lower-bounds (level 1..10)
const THRESHOLDS = [100, 501, 751, 901, 1051, 1201, 1351, 1531, 1751, 2001];

/** `challenger` is a ranking position (top 1,000 of the region), not a level —
    it's shown past the level-10 tick because it sits above that whole pool. */
/* Both ends of the scale keep their decimals, and for the same reason: the gap
   between 0.9% and 0.01% is the whole point down there, and rounding 99.99 up
   would print "better than 100% of players", which is never true of anyone —
   the player is in the pool being measured. */
function fmtPct(v) {
  if (v == null) return null;
  if (v < 1) return v.toFixed(2);
  if (v < 10) return v.toFixed(1);
  // Floored, not rounded, so the figure never overstates the player. String()
  // drops a trailing zero that toFixed would leave ("99.4", not "99.40").
  if (v > 99) return String(Math.min(99.99, Math.floor(v * 100) / 100));
  return Math.round(v);
}

export default function LevelProgress({ elo, level, bare, challenger, percentile, region }) {
  const e = Number(elo);
  if (!Number.isFinite(e)) return null;

  // current level index from elo
  let lvl = 1;
  for (let i = 0; i < THRESHOLDS.length; i++) if (e >= THRESHOLDS[i]) lvl = i + 1;

  const isMax = lvl >= 10;
  const lower = THRESHOLDS[lvl - 1];
  const upper = isMax ? lower : THRESHOLDS[lvl];
  const within = isMax ? 1 : Math.max(0, Math.min(1, (e - lower) / (upper - lower)));
  // Ticks 1..10 are evenly spaced, so tick i sits at (i-1)/9 of the width.
  // Fill reaches the current level's tick plus progress toward the next one.
  const pct = isMax ? 100 : ((lvl - 1) + within) / 9 * 100;
  const need = isMax ? 0 : upper - e;

  const body = (
    <>
      <div className="lvlprog-text">
        {isMax ? (
          <>Level 10 — top tier ({e} ELO)</>
        ) : (
          <>To reach <b>level {lvl + 1}</b> you need <b>{need}</b> more ELO</>
        )}
        {/* The rank this bar draws is only half the story: #4,120 is elite in
            one region and mid-table in another. The percentile is the half
            people can actually read, so it rides on the same line. */}
        {percentile?.better_than != null && (
          <span
            className="lvlprog-pct"
            title={`#${percentile.position.toLocaleString()} of ${percentile.population.toLocaleString()} ranked players${region ? ` in ${region}` : ""}`}
          >
            better than <b>{fmtPct(percentile.better_than)}%</b>
            {region ? ` of ${region} players` : " of ranked players"}
          </span>
        )}
      </div>
      <div className="lvlprog-track">
        <div className="lvlprog-fill" style={{ width: `${pct}%` }} />
      </div>
      {/* Bare numbers meant nothing to anyone who reads FACEIT by its rank
          art. The icons ARE the scale; the current one is highlighted. */}
      <div className="lvlprog-scale">
        {THRESHOLDS.map((t, i) => (
          <span
            key={t}
            className={`lvlprog-tick ${i + 1 === lvl ? "cur" : ""}`}
            title={`Level ${i + 1} — ${t}+ ELO`}
          >
            <FaceitLevel level={i + 1} size={22} />
          </span>
        ))}
        {/* Challenger sits past level 10: it's the top 1,000 of that pool. */}
        {challenger ? (
          <span className="lvlprog-tick cur challenger" title={`Challenger — #${challenger}`}>
            <ChallengerBadge position={challenger} size={18} />
          </span>
        ) : null}
      </div>
    </>
  );

  // `bare` renders without the glass card wrapper (embedded in the hero)
  if (bare) return body;
  return <div className="lvlprog">{body}</div>;
}
