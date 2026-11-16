import { useState, useEffect } from "react";
import { MapIcon, mapLabel } from "../map-art.jsx";

/**
 * "In a match right now", as a row of the data layout rather than an alert.
 *
 * Three decisions worth recording, because each had an obvious wrong answer:
 *
 * Amber, not red and not green. Red is the broadcast convention (and Twitch
 * owns it so thoroughly that a red LIVE pill reads as an unlicensed embed),
 * but on a page whose every other row is win/loss, red already means lost and
 * green already means won. Amber is the only unclaimed signal, and it happens
 * to be the conventional colour for "in flight".
 *
 * It carries a payload. A badge that says only LIVE costs a row of vertical
 * space to tell you nothing you can act on; this one names the map, the queue,
 * how long they have been in, and links to the room.
 *
 * The clock is the animation. A minute counter that moves on its own is
 * self-evidently live and costs no visual noise, which is why the pulsing dot
 * is kept small and slow rather than made the main event.
 */
function elapsedLabel(startedAt) {
  if (!startedAt) return null;
  const mins = Math.floor((Date.now() / 1000 - startedAt) / 60);
  if (mins < 0) return null;
  if (mins < 1) return "just started";
  if (mins < 60) return `${mins}m in`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m in`;
}

export default function LiveMatch({ live, nickname }) {
  // Re-render on a timer so the counter moves. Thirty seconds, not one: the
  // number only changes by the minute, and a per-second interval would wake
  // the tab sixty times for fifty-nine no-ops.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!live?.started_at) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, [live?.started_at]);

  if (!live) return null;

  const starting = live.state === "starting";
  const elapsed = starting ? null : elapsedLabel(live.started_at);
  const map = live.map ? mapLabel(live.map) : null;

  const facts = [
    map,
    live.competition,
    elapsed,
    starting ? "picking the map" : null,
  ].filter(Boolean);

  return (
    <div className={`lv ${starting ? "lv-starting" : ""}`}>
      <span className="lv-mark">
        <i className="lv-dot" aria-hidden="true" />
        {starting ? "Starting" : "Live"}
      </span>

      {live.map && <MapIcon map={live.map} size={18} className="lv-map-ic" />}

      <span className="lv-facts">
        {facts.map((f, i) => (
          <span className="lv-fact" key={i}>{f}</span>
        ))}
      </span>

      {live.faceit_url && (
        <a
          className="lv-go"
          href={live.faceit_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Match room
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
               strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </a>
      )}

      {/* Spoken once, on mount, rather than on every thirty-second re-render:
          a polite region that re-announced the clock would turn a status into
          a nuisance for anyone listening to the page. */}
      <span className="sr-only" role="status">
        {nickname ? `${nickname} is ` : ""}
        {starting ? "about to start a match" : "in a match right now"}
        {map ? ` on ${map}` : ""}.
      </span>
    </div>
  );
}
