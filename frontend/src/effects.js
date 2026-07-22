/* ============================================================
   FaceitLens — premium interaction layer
   1) Cursor spotlight on glass cards (feeds --mx/--my to CSS)
   2) 3D tilt on small cards
   Implemented with a single delegated pointermove listener +
   requestAnimationFrame, so it costs almost nothing and needs
   zero changes inside React components.
   ============================================================ */

const SPOTLIGHT_SEL = [
  ".hf-card", ".ov-card", ".stat", ".session-item", ".ravg-cell",
  ".rank-card", ".player-hero", ".game-card", ".trust-card",
  ".leet-ring", ".leet-rank", ".compare", ".chart-wrap", ".maps",
  ".mates", ".squad", ".inv-item", ".medal", ".gl", ".real-stat",
  ".real-hero", ".elo-ex-item", ".hltv-grid", ".leet-comp-tile",
  ".game-opt", ".game-prompt", ".squad-summary-item", ".lvlprog",
  ".activity", ".ai-panel", ".match",
].join(",");

const TILT_SEL = [
  ".hf-card", ".stat", ".ov-card", ".session-item", ".ravg-cell",
  ".inv-item", ".medal", ".game-card", ".real-stat",
  ".leet-comp-tile", ".elo-ex-item", ".game-opt",
].join(",");

const MAX_TILT = 7; // degrees

function initEffects() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.matchMedia("(hover: none)").matches) return; // skip touch devices

  let lastSpot = null;
  let lastTilt = null;
  let pending = null;
  let raf = 0;

  function resetTilt(el) {
    if (!el) return;
    el.style.transform = "";
    el.style.willChange = "";
  }

  function clearSpot(el) {
    if (!el) return;
    el.classList.remove("fx-spot");
  }

  function frame() {
    raf = 0;
    const e = pending;
    if (!e) return;

    /* ---- spotlight ---- */
    const spot = e.target.closest?.(SPOTLIGHT_SEL) || null;
    if (spot !== lastSpot) {
      clearSpot(lastSpot);
      lastSpot = spot;
      if (spot) spot.classList.add("fx-spot");
    }
    if (spot) {
      const r = spot.getBoundingClientRect();
      spot.style.setProperty("--mx", `${e.clientX - r.left}px`);
      spot.style.setProperty("--my", `${e.clientY - r.top}px`);
    }

    /* ---- 3D tilt ---- */
    const tilt = e.target.closest?.(TILT_SEL) || null;
    if (tilt !== lastTilt) {
      resetTilt(lastTilt);
      lastTilt = tilt;
      if (tilt) {
        // entrance animations hold their final transform; drop them so
        // the inline tilt transform can take over
        tilt.style.animation = "none";
        tilt.style.willChange = "transform";
      }
    }
    if (tilt) {
      const r = tilt.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;  // -0.5 .. 0.5
      const py = (e.clientY - r.top) / r.height - 0.5;
      const rx = (-py * MAX_TILT).toFixed(2);
      const ry = (px * MAX_TILT).toFixed(2);
      tilt.style.transform =
        `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-3px) scale(1.012)`;
    }
  }

  document.addEventListener(
    "pointermove",
    (e) => {
      pending = e;
      if (!raf) raf = requestAnimationFrame(frame);
    },
    { passive: true }
  );

  // pointer left the window entirely
  document.addEventListener("pointerleave", () => {
    resetTilt(lastTilt);
    clearSpot(lastSpot);
    lastTilt = null;
    lastSpot = null;
  });

  // clicking through to another view unmounts nodes; drop stale refs
  document.addEventListener("click", () => {
    requestAnimationFrame(() => {
      if (lastTilt && !document.contains(lastTilt)) lastTilt = null;
      if (lastSpot && !document.contains(lastSpot)) lastSpot = null;
    });
  });
}

initEffects();
