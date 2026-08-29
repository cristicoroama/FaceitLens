import { useState } from "react";
import { MapIcon, mapLabel } from "../map-art.jsx";

/**
 * Personal records — the single best and worst matches, not averages.
 *
 * Averages are what the rest of the profile already does well, and they
 * flatten exactly the matches people actually remember. This reads the whole
 * 250-match window the backend already holds rather than the 30 the overview
 * uses, because a career best over 30 matches is not a career best.
 */

const TABS = [
  { key: "kills",    label: "Kills" },
  { key: "kd",       label: "K/D" },
  { key: "adr",      label: "ADR" },
  { key: "hs",       label: "HS%" },
  { key: "worst_kd", label: "Worst" },
];

/** "12 Mar 2025" — a record is a date you can go and look up, not "3d ago". */
function shortDate(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

/** The headline number, formatted per metric: kills are whole, ratios aren't. */
function headline(key, v) {
  if (v == null) return "—";
  if (key === "kills") return Math.round(v);
  if (key === "adr") return Math.round(v);
  if (key === "hs") return `${Math.round(v)}%`;
  return Number(v).toFixed(2);
}

function Row({ row, metric, rank }) {
  // Only linked when we actually have the id. FACEIT room URLs are built from
  // the match id the stats themselves carry, so this can't point at a stranger.
  const url = row.match_id
    ? `https://www.faceit.com/en/cs2/room/${encodeURIComponent(row.match_id)}`
    : null;

  const body = (
    <>
      <div className="hlr-rank">{rank}</div>
      <div className="hlr-val">{headline(metric, row.value)}</div>
      <div className="hlr-map">
        <MapIcon map={row.map} size={18} />
        <span>{mapLabel(row.map)}</span>
      </div>
      <div className={`hlr-res ${row.won ? "won" : "lost"}`}>
        {row.won ? "W" : "L"} {row.score || ""}
      </div>
      {/* The supporting line, so the headline can be checked rather than
          taken on faith. A 40-kill game at 0.9 K/D is a different game from
          a 40-kill game at 2.4, and the number alone hides which. */}
      <div className="hlr-kda">
        {row.kills}/{row.deaths}/{row.assists}
        {row.kd != null && <i> · {Number(row.kd).toFixed(2)} K/D</i>}
        {row.adr != null && <i> · {Math.round(row.adr)} ADR</i>}
      </div>
      <div className="hlr-when">{shortDate(row.finished_at)}</div>
    </>
  );

  return url ? (
    <a className="hl-row is-link" href={url} target="_blank" rel="noopener noreferrer" title="Open match room">
      {body}
    </a>
  ) : (
    <div className="hl-row">{body}</div>
  );
}

export default function Highlights({ highlights }) {
  const [tab, setTab] = useState("kills");
  if (!highlights) return null;

  const tabs = TABS.filter((t) => highlights[t.key]?.rows?.length);
  if (!tabs.length) return null;

  const active = highlights[tab] ? tab : tabs[0].key;
  const set = highlights[active];

  return (
    <>
      <div className="section-title">
        Highlights
        <span className="hl-note">personal records</span>
      </div>

      <div className="hl-wrap">
        <div className="hl-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`hl-tab ${t.key === active ? "on" : ""}`}
              onClick={() => setTab(t.key)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="hl-list">
          {set.rows.map((r, i) => (
            <Row key={r.match_id || i} row={r} metric={active} rank={i + 1} />
          ))}
        </div>
      </div>
    </>
  );
}
