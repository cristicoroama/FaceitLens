import { MapThumb, mapLabel } from "../map-art.jsx";

/**
 * The map this player wins on and the one they don't.
 *
 * Both need a floor on matches played. Without one the "best map" is whatever
 * they happened to win the only time they loaded it, and the card would say
 * 100% on a sample of one — which is the single most misleading number a
 * profile can put in large type.
 */
const MIN_MATCHES = 10;

function Card({ map, kind }) {
  const wr = parseFloat(map.win_rate);
  const facts = [
    `${Number(map.matches).toLocaleString()} matches`,
    map.avg_kd ? `${map.avg_kd} K/D` : null,
    map.adr ? `${Math.round(Number(map.adr))} ADR` : null,
  ].filter(Boolean);

  return (
    <div className={`mhl ${kind}`}>
      <MapThumb map={map.map} className="mhl-art" />
      <div className="mhl-tag">{kind === "best" ? "Best map" : "Weakest map"}</div>
      <div className="mhl-body">
        <div className="mhl-top">
          <span className="mhl-name">{mapLabel(map.map)}</span>
          <span className="mhl-wr">
            {isNaN(wr) ? "—" : `${map.win_rate}%`}
            <i>win rate</i>
          </span>
        </div>
        <div className="mhl-facts">{facts.join(" · ")}</div>
      </div>
    </div>
  );
}

export default function MapHighlights({ maps }) {
  const played = (maps || []).filter(
    (m) => Number(m.matches) >= MIN_MATCHES && m.win_rate != null,
  );
  // Two cards need two different maps to compare; one map is just a stat.
  if (played.length < 2) return null;

  const ranked = [...played].sort(
    (a, b) => parseFloat(b.win_rate) - parseFloat(a.win_rate),
  );
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  return (
    <div className="mhl-pair">
      <Card map={best} kind="best" />
      <Card map={worst} kind="worst" />
    </div>
  );
}
