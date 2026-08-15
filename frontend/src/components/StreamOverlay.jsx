import { useState, useEffect, useRef } from "react";
import OverlayCard, { readLook } from "./OverlayCard.jsx";

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
 *
 * The look comes from the query string (see OverlayCard) so this page needs no
 * extra request before it can draw, and the customiser can preview it exactly.
 */

const POLL_MS = 10000;

export default function StreamOverlay({ token }) {
  const [state, setState] = useState(null);
  const [ready, setReady] = useState(false);
  const timer = useRef(null);
  const look = readLook(window.location.search);

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

  return <OverlayCard state={state} look={look} />;
}
