/**
 * Account standing across the three places a CS2 player can be sanctioned:
 * FACEIT itself, Valve Anti-Cheat, and developer-issued game bans.
 *
 * The three are genuinely independent — a VAC ban does not create a FACEIT ban
 * and vice versa — so they get three lines rather than one verdict. Merging
 * them into a single "clean/not clean" would hide which one fired.
 */

/** Unknown is not the same as clean.
 *
 * If Steam has no API key configured, or the profile is private, the ban
 * fields come back null. Rendering that as "In Good Standing" would be a
 * claim the data does not support — about the one subject where a false
 * all-clear is most damaging. Null renders as "Unknown" instead.
 */
function verdict(state, cleanLabel, dirtyLabel) {
  if (state == null) return { tone: "unknown", label: "Unknown" };
  return state
    ? { tone: "bad", label: dirtyLabel }
    : { tone: "good", label: cleanLabel };
}

function Row({ label, state, clean = "In Good Standing", dirty = "Banned" }) {
  const v = verdict(state, clean, dirty);
  return (
    <div className="bst-row">
      <span className="bst-label">{label}</span>
      <span className={`bst-pill ${v.tone}`}>{v.label}</span>
    </div>
  );
}

export default function BanStatus({ bans, steam, compact = false }) {
  // `bans` is the FACEIT ban list: present and non-empty means an active ban.
  // An empty array is a real answer (we asked, there were none); undefined is
  // not, and must not be read as clean.
  const faceitBanned = Array.isArray(bans) ? bans.length > 0 : null;
  const active = Array.isArray(bans) && bans.length ? bans[0] : null;

  const vac = steam ? (steam.vac_banned == null ? null : !!steam.vac_banned) : null;
  const gameBans = steam && steam.game_ban_count != null ? steam.game_ban_count > 0 : null;

  return (
    <div className={`bst ${compact ? "compact" : ""}`}>
      {!compact && (
        <div className="panel-head">
          <div className="panel-title">Security &amp; bans</div>
        </div>
      )}
      <Row label="FACEIT ban" state={faceitBanned} />
      <Row label="Steam VAC" state={vac} clean="In Good Standing" dirty="VAC banned" />
      <Row label="Game bans" state={gameBans} clean="In Good Standing" dirty="Game banned" />

      {/* The reason, when there is one. A red pill that won't say what for is
          an accusation without a charge. */}
      {active && (
        <div className="bst-detail">
          {active.reason || active.type || "Ban"}
          {active.ends_at && (
            <i> · until {new Date(active.ends_at).toLocaleDateString("en-GB", {
              day: "2-digit", month: "short", year: "numeric",
            })}</i>
          )}
        </div>
      )}

      {steam && steam.vac_count > 0 && (
        <div className="bst-detail">
          {steam.vac_count} VAC ban{steam.vac_count === 1 ? "" : "s"} on record
        </div>
      )}
    </div>
  );
}
