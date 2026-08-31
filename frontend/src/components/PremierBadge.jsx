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

/* Valve's item-rarity ramp — which Premier reuses for its rating tiers —
   lightened 37% toward white.
 *
 * The lightening is not a taste call. The reference's tier-3 colour computes
 * to rgb(180, 139, 255); Valve's purple is #8847ff = rgb(136, 71, 255); and
 * mixing that with white gives exactly 180 and 139 at t = 0.37 on both
 * channels. One confirmed value, one consistent relationship, so the rest of
 * the ramp is derived rather than eyeballed — a single lighter tone among six
 * saturated ones would have looked like a mistake.
 *
 * Only the purple is measured. If another tier ever looks off against the
 * real thing, the fix is to check that tier's computed colour, not to nudge
 * this one by hand.
 *
 * `c` is the BARS — Valve's colour lightened 37% toward white.
 * `d` is the PLATE — the same colour darkened 30% toward black.
 *
 * Two derivations from one base, in opposite directions. The plate was
 * previously built by mixing the already-lightened `c` into near-black, which
 * produced rgb(65,49,93): a muddy grey-violet, because mixing toward black
 * strips saturation and `c` had little left to give. Darkening the SATURATED
 * base keeps the hue intact, which is what the reference plate actually looks
 * like.
 */
const BRACKETS = [
  [30000, { c: "#ffe38f", d: "#b39437" }], // gold
  [25000, { c: "#f28e8e", d: "#a53535" }], // red
  [20000, { c: "#e37aef", d: "#941fa1" }], // pink
  [15000, { c: "#b48bff", d: "#5f32b3" }], // purple  (c measured)
  [10000, { c: "#8ea0ff", d: "#354ab3" }], // blue
  [5000,  { c: "#b6d3ff", d: "#6182b3" }], // light blue
  [0,     { c: "#cdd9e7", d: "#7b8998" }], // gray
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
