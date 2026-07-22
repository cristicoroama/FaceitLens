import { useState } from "react";

// Maps we ship a real thumbnail for (public/maps/<name>.webp).
const HAS_IMAGE = new Set([
  "ancient", "anubis", "baggage", "basalt", "dust2", "edin", "inferno",
  "italy", "mills", "mirage", "nuke", "office", "overpass", "palais",
  "pool_day", "shoots", "thera", "train", "vertigo", "whistle",
  "agency", "grail", "jura",
]);

// Fallback accent colors + codes for maps without a shipped image.
const MAP_META = {
  cache: { c: "#c98a3c", code: "CCH" },
  cbble: { c: "#7d9b4e", code: "CBL" },
};

function keyFor(map) {
  return (map || "").toLowerCase().replace(/^(de|cs)_/, "").replace(/\s+/g, "_");
}

function codeFor(map) {
  const k = keyFor(map);
  if (MAP_META[k]) return MAP_META[k];
  return { c: "var(--accent)", code: k.replace(/_/g, "").slice(0, 3).toUpperCase() || "MAP" };
}

function Thumb({ map }) {
  const key = keyFor(map);
  const [failed, setFailed] = useState(false);

  if (HAS_IMAGE.has(key) && !failed) {
    return (
      <span className="map-thumb img">
        <img src={`/maps/${key}.webp`} alt={map} loading="lazy" onError={() => setFailed(true)} />
      </span>
    );
  }
  const { c, code } = codeFor(map);
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
