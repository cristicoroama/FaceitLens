import { useState, useEffect, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * The page a streamer drops into OBS as a Browser Source.
 *
 * Constraints that shape everything here:
 *
 * - It renders on top of gameplay, so the background must be genuinely
 *   transparent and every value needs a dark scrim behind it. White text on a
 *   bright Mirage wall is unreadable without one.
 * - It runs unattended for hours. A failed poll must never blank the overlay
 *   or leave an error on someone's stream — the last good state stays up.
 * - No WebSocket. Polling every 10s is imperceptible for ELO, and it means no
 *   always-on server behind it.
 */

const POLL_MS = 10000;

function Level({ level }) {
  if (!level) return null;
  return <span className={`ovl-level lvl-${level}`}>{level}</span>;
}

export default function StreamOverlay({ token }) {
  const [state, setState] = useState(null);
  const [ready, setReady] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    // OBS composites onto the page background; anything opaque here shows up
    // as a black box over the stream.
    const prev = document.body.style.background;
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => { document.body.style.background = prev; };
  }, []);

  useEffect(() => {
    if (!token) return;
    let alive = true;

    async function poll() {
      try {
        const r = await fetch(`${API_BASE}/api/overlay/${encodeURIComponent(token)}/`);
        const j = await r.json();
        // Only replace what's on screen with something that actually worked.
        // A blip mid-stream leaves the previous numbers up rather than clearing.
        if (alive && j?.ok) setState(j);
      } catch { /* keep the last good state */ } finally {
        if (alive) setReady(true);
      }
    }

    poll();
    timer.current = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(timer.current); };
  }, [token]);

  if (!ready) return null;

  // A bad token, or an account with no FACEIT link — say so quietly rather
  // than sitting blank while the streamer wonders what's wrong.
  if (!state) {
    return (
      <div className="ovl ovl-msg">
        Overlay not found — check the URL in your Browser Source.
      </div>
    );
  }

  const show = state.show || {};
  const s = state.session || {};
  const delta = s.elo_delta;

  return (
    <div className="ovl">
      <div className="ovl-card">
        {state.avatar && <img className="ovl-av" src={state.avatar} alt="" />}

        <div className="ovl-main">
          <div className="ovl-top">
            <span className="ovl-nick">{state.nickname}</span>
            <Level level={state.level} />
          </div>

          <div className="ovl-row">
            {show.elo && state.elo != null && (
              <span className="ovl-elo">{state.elo.toLocaleString()}</span>
            )}
            {show.session && delta != null && delta !== 0 && (
              <span className={`ovl-delta ${delta > 0 ? "up" : "down"}`}>
                {delta > 0 ? "+" : ""}{delta}
              </span>
            )}
            {show.session && (s.wins > 0 || s.losses > 0) && (
              <span className="ovl-wl">
                <b className="w">{s.wins}</b>
                <span className="sep">–</span>
                <b className="l">{s.losses}</b>
              </span>
            )}
          </div>
        </div>
      </div>

      {show.match && state.match && (
        <div className="ovl-card ovl-match">
          <span className="ovl-live">LIVE</span>
          {state.match.map && (
            <span className="ovl-map">
              {state.match.map.replace(/^de_/, "")}
            </span>
          )}
          {state.match.competition && (
            <span className="ovl-comp">{state.match.competition}</span>
          )}
        </div>
      )}

      {show.brand && <div className="ovl-brand">faceit-lens.com</div>}
    </div>
  );
}
