/**
 * Recent results as a row of chips — the shape a CS2 player already reads at a
 * glance, because it's the one FACEIT itself uses on a profile.
 *
 * The Overview strip and the marker on every match-history row both render
 * `ResultChip`, so a win looks the same wherever it turns up. They used to
 * disagree: the match rows carried a 40px pill filled at 14% alpha with a
 * coloured glow behind it, which reads as grey once it's chip-sized and which
 * the palette rules at the top of index.css rule out anyway.
 */

function shortDate(ts) {
  if (!ts) return null;
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export function ResultChip({ won, size, title }) {
  const kind = won === true ? "w" : won === false ? "l" : "x";
  return (
    <span
      className={`res res-${kind}${size === "lg" ? " res-lg" : ""}`}
      title={title}
      // The letter is the whole content, so without this a screen reader
      // announces ten bare consonants.
      aria-label={kind === "w" ? "Win" : kind === "l" ? "Loss" : "Result unknown"}
    >
      {kind === "x" ? "?" : kind.toUpperCase()}
    </span>
  );
}

function chipTitle(m) {
  return [
    m.won === true ? "Win" : m.won === false ? "Loss" : "Unknown result",
    shortDate(m.finished_at),
    m.competition,
    m.rating != null ? `rating ${m.rating.toFixed(2)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function FormStrip({ matches, limit = 10 }) {
  const last = (matches || []).slice(0, limit);
  if (!last.length) return null;

  const wins = last.filter((m) => m.won === true).length;
  const losses = last.filter((m) => m.won === false).length;

  return (
    <div className="form-strip">
      <span className="form-strip-label">Recent form</span>

      {/* Newest on the left, matching the match list further down the page.
          A time axis would run the other way, so the strip says which it is
          rather than leaving a 6-4 to be read backwards. */}
      <div className="form-strip-chips">
        {last.map((m, i) => (
          <ResultChip key={m.match_id || i} won={m.won} title={chipTitle(m)} />
        ))}
      </div>

      <span className="form-strip-tally">
        <b className="fs-w">{wins}W</b>
        <span className="fs-sep">–</span>
        <b className="fs-l">{losses}L</b>
      </span>

      <span className="form-strip-hint">newest first</span>
    </div>
  );
}
