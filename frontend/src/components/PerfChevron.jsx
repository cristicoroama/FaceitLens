/**
 * Up/down chevrons beside a stat, and the colour that goes with them.
 *
 * Only ever attached to metrics with a REAL reference point. A chevron is a
 * verdict — "this is good" — and a verdict needs something to be good against.
 * K/D and win rate have a structural break-even (as many kills as deaths; as
 * many wins as losses), so 1.00 and 50% are facts, not opinions. Headshot
 * percentage, ADR and the rest have no such line: calling 52% headshots "good"
 * would need a population distribution we do not have, so those stay unmarked
 * rather than carrying a number we made up.
 */

/* [strong-down, down, up, strong-up] — the value is compared against these in
   order. `null` on an end means that band does not exist for the metric. */
export const PERF_BANDS = {
  kd: [0.85, 1.0, 1.0, 1.2],
  winrate: [45, 50, 50, 55],
};

/** -2 strongly bad, -1 bad, 0 neutral, 1 good, 2 strongly good. */
export function perfLevel(value, metric) {
  const bands = PERF_BANDS[metric];
  const v = Number(value);
  if (!bands || !Number.isFinite(v)) return 0;
  const [strongDown, down, up, strongUp] = bands;
  if (v <= strongDown) return -2;
  if (v < down) return -1;
  if (v >= strongUp) return 2;
  if (v >= up) return 1;
  return 0;
}

function Chev({ dir }) {
  return (
    <svg className={`perf-chev ${dir}`} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="3" strokeLinecap="round"
         strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "up" ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
    </svg>
  );
}

const TITLE = { 2: "Excellent", 1: "Good", "-1": "Below average", "-2": "Low" };

export default function PerfChevron({ value, metric }) {
  const level = perfLevel(value, metric);
  if (!level) return null;
  const dir = level > 0 ? "up" : "down";
  return (
    <span className={`perf-ind perf-${dir}`} title={TITLE[level]}>
      <Chev dir={dir} />
      {Math.abs(level) === 2 && <Chev dir={dir} />}
    </span>
  );
}

/** The colour class for the value itself, so number and chevron always agree. */
export function perfClass(value, metric) {
  const level = perfLevel(value, metric);
  return level > 0 ? "up" : level < 0 ? "down" : "";
}
