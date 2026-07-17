// Official rank/flag artwork served from /public/ranks and /public/flags.

const SKILL_GROUPS = [
  "Unranked",
  "Silver I", "Silver II", "Silver III", "Silver IV", "Silver Elite", "Silver Elite Master",
  "Gold Nova I", "Gold Nova II", "Gold Nova III", "Gold Nova Master",
  "Master Guardian I", "Master Guardian II", "Master Guardian Elite", "Distinguished Master Guardian",
  "Legendary Eagle", "Legendary Eagle Master", "Supreme Master First Class", "The Global Elite",
];

export function groupName(rank) {
  return SKILL_GROUPS[Number(rank)] || `Rank ${rank}`;
}

/** Official FACEIT level icon (1-10). */
export function FaceitLevel({ level, size = 34 }) {
  const lvl = Math.max(1, Math.min(10, Number(level) || 1));
  return (
    <img
      className="fl-icon"
      src={`/ranks/faceit/${lvl}.png`}
      alt={`FACEIT level ${lvl}`}
      title={`FACEIT level ${lvl}`}
      width={size}
      height={size}
      loading="lazy"
    />
  );
}

/** Official CS2 competitive / wingman skill group badge (0 = unranked). */
export function CompRank({ rank, height = 28 }) {
  const r = Math.max(0, Math.min(18, Number(rank) || 0));
  const src = r === 0 ? "/ranks/comp/skillgroup_none.png" : `/ranks/comp/skillgroup${r}.png`;
  return (
    <img
      className="comp-icon"
      src={src}
      alt={groupName(r)}
      title={groupName(r)}
      style={{ height }}
      loading="lazy"
    />
  );
}

/** SVG country flag (emoji flags don't render on Windows). */
export function Flag({ country, size = 18 }) {
  if (!country || country.length !== 2) return null;
  return (
    <img
      className="flag-icon"
      src={`/flags/${country.toLowerCase()}.svg`}
      alt={country.toUpperCase()}
      title={country.toUpperCase()}
      style={{ width: size }}
      loading="lazy"
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  );
}
