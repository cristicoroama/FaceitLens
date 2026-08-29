/**
 * Every name this account has played under.
 *
 * Two sources, and they answer different questions:
 *
 *  - `history` is reconstructed from the match rosters, which record the name
 *    in use when each match was played. It reaches back as far as the 250
 *    matches we hold, whoever the player is and whether or not they have ever
 *    been searched here before.
 *
 *  - `nicknames` is what FaceitLens itself has observed since this player was
 *    first looked up on the site. It is the weaker source — on a first search
 *    it holds exactly one row — but it keeps growing after the match window
 *    has scrolled past, so it eventually knows things the rosters no longer do.
 *
 * The reconstructed table leads. The observed list is shown underneath only
 * when it knows a name the rosters didn't.
 */

const FACEIT_ROOM = "https://www.faceit.com/en/cs2/room/";

function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

function shortDate(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

/** Date + a link to the match itself, so a claim about when a name was used
    can be opened and checked rather than taken on trust. */
function MatchLink({ match }) {
  if (!match || !match.date) return <span className="nk-dash">—</span>;
  const label = shortDate(match.date);
  if (!match.match_id) return <span>{label}</span>;
  return (
    <a
      className="nk-match"
      href={`${FACEIT_ROOM}${encodeURIComponent(match.match_id)}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Open this match on FACEIT"
    >
      {label}
    </a>
  );
}

export default function Nicknames({ nicknames, history, player }) {
  const rows = history || [];

  if (!rows.length) {
    return (
      <div className="state">
        No nickname changes found. This account used the same name across every
        match we hold, and FaceitLens has recorded no change since it was first
        searched here.
      </div>
    );
  }

  const total = rows.reduce((n, r) => n + r.matches, 0);
  // Names the observed table knows about that the match window never saw —
  // usually renames older than the 250 matches we hold.
  const seen = new Set(rows.map((r) => r.nickname));
  const extra = (nicknames || []).filter((n) => !seen.has(n.nickname));

  return (
    <>
      <div className="section-title">
        {player ? `${player} has also played under these nicknames` : "Nickname history"}
        <span className="nk-note">{rows.length} names · {total.toLocaleString()} matches</span>
      </div>

      <div className="nk-wrap">
        <table className="nk">
          <thead>
            <tr>
              <th className="nk-l">Nickname</th>
              <th>Matches</th>
              <th className="nk-l">First match</th>
              <th className="nk-l">Last match</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.nickname} className={r.is_current ? "current" : ""}>
                <td className="nk-l nk-name">
                  <span className="nk-ava">{initials(r.nickname)}</span>
                  <span className="nk-text">{r.nickname}</span>
                  {r.is_current && <span className="nk-badge">Current</span>}
                </td>
                <td className="nk-num">{r.matches.toLocaleString()}</td>
                <td className="nk-l"><MatchLink match={r.first_match} /></td>
                <td className="nk-l"><MatchLink match={r.last_match} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Said rather than left to be inferred: this covers a match window, not
          the whole account, so a rename from four years ago will not be here.
          No ELO column either — FACEIT publishes no historical ELO, and the
          curve on this profile is a flat ±25 reconstruction. */}
      <div className="nk-foot">
        Rebuilt from the last 250 matches — each one records the name in use at
        the time. Renames older than that window aren't visible, and FACEIT
        publishes no historical ELO, so there's no ELO column rather than an
        invented one.
      </div>

      {extra.length > 0 && (
        <>
          <div className="section-title">
            Also recorded here
            <span className="nk-note">outside the match window</span>
          </div>
          <div className="nk-wrap">
            <table className="nk">
              <tbody>
                {extra.map((n) => (
                  <tr key={n.nickname}>
                    <td className="nk-l nk-name">
                      <span className="nk-ava">{initials(n.nickname)}</span>
                      <span className="nk-text">{n.nickname}</span>
                    </td>
                    <td className="nk-l nk-dim">
                      first seen {n.first_seen ? new Date(n.first_seen).toLocaleDateString("en-GB", {
                        day: "2-digit", month: "short", year: "numeric",
                      }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
