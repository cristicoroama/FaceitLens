export default function MapStats({ maps }) {
  if (!maps || maps.length === 0) return null;
  const top = maps.slice(0, 7);
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 3-6 2v16l6-2 6 2 6-2V3l-6 2-6-2Z" /><path d="M9 3v16M15 5v16" />
          </svg>
        </div>
        <div className="panel-title">Map Stats</div>
        <div className="panel-sub">win rate</div>
      </div>
      {top.map((m) => {
        const wr = parseFloat(m.win_rate);
        const pct = isNaN(wr) ? 0 : Math.max(0, Math.min(100, wr));
        const color = pct >= 50 ? "var(--win)" : "var(--loss)";
        return (
          <div className="map-row" key={m.map}>
            <span className="map-name">{m.map}</span>
            <div className="map-bar-track">
              <div
                className="map-bar-fill"
                style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${color}` }}
              />
            </div>
            <span className="map-wr" style={{ color }}>{m.win_rate ?? "—"}%</span>
            <span className="map-count">{m.matches}m</span>
          </div>
        );
      })}
    </div>
  );
}
