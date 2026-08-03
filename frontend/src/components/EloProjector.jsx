import { FaceitLevel } from "./RankIcons.jsx";

// FACEIT CS2 level lower-bounds (level 1..10).
const THRESHOLDS = [100, 501, 751, 901, 1051, 1201, 1351, 1531, 1751, 2001];
// Typical FACEIT ELO swing per match (win/loss) hovers around 25.
const ELO_PER_WIN = 25;

function levelFromElo(elo) {
  let lvl = 1;
  for (let i = 0; i < THRESHOLDS.length; i++) if (elo >= THRESHOLDS[i]) lvl = i + 1;
  return lvl;
}

/**
 * "How many wins to the next levels?" — estimates net wins needed from the
 * current ELO, adjusted by recent win rate (a 50% player nets 0 ELO, so the
 * required *played* games scale up the closer they are to a coin flip).
 */
export default function EloProjector({ elo, winRate }) {
  const e = Number(elo);
  if (!Number.isFinite(e)) return null;

  const curLevel = levelFromElo(e);
  const wr = winRate != null ? Math.max(0, Math.min(100, Number(winRate))) : null;

  // net ELO per *played* game given a win rate (win +25, loss -25)
  const net = wr != null ? (wr / 100) * ELO_PER_WIN - (1 - wr / 100) * ELO_PER_WIN : null;

  // show the next 3 levels (or up to 10)
  const targets = [];
  for (let lvl = curLevel + 1; lvl <= 10 && targets.length < 3; lvl++) {
    const need = THRESHOLDS[lvl - 1] - e; // ELO gap to reach that level's floor
    const netWins = Math.ceil(need / ELO_PER_WIN); // pure wins (no losses)
    // realistic played games given win rate (only if winning overall)
    const games = net && net > 0 ? Math.ceil(need / net) : null;
    targets.push({ lvl, need, netWins, games });
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /><path d="M18 8h2v2" />
          </svg>
        </div>
        <div className="panel-title">ELO Projector</div>
        <div className="panel-sub">wins to next levels</div>
      </div>

      {curLevel >= 10 ? (
        <div className="state" style={{ padding: "16px 0" }}>
          Already level 10 — nothing left to climb. Just don't fall off.
        </div>
      ) : (
        <>
          <div className="elop-grid">
            {targets.map((t) => (
              <div className="elop-card" key={t.lvl}>
                <FaceitLevel level={t.lvl} size={34} />
                <div className="elop-wins">{t.netWins}</div>
                <div className="elop-label">net wins</div>
                <div className="elop-need">+{t.need} ELO</div>
                {t.games != null && (
                  <div className="elop-games">≈ {t.games} games @ {Math.round(wr)}% WR</div>
                )}
              </div>
            ))}
          </div>
          <div className="hltv-note" style={{ padding: "10px 2px 0", textAlign: "left" }}>
            Rough estimate at ~{ELO_PER_WIN} ELO per win.
            {wr != null && wr <= 50 && net != null && net <= 0
              ? " At a sub-50% win rate you're not climbing on average — the “games” figure needs your win rate above 50% first."
              : " “Games” accounts for losses along the way at your recent win rate."}
          </div>
        </>
      )}
    </div>
  );
}
