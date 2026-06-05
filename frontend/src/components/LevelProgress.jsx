// FACEIT CS2 ELO level lower-bounds (level 1..10)
const THRESHOLDS = [100, 501, 751, 901, 1051, 1201, 1351, 1531, 1751, 2001];

export default function LevelProgress({ elo, level }) {
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

  return (
    <div className="lvlprog">
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
      <div className="lvlprog-scale">
        {THRESHOLDS.map((t, i) => (
          <span key={t} className={`lvlprog-tick ${i + 1 === lvl ? "cur" : ""}`}>{i + 1}</span>
        ))}
      </div>
    </div>
  );
}
