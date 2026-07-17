import CountUp from "./CountUp.jsx";
import { FaceitLevel, Flag } from "./RankIcons.jsx";

export default function PlayerHeader({ player, children }) {
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

      {children && <div className="ph-actions">{children}</div>}
    </div>
  );
}
