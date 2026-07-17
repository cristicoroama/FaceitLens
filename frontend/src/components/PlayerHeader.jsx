import SkillBadge from "./SkillBadge.jsx";
import CountUp from "./CountUp.jsx";

// ISO country code -> flag emoji (e.g. "ro" -> 🇷🇴)
function flagEmoji(cc) {
  if (!cc || cc.length !== 2) return null;
  try {
    return String.fromCodePoint(
      ...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))
    );
  } catch {
    return null;
  }
}

export default function PlayerHeader({ player, children }) {
  const flag = flagEmoji(player.country);
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
            <SkillBadge level={player.skill_level} />
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
            <span>
              {flag && <span className="ph-flag">{flag}</span>}
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
