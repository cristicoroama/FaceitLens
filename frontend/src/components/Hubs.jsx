export default function Hubs({ hubs }) {
  if (!hubs || hubs.length === 0) {
    return <div className="state">Not in any hubs (or hubs are private).</div>;
  }
  return (
    <>
      <div className="section-title">Hubs ({hubs.length})</div>
      <div className="mates">
        {hubs.map((h, i) => (
          <div className="mate-row" key={i}>
            <span className="mate-name">{h.name}</span>
            {h.players != null && <span className="mate-games">{h.players} players</span>}
          </div>
        ))}
      </div>
    </>
  );
}
