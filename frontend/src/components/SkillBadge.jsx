// FACEIT-style level icon: a colored shield with chevrons + the level number.
const LEVEL_COLORS = {
  1: "#1ca345", 2: "#1ca345",
  3: "#ffc107", 4: "#ffc107", 5: "#ffc107",
  6: "#ff9b1c", 7: "#ff9b1c",
  8: "#ff5500", 9: "#ff5500",
  10: "#fe1f00",
};

export default function SkillBadge({ level, size = 30 }) {
  const lvl = Number(level) || 0;
  const color = LEVEL_COLORS[lvl] || "#8b9099";
  // number of little chevrons grows with level (visual cue like FACEIT)
  const chevrons = Math.max(1, Math.ceil(lvl / 2));

  return (
    <span className="skill-badge-svg" title={`Level ${lvl || "?"}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 32 36" width={size} height={size}>
        <defs>
          <linearGradient id={`lvl${lvl}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <path
          d="M16 1 L30 6 V18 C30 27 24 32 16 35 C8 32 2 27 2 18 V6 Z"
          fill={`url(#lvl${lvl})`}
          stroke={color}
          strokeWidth="1"
        />
        {Array.from({ length: chevrons }).map((_, i) => (
          <path
            key={i}
            d={`M9 ${9 + i * 2.2} L16 ${6.5 + i * 2.2} L23 ${9 + i * 2.2}`}
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <text
          x="16" y="30" textAnchor="middle"
          fontFamily="'Chakra Petch', sans-serif" fontWeight="700" fontSize="13"
          fill="#fff"
        >
          {lvl || "?"}
        </text>
      </svg>
    </span>
  );
}
