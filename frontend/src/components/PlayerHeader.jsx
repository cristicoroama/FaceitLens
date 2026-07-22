import CountUp from "./CountUp.jsx";
import LevelProgress from "./LevelProgress.jsx";
import { FaceitLevel, Flag } from "./RankIcons.jsx";

/** Quick-stat cell for the hero strip. */
function PS({ label, value, tone }) {
  return (
    <div className="ps">
      <div className={`ps-val ${tone || ""}`}>{value ?? "—"}</div>
      <div className="ps-label">{label}</div>
    </div>
  );
}

export default function PlayerHeader({ player, children }) {
  const s = player.stats || {};
  const wr = s.win_rate != null ? Number(s.win_rate) : null;
  const kd = s.avg_kd != null ? Number(s.avg_kd) : null;
  const streak = player.streak
    ? `${player.streak.count}${player.streak.type}`
    : s.current_win_streak != null
    ? `${s.current_win_streak}W`
    : null;
  const streakTone = player.streak
    ? player.streak.type === "W"
      ? "pos"
      : "neg"
    : undefined;

  return (
    <div className="player-hero">
      <div className="ph-top">
        <div className="ph-avatar">
          {player.avatar ? (
            <img src={player.avatar} alt={player.nickname} />
          ) : (
            <div className="ph-avatar-empty" />
          )}
          <div className="ph-lvl">
            <FaceitLevel level={player.skill_level} size={36} />
          </div>
        </div>

        <div className="ph-info">
          <div className="ph-name">
            {player.nickname}
            {player.verified && (
              <span className="acct-badge verified" title="Verified FACEIT account">✓ Verified</span>
            )}
            {player.memberships && player.memberships.some((m) => /premium/i.test(m)) && (
              <span className="acct-badge premium" title="FACEIT Premium member">Premium</span>
            )}
          </div>
          <div className="ph-meta">
            <span className="ph-country">
              <Flag country={player.country} />
              {player.country ? player.country.toUpperCase() : "—"}
            </span>
            {player.ranking ? (
              <span className="ph-rank">
                #{player.ranking.toLocaleString()} {player.region || ""}
              </span>
            ) : null}
          </div>
        </div>

        <div className="ph-elo">
          <div className="ph-elo-label">Faceit ELO</div>
          <div className="ph-elo-value"><CountUp value={player.elo} /></div>
        </div>
      </div>

      {/* quick-stat strip */}
      <div className="ph-strip">
        <PS label="Matches" value={s.matches} />
        <PS
          label="Win Rate"
          value={wr != null ? `${wr}%` : null}
          tone={wr != null ? (wr >= 50 ? "pos" : "neg") : undefined}
        />
        <PS
          label="K/D"
          value={kd}
          tone={kd != null ? (kd >= 1 ? "pos" : "neg") : undefined}
        />
        <PS label="HS%" value={s.avg_hs != null ? `${s.avg_hs}%` : null} />
        <PS label="Streak" value={streak} tone={streakTone} />
      </div>

      {/* level progress lives inside the hero now */}
      <div className="ph-progress">
        <LevelProgress elo={player.elo} level={player.skill_level} bare />
      </div>

      {children && <div className="ph-actions">{children}</div>}
    </div>
  );
}
