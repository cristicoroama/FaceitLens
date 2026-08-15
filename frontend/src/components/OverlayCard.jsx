/**
 * The overlay card itself — pure presentation, no fetching.
 *
 * Extracted so the OBS page and the customiser render the *same* component.
 * A separate "preview" markup would drift from the real thing within a week
 * and then the preview would be lying, which is worse than having no preview.
 *
 * Appearance lives in the URL rather than the database. Three reasons:
 * a streamer can point two OBS scenes at one account and style them
 * differently; changing a slider needs no round-trip, so the preview is
 * genuinely live; and it needed no migration.
 */

export const LOOK_DEFAULTS = {
  a: "ff6a21",   // accent
  s: 100,        // scale, percent
  bg: 82,        // card background opacity, percent
  r: 12,         // corner radius, px
  lay: "stack",  // stack | row
  av: 1,         // show avatar
};

const HEX = /^[0-9a-fA-F]{6}$/;

/** Read appearance out of a query string, ignoring anything malformed. */
export function readLook(search) {
  const q = new URLSearchParams(search || "");
  const num = (k, lo, hi) => {
    const v = parseInt(q.get(k), 10);
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : LOOK_DEFAULTS[k];
  };
  const a = (q.get("a") || "").replace(/^#/, "");
  return {
    a: HEX.test(a) ? a.toLowerCase() : LOOK_DEFAULTS.a,
    s: num("s", 50, 200),
    bg: num("bg", 0, 100),
    r: num("r", 0, 28),
    lay: q.get("lay") === "row" ? "row" : "stack",
    av: q.get("av") === "0" ? 0 : 1,
  };
}

/** Only non-default values, so a stock overlay URL stays clean. */
export function lookToQuery(look) {
  const q = new URLSearchParams();
  for (const k of Object.keys(LOOK_DEFAULTS)) {
    if (String(look[k]) !== String(LOOK_DEFAULTS[k])) q.set(k, look[k]);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function lookToStyle(look) {
  return {
    "--ovl-accent": `#${look.a}`,
    "--ovl-scale": look.s / 100,
    "--ovl-bg-a": look.bg / 100,
    "--ovl-radius": `${look.r}px`,
  };
}

function Level({ level }) {
  if (!level) return null;
  return <span className={`ovl-level lvl-${level}`}>{level}</span>;
}

export default function OverlayCard({ state, look = LOOK_DEFAULTS }) {
  const show = state.show || {};
  const s = state.session || {};
  const delta = s.elo_delta;

  // ovl-lay-* rather than ovl-row: .ovl-row already means the ELO line inside
  // the card, and one class with two meanings ends badly.
  return (
    <div className={`ovl ovl-lay-${look.lay}`} style={lookToStyle(look)}>
      <div className="ovl-card">
        {look.av && state.avatar && (
          <img className="ovl-av" src={state.avatar} alt="" />
        )}

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
            <span className="ovl-map">{state.match.map.replace(/^de_/, "")}</span>
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
