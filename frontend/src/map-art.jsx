import { useState } from "react";

/**
 * Map artwork, shared by the map-stats panel and the match list.
 *
 * Pictures live in public/maps/<key>.webp. HAS_IMAGE gates the <img> so a map
 * we ship no art for never fires a 404 on every render; the onError below is
 * the second net, for a name in the list whose file went missing.
 */
const HAS_IMAGE = new Set([
  "agency", "ancient", "anubis", "baggage", "basalt", "cache", "dust2",
  "edin", "grail", "inferno", "italy", "jura", "mills", "mirage", "nuke",
  "office", "overpass", "palais", "pool_day", "shoots", "thera", "train",
  "vertigo", "whistle",
]);

/* Accent + three-letter code for the maps we have no picture for. Cobblestone
   still turns up in old match history, so it gets a real colour rather than
   the generic accent. */
const MAP_META = {
  cbble: { c: "#7d9b4e", code: "CBL" },
  dogtown: { c: "#b5643c", code: "DGT" },
  tuscan: { c: "#c2a35a", code: "TSC" },
};

/* Names that don't survive a naive capitalisation. */
const LABELS = {
  dust2: "Dust2",
  cbble: "Cobblestone",
  pool_day: "Pool Day",
  office: "Office",
  italy: "Italy",
};

export function mapKey(map) {
  return (map || "").toLowerCase().replace(/^(de|cs|ar)_/, "").replace(/\s+/g, "_");
}

/** "de_dust2" -> "Dust2", "de_ancient" -> "Ancient". */
export function mapLabel(map) {
  const k = mapKey(map);
  if (!k) return "Unknown";
  return LABELS[k] || k.charAt(0).toUpperCase() + k.slice(1);
}

function codeFor(key) {
  if (MAP_META[key]) return MAP_META[key];
  return {
    c: "var(--accent)",
    code: key.replace(/_/g, "").slice(0, 3).toUpperCase() || "MAP",
  };
}

export function MapThumb({ map, className = "" }) {
  const key = mapKey(map);
  const [failed, setFailed] = useState(false);

  if (HAS_IMAGE.has(key) && !failed) {
    return (
      <span className={`map-thumb img ${className}`}>
        <img
          src={`/maps/${key}.webp`}
          alt={mapLabel(map)}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }
  const { c, code } = codeFor(key);
  return (
    <span className={`map-thumb ${className}`} style={{ "--mc": c }}>
      <span className="map-thumb-code">{code}</span>
    </span>
  );
}

export default MapThumb;
