import { useState } from "react";

/**
 * The same career, split by where it was played.
 *
 * Not to be confused with Competitions.jsx, which browses FACEIT's
 * competitions globally. This one answers a question about one player: is the
 * K/D on the profile a matchmaking K/D or a pug-hub K/D, and how far apart are
 * they. On most accounts the gap is large enough that the single blended
 * figure above describes neither half.
 */

const COLS = [
  { key: "matches",  label: "M",      title: "Matches" },
  { key: "wins",     label: "W",      title: "Wins" },
  { key: "losses",   label: "L",      title: "Losses" },
  { key: "win_rate", label: "WR%",    title: "Win rate" },
  { key: "kills",    label: "K",      title: "Kills" },
  { key: "deaths",   label: "D",      title: "Deaths" },
  { key: "diff",     label: "+/−",    title: "Kills minus deaths" },
  { key: "hs_pct",   label: "HS%",    title: "Headshot percentage" },
  { key: "kpr",      label: "KPR",    title: "Kills per round" },
  { key: "kd",       label: "K/D",    title: "Total kills over total deaths" },
  { key: "adr",      label: "ADR",    title: "Average damage per round" },
  { key: "rating",   label: "Rating", title: "Estimated HLTV 2.0 rating" },
];

const DASH = "—";

function cell(row, key) {
  const v = row[key];
  if (v == null) return DASH;
  if (key === "win_rate" || key === "hs_pct") return `${v}%`;
  if (key === "diff") return v > 0 ? `+${v}` : String(v);
  if (key === "kills" || key === "deaths") return Number(v).toLocaleString();
  return String(v);
}

/** Colour only where it means something. A kill count isn't good or bad. */
function tone(row, key) {
  const v = row[key];
  if (v == null) return "";
  if (key === "win_rate") return v >= 50 ? "pos" : "neg";
  if (key === "diff") return v > 0 ? "pos" : v < 0 ? "neg" : "";
  if (key === "kd") return v >= 1 ? "pos" : "neg";
  if (key === "rating") return v >= 1 ? "pos" : "neg";
  return "";
}

const KIND_LABEL = {
  matchmaking: "Matchmaking",
  hub: "Hub",
  championship: "Championship",
  tournament: "Tournament",
};

export default function PlayerHubs({ competitions }) {
  // Default to matches played: the biggest sample is the one worth reading
  // first, and it's also the order the backend already sorted them in.
  const [sort, setSort] = useState("matches");
  const [desc, setDesc] = useState(true);

  if (!competitions || !competitions.length) return null;

  const rows = [...competitions].sort((a, b) => {
    const x = a[sort], y = b[sort];
    // Missing values sink, whichever way the column is pointing — otherwise
    // sorting by rating puts every un-rated row at the top.
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return desc ? y - x : x - y;
  });

  function pick(key) {
    if (key === sort) setDesc(!desc);
    else { setSort(key); setDesc(true); }
  }

  const total = competitions.reduce((n, c) => n + c.matches, 0);

  return (
    <>
      <div className="section-title">
        Hubs &amp; competitions
        <span className="phb-note">
          {competitions.length} with 3+ matches · {total.toLocaleString()} matches
        </span>
      </div>

      <div className="phb-wrap">
        <table className="phb">
          <thead>
            <tr>
              <th className="phb-name-h">Competition</th>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  title={c.title}
                  className={`phb-num ${sort === c.key ? "on" : ""}`}
                  onClick={() => pick(c.key)}
                >
                  {c.label}
                  {sort === c.key && <i>{desc ? "▾" : "▴"}</i>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.competition_id || ""}${r.name}`}>
                <td className="phb-name">
                  <span className="phb-title" title={r.name}>{r.name}</span>
                  {r.kind && (
                    <span className="phb-kind">{KIND_LABEL[r.kind] || r.kind}</span>
                  )}
                </td>
                {COLS.map((c) => (
                  <td key={c.key} className={`phb-num ${tone(r, c.key)}`}>
                    {cell(r, c.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Said plainly rather than left to be discovered: this table covers the
          last 250 matches, not the whole account, so it will not add up to the
          lifetime totals in the header. */}
      <div className="phb-foot">
        Last 250 matches. Competitions with fewer than 3 are hidden — a win rate
        from one match isn't one.
      </div>
    </>
  );
}
