/**
 * CS2 Premier "CS Rating" plate.
 *
 * One self-contained SVG: plate, bars and number in a single element.
 *
 * The previous version was three DOM nodes — a flex row, an SVG for the bars,
 * a skewed span for the number — and every visual property had to be kept in
 * agreement across them by hand. The lean was the worst of it: the bars carried
 * a slant in their path, the plate carried a `skewX`, and the digits carried
 * both plus an italic, so anything that leaned leaned two or three times. Four
 * separate rounds of fixes went into that coordination problem.
 *
 * As one SVG there is nothing to coordinate. The plate's lean is its geometry,
 * the bars' lean is theirs, and the number leans because it is italic. The
 * whole thing scales from one height and cannot drift.
 *
 * The three path strings come from the reference's own markup, rounded to two
 * decimals. Saying otherwise would be easy and wrong — they were not redrawn.
 * What they describe is a rounded parallelogram and two slanted bars, which is
 * the shape CS2 itself puts on screen, but the coordinates are theirs.
 */

/* Premier tier colours.
 *
 * These are NOT Valve's item-rarity ramp, which is what this used before —
 * they are a Tailwind-derived palette with hand-picked dark surfaces, read
 * straight from the reference's own CSS variables:
 *
 *   --color-premier-blue: #3b82f6   --color-premier-blue-surface: #0a1530
 *
 * `c` paints the border, the bars and the number; `s` is the surface behind
 * them. Two values per tier, both given rather than derived, so there is no
 * relationship left to get wrong.
 */
const BRACKETS = [
  [30000, { c: "#facc15", s: "#2a2207" }], // gold
  [25000, { c: "#ef4444", s: "#2f0a0a" }], // red
  [20000, { c: "#ec4899", s: "#2f0a1e" }], // pink
  [15000, { c: "#a855f7", s: "#1e0d30" }], // purple
  [10000, { c: "#3b82f6", s: "#0a1530" }], // blue
  [5000,  { c: "#93c5fd", s: "#0f1c2c" }], // sky
  [0,     { c: "#9ca3af", s: "#1d1f25" }], // gray
];

function bracket(rating) {
  for (const [min, colors] of BRACKETS) if (rating >= min) return colors;
  return BRACKETS[BRACKETS.length - 1][1];
}

/** "15,100" -> ["15,", "100"]. Under a thousand there is nothing to split, so
    the whole figure stays large and the small tspan is skipped. */
function split(rating) {
  const n = Math.max(0, Math.round(rating));
  if (n < 1000) return [String(n), ""];
  const s = n.toLocaleString("en-US");
  const cut = s.length - 3;
  return [s.slice(0, cut), s.slice(cut)];
}

export default function PremierBadge({ rating, height = 24 }) {
  if (rating == null) return null;
  const { c, s } = bracket(rating);
  const [big, small] = split(rating);
  const label = Math.round(rating).toLocaleString("en-US");

  return (
    <svg
      className="prem-badge"
      viewBox="0 0 125 40"
      height={height}
      width={(125 / 40) * height}
      role="img"
      aria-label={`Premier CS Rating ${label}`}
    >
      <title>{`Premier CS Rating: ${label}`}</title>

      {/* The plate: a parallelogram leaning ~6deg, rounded at the corners.
          Stroked in the tier colour rather than filled with it — the fill is
          the dark surface, which is what keeps a bright rating readable. */}
      <path
        d="M10.54 1H118.41C121.47 1 123.81 3.72 123.36 6.74L119.16 34.74C118.79 37.19 116.69 39 114.21 39H6.34C3.29 39 0.95 36.28 1.40 33.26L5.60 5.26C5.97 2.81 8.07 1 10.54 1Z"
        fill={s}
        stroke={c}
        strokeWidth="2"
      />

      {/* Two bars outside the plate, leaning with it. */}
      <path d="M4.84 3.41C5.14 1.45 6.82 0 8.80 0H13.36L7.36 40H4.00C1.56 40 -0.32 37.83 0.04 35.41L4.84 3.41Z" fill={c} />
      <path d="M17.26 0H26.26L20.26 40H11.26L17.26 0Z" fill={c} />

      {/* Italic, and in the tier colour rather than white — both measured.
          The thousands are set larger than the last three digits, which is
          what makes the figure read as a tier plus a position inside it. */}
      <text
        x="68"
        y="27"
        fill={c}
        textAnchor="middle"
        fontStyle="italic"
        fontFamily="var(--font-display)"
      >
        <tspan fontSize="22" fontWeight="700">{big}</tspan>
        {small && <tspan fontSize="20" fontWeight="700">{small}</tspan>}
      </text>
    </svg>
  );
}
