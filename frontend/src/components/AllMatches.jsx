import { useState, useMemo } from "react";
import { MapIcon, mapLabel } from "../map-art.jsx";

/**
 * The long list — 250 matches, filtered and paged.
 *
 * MatchHistory above this is the detailed one: ten rows that expand into full
 * scoreboards. This is the opposite tool. Nothing expands, every row is one
 * line, and the point is to scan a few hundred of them for streaks and to
 * filter down to "only Mirage, only losses, only ESEA".
 *
 * There is no ELO column, on purpose. See build_full_matches in faceit.py:
 * FACEIT does not publish per-match ELO, and a reconstructed flat ±25 would
 * print the same two numbers forever while looking like it was measured.
 */

const PAGE = 25;

function shortDate(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

const n2 = (v) => (v == null ? "—" : Number(v).toFixed(2));

export default function AllMatches({ matches }) {
  const [map, setMap] = useState("");
  const [comp, setComp] = useState("");
  const [result, setResult] = useState("");   // "" | "w" | "l"
  const [page, setPage] = useState(0);

  const maps = useMemo(
    () => [...new Set((matches || []).map((m) => m.map).filter(Boolean))].sort(),
    [matches]
  );
  const comps = useMemo(
    () => [...new Set((matches || []).map((m) => m.competition).filter(Boolean))].sort(),
    [matches]
  );

  const rows = useMemo(() => {
    return (matches || []).filter((m) => {
      if (map && m.map !== map) return false;
      if (comp && m.competition !== comp) return false;
      if (result === "w" && !m.won) return false;
      if (result === "l" && m.won) return false;
      return true;
    });
  }, [matches, map, comp, result]);

  if (!matches || !matches.length) return null;

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  // Changing a filter can leave you on page 9 of a 2-page result. Clamp on
  // read rather than resetting in every handler.
  const cur = Math.min(page, pages - 1);
  const slice = rows.slice(cur * PAGE, cur * PAGE + PAGE);

  // Summary of what's currently on screen, not of the whole career — the
  // filters are the feature, so the totals have to follow them.
  const wins = rows.filter((m) => m.won).length;
  const wr = rows.length ? Math.round((100 * wins) / rows.length) : 0;

  function change(setter) {
    return (e) => { setter(e.target.value); setPage(0); };
  }

  return (
    <>
      <div className="section-title">
        All matches
        <span className="am-note">
          {rows.length.toLocaleString()} shown · {wins}W {rows.length - wins}L · {wr}% WR
        </span>
      </div>

      <div className="am-filters">
        <select value={map} onChange={change(setMap)} aria-label="Filter by map">
          <option value="">All maps</option>
          {maps.map((m) => <option key={m} value={m}>{mapLabel(m)}</option>)}
        </select>

        {comps.length > 1 && (
          <select value={comp} onChange={change(setComp)} aria-label="Filter by competition">
            <option value="">All competitions</option>
            {comps.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        <div className="am-seg">
          {[["", "All"], ["w", "Wins"], ["l", "Losses"]].map(([v, label]) => (
            <button
              key={v}
              type="button"
              className={result === v ? "on" : ""}
              onClick={() => { setResult(v); setPage(0); }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="am-wrap">
        <table className="am">
          <thead>
            <tr>
              <th className="am-l">Date</th>
              <th className="am-l">Map</th>
              <th className="am-l">Competition</th>
              <th>Result</th>
              <th>K</th>
              <th>D</th>
              <th>A</th>
              <th>+/−</th>
              <th>K/D</th>
              <th>HS%</th>
              <th>ADR</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((m, i) => (
              <tr key={m.match_id || i} className={m.won ? "won" : "lost"}>
                <td className="am-l am-date">{shortDate(m.finished_at)}</td>
                <td className="am-l am-map">
                  <MapIcon map={m.map} size={16} />
                  <span>{mapLabel(m.map)}</span>
                </td>
                <td className="am-l am-comp" title={m.competition || ""}>
                  {m.competition || "—"}
                </td>
                <td className={`am-res ${m.won ? "pos" : "neg"}`}>
                  {m.won ? "W" : "L"} <i>{m.score || ""}</i>
                </td>
                <td>{m.kills ?? "—"}</td>
                <td>{m.deaths ?? "—"}</td>
                <td>{m.assists ?? "—"}</td>
                <td className={m.diff > 0 ? "pos" : m.diff < 0 ? "neg" : ""}>
                  {m.diff == null ? "—" : m.diff > 0 ? `+${m.diff}` : m.diff}
                </td>
                <td className={m.kd >= 1 ? "pos" : m.kd != null ? "neg" : ""}>{n2(m.kd)}</td>
                <td>{m.hs == null ? "—" : `${Math.round(m.hs)}%`}</td>
                <td>{m.adr ?? "—"}</td>
                <td className={m.rating >= 1 ? "pos" : m.rating != null ? "neg" : ""}>
                  {n2(m.rating)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!slice.length && <div className="am-empty">No matches match those filters.</div>}
      </div>

      {pages > 1 && (
        <div className="am-pager">
          <button type="button" onClick={() => setPage(cur - 1)} disabled={cur === 0}>
            ← Prev
          </button>
          <span>Page {cur + 1} of {pages}</span>
          <button type="button" onClick={() => setPage(cur + 1)} disabled={cur >= pages - 1}>
            Next →
          </button>
        </div>
      )}

      <div className="am-foot">
        Rating is an estimated HLTV 2.0, not FACEIT's own — that one isn't in
        the API. Per-match ELO isn't either, so there's no ELO column here
        rather than a made-up one.
      </div>
    </>
  );
}
