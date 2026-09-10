import { useState, useRef, useEffect, useCallback } from "react";

const ROUNDS = 5;

/* The wait before the light turns green.
 *
 * Random, and never shorter than a second and a half: a fixed delay is
 * learnable within two attempts, and a short one measures anticipation rather
 * than reaction. The spread is wide enough that counting doesn't help. */
const MIN_WAIT = 1500;
const MAX_WAIT = 4500;

/* Below this the click left before the colour changed. Simple visual reaction
 * bottoms out near 100ms in the literature and the fastest players sit around
 * 120, so anything under 80 is a guess that happened to land. Matches the
 * floor the API enforces on submission. */
const HUMAN_FLOOR = 80;

const STATE = {
  IDLE: "idle",
  WAITING: "waiting",
  GO: "go",
  RESULT: "result",
  EARLY: "early",
};

function verdict(ms) {
  if (ms < 180) return "Pro reflexes";
  if (ms < 220) return "Very fast";
  if (ms < 270) return "Above average";
  if (ms < 320) return "Average";
  return "Room to improve";
}

/** Click-when-green reaction test, five rounds, averaged.
 *
 * The score is the mean rather than the best round: a single lucky click is
 * mostly noise, and averaging five is what makes two players comparable. */
export default function ReactionTest({ onFinish, onExit }) {
  const [state, setState] = useState(STATE.IDLE);
  const [times, setTimes] = useState([]);
  const [last, setLast] = useState(null);

  // Refs, not state: the click handler reads these at the moment of the click,
  // and a re-render between the colour change and the click would otherwise
  // measure React's scheduling instead of the player.
  const goAt = useRef(0);
  const timer = useRef(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => clearTimer, []);

  const arm = useCallback(() => {
    clearTimer();
    setState(STATE.WAITING);
    const wait = MIN_WAIT + Math.random() * (MAX_WAIT - MIN_WAIT);
    timer.current = setTimeout(() => {
      // performance.now() rather than Date.now(): it is monotonic and
      // sub-millisecond, and it cannot jump if the system clock is adjusted
      // mid-round.
      goAt.current = performance.now();
      setState(STATE.GO);
    }, wait);
  }, []);

  function hit() {
    if (state === STATE.IDLE || state === STATE.RESULT || state === STATE.EARLY) {
      if (times.length >= ROUNDS) return;
      arm();
      return;
    }

    if (state === STATE.WAITING) {
      // Clicked before green. The round is void, not zero — scoring it would
      // reward mashing, which is the one strategy this test must not pay.
      clearTimer();
      setState(STATE.EARLY);
      return;
    }

    if (state === STATE.GO) {
      const ms = Math.round(performance.now() - goAt.current);
      setLast(ms);
      if (ms < HUMAN_FLOOR) {
        setState(STATE.EARLY);
        return;
      }
      const next = [...times, ms];
      setTimes(next);
      setState(STATE.RESULT);
      if (next.length >= ROUNDS) {
        const avg = Math.round(next.reduce((a, b) => a + b, 0) / next.length);
        onFinish?.(avg, next);
      }
    }
  }

  const done = times.length >= ROUNDS;
  const avg = times.length
    ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    : null;

  const copy = {
    [STATE.IDLE]: { title: "Click to start", sub: `${ROUNDS} rounds — click the moment it turns green.` },
    [STATE.WAITING]: { title: "Wait for green…", sub: "Clicking now voids the round." },
    [STATE.GO]: { title: "CLICK!", sub: "" },
    [STATE.RESULT]: {
      title: `${last} ms`,
      sub: done ? "" : `${verdict(last)} — click for round ${times.length + 1}`,
    },
    [STATE.EARLY]: {
      title: "Too early",
      sub: last != null && last < HUMAN_FLOOR
        ? `${last} ms is faster than a human reaction — click to retry.`
        : "You clicked before it turned green — click to retry.",
    },
  }[state];

  return (
    <div className="rt">
      <div className="rt-head">
        <div className="section-title" style={{ margin: 0 }}>Reaction Test</div>
        <button className="act-btn" onClick={onExit}>← Back to games</button>
      </div>

      <button
        type="button"
        className={`rt-pad rt-${state}`}
        onClick={hit}
        // Space and Enter activate it too, because it is a real button. That
        // is deliberate: blocking them to force mouse-only would make the game
        // unplayable without a pointer, and a keypress is no faster than a
        // click anyway.
        aria-live="polite"
      >
        <span className="rt-title">{copy.title}</span>
        {copy.sub && <span className="rt-sub">{copy.sub}</span>}
      </button>

      <div className="rt-rounds">
        {Array.from({ length: ROUNDS }, (_, i) => (
          <span className={`rt-slot${times[i] != null ? " on" : ""}`} key={i}>
            {times[i] != null ? `${times[i]}` : "—"}
          </span>
        ))}
      </div>

      {done && (
        <div className="rt-done">
          <div className="rt-avg">
            <span className="rt-avg-val">{avg}</span>
            <span className="rt-avg-unit">ms average</span>
          </div>
          <div className="rt-verdict">{verdict(avg)}</div>
        </div>
      )}
    </div>
  );
}
