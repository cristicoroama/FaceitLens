export default function TeammatesFull({ mates }) {
  if (!mates || mates.length === 0) {
    return <div className="state">No teammates found in recent matches.</div>;
  }
  return (
    <>
      <div className="section-title">Teammates ({mates.length})</div>
      <div className="mates">
        {mates.map((m) => (
          <div className="mate-row" key={m.nickname}>
            <span className="mate-name">{m.nickname}</span>
            <span className="mate-wr" style={{ color: m.win_rate >= 50 ? "var(--win)" : "var(--loss)" }}>
              {m.win_rate}% WR
            </span>
            <span className="mate-games">{m.games} games</span>
          </div>
        ))}
      </div>
    </>
  );
}
