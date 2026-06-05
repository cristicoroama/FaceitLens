// FACEIT-style level icon: a shield whose horizontal bars fill up with the
// level (1 bar at lvl 2 ... all bars at lvl 10), colored by tier + the number.
const LEVEL_COLORS = {
  1: "#eaeaea",
  2: "#48b748", 3: "#48b748",
  4: "#ffc828", 5: "#ffc828",
  6: "#ff9e1b", 7: "#ff9e1b",
  8: "#ff6c0e", 9: "#ff6c0e",
  10: "#fe1d1d",
};

export default function SkillBadge({ level, size = 32 }) {
  const lvl = Math.max(1, Math.min(10, Number(level) || 1));
  const color = LEVEL_COLORS[lvl];
  const isMax = lvl === 10;

  // 5 horizontal bars inside the shield; number filled scales with level.
  const bars = 5;
  const filled = Math.round((lvl / 10) * bars);
  const barY = [13, 16.5, 20, 23.5, 27];

  return (
    <span className="skill-badge-svg" title={`Level ${lvl}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 34 38" width={size} height={size}>
        <defs>
          <linearGradient id={`sh${lvl}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a2e36" />
            <stop offset="100%" stopColor="#1a1d23" />
          </linearGradient>
        </defs>

        {/* shield body */}
        <path
          d="M17 1.5 L32 6.5 V19 C32 28.5 25.5 34 17 36.8 C8.5 34 2 28.5 2 19 V6.5 Z"
          fill={`url(#sh${lvl})`}
          stroke={color}
          strokeWidth={isMax ? 2 : 1.4}
        />

        {/* level number on top */}
        <text
          x="17" y="10.2" textAnchor="middle"
          fontFamily="'Chakra Petch', sans-serif" fontWeight="700" fontSize="7.5"
          fill={color}
        >
          {lvl}
        </text>

        {/* horizontal bars that fill with the level */}
        {barY.map((y, i) => {
          const on = i < filled;
          const w = 16 - i * 1.6; // slight taper toward the point
          return (
            <rect
              key={i}
              x={17 - w / 2}
              y={y}
              width={w}
              height="2.2"
              rx="1.1"
              fill={on ? color : "rgba(255,255,255,0.10)"}
            />
          );
        })}
      </svg>
    </span>
  );
}
