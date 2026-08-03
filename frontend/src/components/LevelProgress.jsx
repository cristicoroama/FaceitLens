import { FaceitLevel, ChallengerBadge } from "./RankIcons.jsx";

// FACEIT CS2 ELO level lower-bounds (level 1..10)
const THRESHOLDS = [100, 501, 751, 901, 1051, 1201, 1351, 1531, 1751, 2001];

/** `challenger` is a ranking position (top 1,000 of the region), not a level —
    it's shown past the level-10 tick because it sits above that whole pool. */
export default function LevelProgress({ elo, level, bare, challenger }) {
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
