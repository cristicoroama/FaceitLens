export default function BestTeammates({ mates }) {
  if (!mates || mates.length === 0) return null;
  return (
    <>
      <div className="section-title">Best Teammates</div>
      <div className="mates">
        {mates.map((m) => (
          <div className="mate-row" key={m.nickname}>
            <span className="mate-name">{m.nickname}</span>
            <span className="mate-wr">{m.win_rate}% WR</span>
            <span className="mate-games">{m.games} games</span>
          </div>
        ))}
      </div>
    </>
  );
}
