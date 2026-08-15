import { FaceitLevel, Flag } from "./RankIcons.jsx";

/**
 * The overlay card itself — pure presentation, no fetching.
 *
 * Extracted so the OBS page and the customiser render the *same* component.
 * A separate "preview" markup would drift from the real thing within a week
 * and then the preview would be lying, which is worse than having no preview.
 *
 * Layout follows the shape every CS2 overlay has converged on, because it is
 * the one that reads at 720p from two metres away: identity on top, one big
 * number, then a row of labelled cells. Label above, value below — a bare row
 * of numbers means nothing to a viewer who just tuned in.
 *
 * Appearance lives in the URL rather than the database. Three reasons: a
 * streamer can point two OBS scenes at one account and style them differently;
 * changing a slider needs no round-trip, so the preview is genuinely live; and
 * it needed no migration.
 */

export const LOOK_DEFAULTS = {
  a: "ff6a21",   // accent
  r: 12,         // corner radius, px
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
    r: num("r", 0, 28),
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
    "--ovl-radius": `${look.r}px`,
  };
}

const nf = (n) => (n == null ? null : n.toLocaleString());

/** One labelled cell. Renders nothing at all rather than a dash. */
function Cell({ label, value, tone }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="ovl-cell">
      <span className="ovl-cell-k">{label}</span>
      <span className={`ovl-cell-v${tone ? ` ${tone}` : ""}`}>{value}</span>
    </div>
  );
}

export default function OverlayCard({ state, look = LOOK_DEFAULTS }) {
  const show = state.show || {};
  const s = state.session || {};
  const r = state.recent || {};
  const delta = s.elo_delta;
  const form = state.form || [];

  const today =
    delta == null ? null : `${delta > 0 ? "+" : ""}${delta}`;

  // One box, deliberately. A floating match strip and a floating credit meant
  // three separate scrims sliding around over the gameplay; everything now
  // lives inside the single frame.
  return (
    <div className="ovl" style={lookToStyle(look)}>
      <div className="ovl-card">

        <div className="ovl-top">
          {look.av && state.avatar && (
            <img className="ovl-av" src={state.avatar} alt="" />
          )}

          <div className="ovl-id">
            <span className="ovl-nick">{state.nickname}</span>
            <span className="ovl-ranks">
              {state.country && state.rank_country > 0 && (
                <span className="ovl-rank">
                  <Flag country={state.country} size={14} />
                  #{nf(state.rank_country)}
                </span>
              )}
              {state.region && state.rank > 0 && (
                <span className="ovl-rank">
                  <span className="ovl-region">{state.region}</span>
                  #{nf(state.rank)}
                </span>
              )}
            </span>
          </div>

          {show.elo && state.elo != null && (
            <div className="ovl-elo-box">
              {state.level ? <FaceitLevel level={state.level} size={30} /> : null}
              <div className="ovl-cell">
                <span className="ovl-cell-k">Elo</span>
                <span className="ovl-elo">{nf(state.elo)}</span>
              </div>
            </div>
          )}
        </div>

        {show.session && (form.length > 0 || s.wins || s.losses || today) && (
          <div className="ovl-bottom">
            <Cell label="Wins" value={s.wins ?? null} tone="up" />
            <Cell label="Losses" value={s.losses ?? null} tone="down" />
            <Cell
              label="Today"
              value={today}
              tone={delta > 0 ? "up" : delta < 0 ? "down" : undefined}
            />
            <Cell label="K/D" value={r.kd} />
            <Cell label="ADR" value={r.adr} />
            <Cell label="HS%" value={r.hs == null ? null : `${r.hs}%`} />
            <Cell
              label="Win%"
              value={r.winrate == null ? null : `${r.winrate}%`}
            />

            {form.length > 0 && (
              <div className="ovl-cell ovl-form-cell">
                <span className="ovl-cell-k">Last {form.length}</span>
                <span className="ovl-form">
                  {form.map((f, i) => (
                    <i
                      key={i}
                      className={`ovl-pip ${f.win ? "w" : "l"}`}
                      title={`${f.win ? "Win" : "Loss"}${f.map ? ` — ${f.map}` : ""}`}
                    />
                  ))}
                </span>
              </div>
            )}
          </div>
        )}
        {show.match && state.match && (
          <div className="ovl-match">
            <span className="ovl-live">LIVE</span>
            {state.match.map && (
              <span className="ovl-map">{state.match.map.replace(/^de_/, "")}</span>
            )}
            {state.match.competition && (
              <span className="ovl-comp">{state.match.competition}</span>
            )}
            {show.brand && <span className="ovl-brand">faceit-lens.com</span>}
          </div>
        )}

        {show.brand && !(show.match && state.match) && (
          <div className="ovl-match ovl-credit-only">
            <span className="ovl-brand">faceit-lens.com</span>
          </div>
        )}
      </div>
    </div>
  );
}
