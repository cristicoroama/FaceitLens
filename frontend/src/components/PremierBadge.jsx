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

/* Valve's item-rarity ramp, which Premier reuses for its rating tiers, in the
 * three roles the badge actually needs.
 *
 * All three come from the reference's own computed styles on a tier-2 (blue)
 * badge, and the relationships they imply then rebuild that tier exactly:
 *
 *   b — the BARS. The raw Valve colour. Measured rgb(76,106,255) against
 *       Valve's #4b69ff: one point of deviation, on one channel.
 *
 *       This overturned an earlier reading. A previous dump showed
 *       rgb(180,139,255) on a purple badge and that went in as the bar colour
 *       — but it was the element's `color`, which is the TEXT. The bars are
 *       filled with the undiluted Valve hue.
 *
 *   c — the NUMBER. Valve's colour lightened 37% toward white. Measured
 *       rgb(138,157,254) against a computed #8ea0ff: four points at worst.
 *       Not white, which is what this rendered before.
 *
 *   d — the PLATE. Same hue, saturation 80%, lightness 12%. Measured
 *       rgb(6,14,55); rebuilding it from Valve's blue through that rule gives
 *       #060e37, digit for digit. Mixing toward black instead — the previous
 *       approach — stripped the saturation and produced grey-violet mud.
 *
 * Only the blue tier is measured. The other six are derived through those same
 * three rules, so if one ever looks wrong the fix is to measure that tier, not
 * to nudge a value by eye.
 */
const BRACKETS = [
  //          bars (Valve)   text (+37% white)  plate (same hue, S80 L12)
  [30000, { b: "#ffd34e", c: "#ffe38f", d: "#372b06" }], // gold
  [25000, { b: "#eb4b4b", c: "#f28e8e", d: "#370606" }], // red
  [20000, { b: "#d32ce6", c: "#e37aef", d: "#320637" }], // pink
  [15000, { b: "#8847ff", c: "#b48bff", d: "#170637" }], // purple
  [10000, { b: "#4b69ff", c: "#8ea0ff", d: "#060e37" }], // blue   (all three measured)
  [5000,  { b: "#8bb9ff", c: "#b6d3ff", d: "#061a37" }], // light blue
  [0,     { b: "#b0c3d9", c: "#cdd9e7", d: "#061d37" }], // gray
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
  const { b, c, d } = bracket(rating);
  const [big, small] = split(rating);

  return (
    <span
      className="prem-badge"
      style={{ "--pb": b, "--pc": c, "--pcd": d }}
      title={`Premier CS Rating: ${Math.round(rating).toLocaleString("en-US")}`}
    >
      {/* Two bars leaning ~9deg — about 5 units of drift across 32 of height.
          The first pass drifted 1.3 units, which is a slant you can only see
          if you already know it's there; side by side with the real plate they
          read as two upright ticks. Measured off the reference, then drawn
          with plain corners rather than its rounded ones. */}
      <svg className="prem-bars" viewBox="0 0 17 32" aria-hidden="true">
        <path d="M5.4 0H9.5L4.4 32H0.3Z" />
        <path d="M11.8 0H16.9L11.8 32H6.7Z" />
      </svg>
      <span className="prem-num">
        <b>{big}</b>
        {small && <i>{small}</i>}
      </span>
    </span>
  );
}
