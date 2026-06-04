export default function MapStats({ maps }) {
  if (!maps || maps.length === 0) return null;
  const top = maps.slice(0, 7);
  return (
    <>
      <div className="section-title">Map Stats</div>
      <div className="maps">
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
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <span className="map-wr">{m.win_rate ?? "—"}%</span>
              <span className="map-count">{m.matches}m</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
