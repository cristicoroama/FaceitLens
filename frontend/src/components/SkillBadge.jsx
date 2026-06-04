// Official-ish FACEIT level colors (1-10)
const LEVEL_COLORS = {
  1: "#1cd05e",
  2: "#1cd05e",
  3: "#ffc800",
  4: "#ffc800",
  5: "#ff9b1c",
  6: "#ff9b1c",
  7: "#ff6309",
  8: "#ff6309",
  9: "#fe1f00",
  10: "#fe1f00",
};

export default function SkillBadge({ level }) {
  const lvl = Number(level) || 0;
  const color = LEVEL_COLORS[lvl] || "var(--text-dim)";
  return (
    <span className="skill-badge" style={{ borderColor: color, color }}>
      {lvl || "?"}
    </span>
  );
}
