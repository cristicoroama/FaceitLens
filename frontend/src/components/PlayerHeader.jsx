import SkillBadge from "./SkillBadge.jsx";

export default function PlayerHeader({ player }) {
  return (
    <div className="player-head">
      {player.avatar ? (
        <img src={player.avatar} alt={player.nickname} />
      ) : (
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 8,
            background: "var(--bg-elev-2)",
          }}
        />
      )}
      <div>
        <div className="player-name">
          {player.nickname}
          <SkillBadge level={player.skill_level} />
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
        <div className="elo">{player.elo ?? "—"}</div>
      </div>
    </div>
  );
}
