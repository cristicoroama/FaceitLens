import SkillBadge from "./SkillBadge.jsx";
import CountUp from "./CountUp.jsx";

export default function PlayerHeader({ player }) {
  return (
    <div className="player-head">
      {player.avatar ? (
        <img src={player.avatar} alt={player.nickname} />
      ) : (
        <div className="player-avatar-empty" />
      )}
      <div className="player-head-info">
        <div className="player-name">
          {player.nickname}
          <SkillBadge level={player.skill_level} />
          {player.verified && (
            <span className="acct-badge verified" title="Verified FACEIT account">✓ Verified</span>
          )}
          {player.memberships && player.memberships.some((m) => /premium/i.test(m)) && (
            <span className="acct-badge premium" title="FACEIT Premium member">Premium</span>
          )}
        </div>
        <div className="player-meta">
          {player.country ? player.country.toUpperCase() : "—"}
          {player.ranking ? (
            <span className="player-rank">
              #{player.ranking.toLocaleString()} {player.region || ""}
            </span>
          ) : null}
        </div>
      </div>
      <div className="elo-badge">
        <div className="lvl">ELO</div>
        <div className="elo"><CountUp value={player.elo} /></div>
      </div>
    </div>
  );
}
