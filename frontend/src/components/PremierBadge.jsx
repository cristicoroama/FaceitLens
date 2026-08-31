/**
 * CS2 Premier "CS Rating" plate.
 *
 * Drawn in code rather than served as artwork, because the number is dynamic —
 * there is no image to ship for 15,100.
 *
 * Two details make it read as the in-game plate rather than a coloured pill:
 *
 *  - The mark is two skewed bars as SVG geometry, not a "//" typed in a mono
 *    font. Slash glyphs carry the font's own angle and side bearings, so they
 *    sat at the wrong slant and drifted whenever the font changed.
 *
 *  - The number is split. Valve sets the thousands large and the last three
 *    digits small, which is why "15,100" reads as a tier and a position within
 *    it rather than as a five-digit number.
 *
 * Bars are drawn here rather than copied from anyone's markup: two slanted
 * parallelograms is geometry, and re-deriving it takes less effort than
 * deciding whether lifting someone's path data is fine.
 */

/* Valve's item-rarity ramp, which Premier reuses for its rating tiers.
   `c` is the tier colour, `d` the plate it sits on. */
const BRACKETS = [
  [30000, { c: "#ffd34e", d: "#3a2f10" }], // gold
  [25000, { c: "#eb4b4b", d: "#3a1416" }], // red
  [20000, { c: "#d32ce6", d: "#33122f" }], // pink
  [15000, { c: "#8847ff", d: "#241540" }], // purple
  [10000, { c: "#4b69ff", d: "#131c45" }], // blue
  [5000,  { c: "#8bb9ff", d: "#16243a" }], // light blue
  [0,     { c: "#b0c3d9", d: "#252b33" }], // gray
];

function bracket(rating) {
  for (const [min, colors] of BRACKETS) if (rating >= min) return colors;
  return BRACKETS[BRACKETS.length - 1][1];
}

/** "15,100" -> ["15,", "100"].  Under a thousand there is nothing to split,
    so the whole figure stays large and the small span is skipped entirely. */
function split(rating) {
  const n = Math.max(0, Math.round(rating));
  if (n < 1000) return [String(n), ""];
  const s = n.toLocaleString("en-US");
  const cut = s.length - 3;
  return [s.slice(0, cut), s.slice(cut)];
}

export default function PremierBadge({ rating }) {
  if (rating == null) return null;
  const { c, d } = bracket(rating);
  const [big, small] = split(rating);

  return (
    <span
      className="prem-badge"
      style={{ "--pc": c, "--pcd": d }}
      title={`Premier CS Rating: ${Math.round(rating).toLocaleString("en-US")}`}
    >
      <svg className="prem-bars" viewBox="0 0 17 32" aria-hidden="true">
        <path d="M5.6 0h4.1L4.3 32H0z" />
        <path d="M12.1 0H17l-5.4 32H6.7z" />
      </svg>
      <span className="prem-num">
        <b>{big}</b>
        {small && <i>{small}</i>}
      </span>
    </span>
  );
}
