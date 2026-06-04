import SkillBadge from "./SkillBadge.jsx";

export default function Squad({ data }) {
  if (!data || !data.players || data.players.length === 0) return null;
  const ranked = [...data.players].sort((a, b) => (b.elo || 0) - (a.elo || 0));

  return (
    <>
      {data.matches_together > 0 && (
        <div className="squad-summary">
          <div className="squad-summary-item">
            <div className="squad-summary-num">{data.matches_together}</div>
            <div className="squad-summary-label">Matches together</div>
          </div>
          <div className="squad-summary-item">
            <div className="squad-summary-num">{data.win_rate_together ?? "—"}%</div>
            <div className="squad-summary-label">Win rate together</div>
          </div>
          <div className="squad-summary-item">
            <div className="squad-summary-num">{data.wins_together}</div>
            <div className="squad-summary-label">Wins together</div>
          </div>
        </div>
      )}

      <div className="section-title">Squad Leaderboard</div>
      <div className="squad">
        {ranked.map((p, i) => (
          <div className="squad-row" key={p.player_id || p.nickname}>
            <span className="squad-rank">#{i + 1}</span>
            {p.avatar && <img src={p.avatar} alt={p.nickname} className="squad-avatar" />}
            <span className="squad-name">{p.nickname}</span>
            <SkillBadge level={p.skill_level} />
            <span className="squad-elo">{p.elo ?? "—"}</span>
          </div>
        ))}
      </div>
    </>
  );
}
