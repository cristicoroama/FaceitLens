// In-game CS2 Premier "CS Rating" plate, drawn in code (same technique Leetify
// uses — the number is dynamic, so it can't be a static image): a skewed plate
// colored by rating bracket, with the // slashes and an italic bold number.
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

export default function PremierBadge({ rating }) {
  if (rating == null) return null;
  const { c, d } = bracket(rating);
  return (
    <span
      className="prem-badge"
      style={{ "--pc": c, "--pcd": d }}
      title={`Premier CS Rating: ${Math.round(rating).toLocaleString()}`}
    >
      <span className="prem-sl">//</span>
      <b>{Math.round(rating).toLocaleString("en-US")}</b>
    </span>
  );
}
