export default function RecentAverages({ avg, maps, mapFilter, onMapFilter }) {
  if (!avg) return null;
  const cells = [
    { label: "K/D", value: avg.kd },
    { label: "K/R", value: avg.kr },
    { label: "ADR", value: avg.adr },
    { label: "HS%", value: avg.hs != null ? `${avg.hs}%` : null },
    { label: "Kills", value: avg.kills },
  ];
  return (
    <>
      <div className="ravg-head">
        <div className="section-title" style={{ margin: 0 }}>
          Average (last {avg.matches} {mapFilter ? `on ${mapFilter.replace("de_", "")}` : "matches"})
        </div>
        {maps && maps.length > 0 && (
          <select
            className="map-filter"
            value={mapFilter || ""}
            onChange={(e) => onMapFilter(e.target.value || null)}
          >
            <option value="">All maps</option>
            {maps.map((m) => (
              <option key={m} value={m}>{m.replace("de_", "")}</option>
            ))}
          </select>
        )}
      </div>
      <div className="ravg">
        {cells.map((c) => (
          <div className="ravg-cell" key={c.label}>
            <div className="ravg-value">{c.value ?? "—"}</div>
            <div className="ravg-label">{c.label}</div>
          </div>
        ))}
      </div>
    </>
  );
}
