export default function MultiKills({ mk }) {
  if (!mk) return null;
  const cells = [
    { label: "Triple", total: mk.triple_total, avg: mk.triple_avg },
    { label: "Quad", total: mk.quadro_total, avg: mk.quadro_avg },
    { label: "Ace (5K)", total: mk.penta_total, avg: mk.penta_avg },
  ];
  return (
    <>
      <div className="section-title">Multi-Kills (last {mk.matches} matches)</div>
      <div className="ravg">
        {cells.map((c) => (
          <div className="ravg-cell" key={c.label}>
            <div className="ravg-value">{c.total}</div>
            <div className="ravg-label">{c.label} · {c.avg}/match</div>
          </div>
        ))}
      </div>
    </>
  );
}
