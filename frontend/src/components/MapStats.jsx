// Per-map accent colors + short codes for the generated thumbnails.
const MAP_META = {
  de_mirage:   { c: "#e8b84b", code: "MRG" },
  de_inferno:  { c: "#e5622e", code: "INF" },
  de_nuke:     { c: "#5bb6d6", code: "NUK" },
  de_overpass: { c: "#7fae52", code: "OVP" },
  de_vertigo:  { c: "#8a8f98", code: "VTG" },
  de_ancient:  { c: "#3fa46a", code: "ANC" },
  de_anubis:   { c: "#d4a24e", code: "ANB" },
  de_dust2:    { c: "#d8b46a", code: "DST" },
  de_train:    { c: "#6b7784", code: "TRN" },
  de_cache:    { c: "#c98a3c", code: "CCH" },
  de_cbble:    { c: "#7d9b4e", code: "CBL" },
};

function metaFor(map) {
  const key = (map || "").toLowerCase();
  if (MAP_META[key]) return MAP_META[key];
  const code = key.replace(/^de_/, "").slice(0, 3).toUpperCase() || "MAP";
  return { c: "var(--accent)", code };
}

function Thumb({ map }) {
  const { c, code } = metaFor(map);
  return (
    <span className="map-thumb" style={{ "--mc": c }}>
      <span className="map-thumb-code">{code}</span>
    </span>
  );
}

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
          <div className="map-row2" key={m.map}>
            <Thumb map={m.map} />
            <div className="map-row2-main">
              <div className="map-row2-top">
                <span className="map-name">{(m.map || "").replace(/^de_/, "")}</span>
                <span className="map-wr" style={{ color }}>{m.win_rate ?? "—"}%</span>
              </div>
              <div className="map-bar-track">
                <div
                  className="map-bar-fill"
                  style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${color}` }}
                />
              </div>
            </div>
            <span className="map-count">{m.matches}m</span>
          </div>
        );
      })}
    </div>
  );
}
