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

/** Emblem colour for the FACEIT Challenger badge, by leaderboard position:
    gold / silver / bronze for the podium, red for everyone else. */
const CHALLENGER_COLORS = { 1: "#F7D24B", 2: "#E3E7ED", 3: "#F2A65A" };
export function challengerColor(position) {
  return CHALLENGER_COLORS[Number(position)] || "#F23048";
}

/** FACEIT Challenger badge icon. `color` tints the emblem (see challengerColor). */
export function ChallengerIcon({ size = 24, color = "#F7D24B", title = "Challenger" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      width={size} height={size} fill={color}
      style={{ flexShrink: 0, display: "block" }} role="img" aria-label={title}
    >
      <title>{title}</title>
      <path fill="#121212" d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12" />
      <path d="M7.042 6.773a10 10 0 00-1.297-.375l-.008-.008c-.15-.442-.255-.885-.352-1.365a9.5 9.5 0 012.1-1.515 10 10 0 00-.023 1.41c.405.21.803.458 1.155.713-.57.307-1.102.69-1.575 1.14m11.213-.375c.15-.443.255-.885.353-1.365a9.5 9.5 0 00-2.1-1.515c.037.487.052.945.022 1.41-.405.21-.795.457-1.155.712a7 7 0 011.575 1.14c.413-.15.855-.285 1.297-.375zM20.85 8.28c-.27.39-.555.758-.87 1.103-.442-.09-.9-.15-1.343-.173a7.2 7.2 0 00-.99-1.672 9 9 0 011.343-.195c.21-.413.383-.84.54-1.298.54.683.982 1.433 1.32 2.235m-.487 4.53a11 11 0 001.237-.667 9.6 9.6 0 00-.308-2.573q-.482.529-1.02.968a9 9 0 00-1.304-.368c.165.63.24 1.283.232 1.935q.587.304 1.163.698zm.36 3.18a10 10 0 01-1.388.113 9 9 0 00-.788-1.11 7 7 0 00.555-1.86c.368.255.728.54 1.05.855a8 8 0 001.32-.48 9.3 9.3 0 01-.75 2.482zm-2.333 3.173c-.458-.12-.9-.278-1.328-.465v.007a8 8 0 00-.27-1.327c.503-.42.908-.938 1.268-1.478.247.39.427.78.615 1.208.45.052.937.104 1.402.09-.48.72-1.027 1.402-1.687 1.965M7.207 17.37a8 8 0 00-.27 1.328v-.008q-.641.284-1.327.465c-.66-.563-1.208-1.245-1.688-1.965.465.015.953-.03 1.403-.09.187-.428.367-.818.615-1.208.36.54.772 1.058 1.267 1.478m-2.535-1.267c.233-.39.51-.773.788-1.11a6.5 6.5 0 01-.555-1.86 8 8 0 00-1.05.855 9 9 0 01-1.32-.48c.12.862.39 1.695.75 2.482.477.067.925.112 1.387.113m.128-3.99c-.382.195-.772.435-1.162.697v.008A13 13 0 012.4 12.15a9.6 9.6 0 01.308-2.572q.482.529 1.02.967c.427-.157.87-.277 1.305-.367a7 7 0 00-.233 1.935m-.78-2.73c.442-.098.9-.15 1.342-.173a7.2 7.2 0 01.99-1.672 10 10 0 00-1.342-.195 10 10 0 01-.54-1.298A9.6 9.6 0 003.15 8.28c.27.398.555.765.87 1.103m9.02 11.536l1.345.52-.27.699L12 21.321l-2.115.817-.27-.7 1.345-.52L7.807 19.7l.27-.7L12 20.517 15.923 19l.27.7zm2.004-12.781c.033-.05.114-.033.114.033v6.76c0 .033-.098.082-.146.066-.663-.26-1.49-.588-2.391-.945a586 586 0 00-6.041-2.37c-.066-.032-.033-.131.048-.131h6.251c.379-.623.8-1.28 1.402-2.22z" />
    </svg>
  );
}

// Pill gradient + text colour for the ranked Challenger badge (#position + icon).
// Gold / silver / bronze for the podium, red for everyone else.
const CHALLENGER_PILL = {
  1: { bg: "linear-gradient(135deg,#FCE08A 0%,#E6A100 100%)", text: "#2e2200" },
  2: { bg: "linear-gradient(135deg,#F3F5F8 0%,#AEB4BE 100%)", text: "#23262b" },
  3: { bg: "linear-gradient(135deg,#F0A85E 0%,#B96A22 100%)", text: "#2e1804" },
};
const CHALLENGER_PILL_DEFAULT = { bg: "linear-gradient(135deg,#F0243F 0%,#C8001F 100%)", text: "#2a060a" };

/** Ranked Challenger badge: a coloured pill with "#position" and the emblem. */
export function ChallengerBadge({ position = 1, size = 30 }) {
  const pill = CHALLENGER_PILL[Number(position)] || CHALLENGER_PILL_DEFAULT;
  return (
    <span
      className="challenger-badge"
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, height: size + 5,
        borderRadius: (size + 5) / 2, padding: "0 3px 0 8px",
        background: pill.bg, color: pill.text,
        boxShadow: "0 2px 6px rgba(0,0,0,.45), 0 0 0 1px rgba(0,0,0,.22)",
      }}
    >
      <span style={{
        whiteSpace: "nowrap", fontWeight: 700, fontSize: Math.round(size * 0.58), lineHeight: 1,
        letterSpacing: "-.3px", fontVariantNumeric: "tabular-nums",
      }}>
        #{position}
      </span>
      <ChallengerIcon size={size} color={challengerColor(position)} />
    </span>
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
