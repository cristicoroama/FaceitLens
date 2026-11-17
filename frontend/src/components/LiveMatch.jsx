import { useState, useEffect } from "react";
import { MapIcon, mapLabel } from "../map-art.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";
const POLL_MS = 30000;

/* Dev-only way to see the strip without waiting for someone to queue: append
   ?live=preview to a profile URL under `npm run dev`. Compiled out of the
   production bundle by the DEV check, so it can never fake a live match on
   the real site. */
const PREVIEW = import.meta.env.DEV
  && typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("live") === "preview";

const PREVIEW_MATCH = {
  match_id: "preview",
  state: "live",
  map: "de_mirage",
  competition: "Europe 5v5 Queue",
  teams: [],
  started_at: Math.floor(Date.now() / 1000) - 17 * 60,
  faceit_url: "https://www.faceit.com/",
};

/**
 * Live status that keeps itself current while the profile is open.
 *
 * Starts from the summary's answer, so the strip is there on first paint with
 * no extra request. Then asks /api/live/ every thirty seconds — a match that
 * starts while you are reading someone's profile now appears without a reload,
 * and one that ends now clears instead of lingering.
 *
 * Paused while the tab is hidden: people leave stats tabs open for hours, and
 * polling a page nobody is looking at is pure cost.
 */
function useLiveStatus(playerId, initial) {
  const [live, setLive] = useState(initial ?? null);

  useEffect(() => { setLive(initial ?? null); }, [playerId, initial]);

  useEffect(() => {
    if (!playerId || PREVIEW) return undefined;
    let alive = true;
    let timer = null;

    async function check() {
      try {
        const r = await fetch(`${API_BASE}/api/live/${encodeURIComponent(playerId)}/`);
        if (!r.ok) return;
        const j = await r.json();
        // `ok: false` means FACEIT could not be asked. Keep the last answer
        // rather than clearing a real badge because of a network blip.
        if (alive && j.ok) setLive(j.live ?? null);
      } catch {
        /* keep the last known state */
      }
    }

    function schedule() {
      clearInterval(timer);
      if (document.visibilityState === "visible") {
        timer = setInterval(check, POLL_MS);
      }
    }

    function onVisibility() {
      // Coming back to the tab: answer immediately instead of waiting out the
      // interval with a state that may be half an hour old.
      if (document.visibilityState === "visible") check();
      schedule();
    }

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [playerId]);

  return PREVIEW ? PREVIEW_MATCH : live;
}

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

export default function LiveMatch({ playerId, initial, nickname }) {
  const live = useLiveStatus(playerId, initial);
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
