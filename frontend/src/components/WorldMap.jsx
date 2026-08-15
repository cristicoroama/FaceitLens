import { useState, useEffect, useMemo, useRef } from "react";
import { Flag } from "./RankIcons.jsx";
import { COUNTRY_NAMES } from "../country-names.js";
import { Icon } from "../icons.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

/* One-hue sequential ramp, brand orange at hue 42.2°, lightness rising
   monotonically from a near-surface grey. Magnitude is the only thing colour
   encodes here, so there is exactly one hue — a second would read as a
   category, not as "more". */
const RAMP = ["#332c29", "#503e37", "#754d3e", "#9e5a3f", "#cd6438", "#ff6a21"];
const NO_DATA = "#17171c";

const METRICS = {
  count: {
    label: "Players",
    hint: "How many of the region's top 1,000 come from each country.",
    /* Counts run from 1 to several hundred, so a linear scale would leave four
       countries orange and the rest indistinguishable. Log spreads the middle
       of the field back out. */
    scale: (v, max) => (max <= 1 ? 1 : Math.log(v) / Math.log(max)),
    format: (v) => v.toLocaleString(),
  },
  avg_elo: {
    label: "Avg ELO",
    hint: "The average ELO of those players — how strong the top is, not how big.",
    /* ELO across countries lives in a narrow band, so the ramp is stretched
       over the observed range instead of anchored at zero, where every country
       would land on the same step. */
    scale: (v, max, min) => (max === min ? 1 : (v - min) / (max - min)),
    format: (v) => v.toLocaleString(),
  },
};

export default function WorldMap({ onPick, onCountry }) {
  const [shapes, setShapes] = useState(null);
  const [data, setData] = useState(null);
  const [metric, setMetric] = useState("count");
  const [view, setView] = useState("world");
  const [hover, setHover] = useState(null);
  const [error, setError] = useState("");
  const wrapRef = useRef(null);

  // 120 KB of coastline has no business in the main bundle — every other page
  // would carry it to render a map they never show.
  useEffect(() => {
    let alive = true;
    import("../world-map-data.js")
      .then((m) => alive && setShapes(m))
      .catch(() => alive && setError("Couldn't load the map."));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/leaderboard/countries/`)
      .then((r) => r.json().then((j) => {
        if (!r.ok) throw new Error(j.error || "Couldn't load the rankings.");
        return j;
      }))
      .then((j) => alive && setData(j))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, []);

  const { byCode, ranked, max, min } = useMemo(() => {
    const list = data?.countries || [];
    // A two-player country can average 3,500 ELO and would otherwise top the
    // map on a sample nobody would call a scene.
    const scored = metric === "avg_elo" ? list.filter((c) => !c.thin) : list;
    const values = scored.map((c) => c[metric]);
    return {
      byCode: Object.fromEntries(list.map((c) => [c.country, c])),
      ranked: [...scored].sort((a, b) => b[metric] - a[metric]),
      max: values.length ? Math.max(...values) : 1,
      min: values.length ? Math.min(...values) : 0,
    };
  }, [data, metric]);

  function fill(code) {
    const c = code && byCode[code];
    if (!c) return NO_DATA;
    if (metric === "avg_elo" && c.thin) return NO_DATA;
    const t = METRICS[metric].scale(c[metric], max, min);
    return RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.round(t * (RAMP.length - 1))))];
  }

  function show(code, e) {
    if (!code || !byCode[code]) return setHover(null);
    const box = wrapRef.current?.getBoundingClientRect();
    const x = e.clientX - (box?.left || 0);
    setHover({
      code,
      x,
      y: e.clientY - (box?.top || 0),
      // Asia and Oceania sit at the right edge, where a tooltip anchored to the
      // cursor's right would hang off the panel.
      flip: x > (box?.width || 0) - 230,
    });
  }

  if (error) {
    return (
      <div className="panel">
        <div className="empty-state">
          <div className="empty-ico">{Icon.exclamationTriangle}</div>
          <h3>{error}</h3>
        </div>
      </div>
    );
  }

  const loading = !shapes || !data;
  const m = METRICS[metric];
  const hovered = hover && byCode[hover.code];
  const viewBox = shapes
    ? (shapes.WORLD_VIEWS.find((v) => v.key === view)?.viewBox || shapes.WORLD_VIEWBOX)
    : "";
  // How much narrower this view is than the whole map — 1 at world zoom.
  const zoom = shapes
    ? Number(viewBox.split(" ")[2]) / Number(shapes.WORLD_VIEWBOX.split(" ")[2])
    : 1;

  return (
    <>
      <div className="page-hero">
        <h1 className="page-hero-title">
          Where the <em>Best</em> CS2 Players Are
        </h1>
        <p className="page-hero-sub">
          Every country in FACEIT's Challenger pool — the top{" "}
          {(data?.depth || 1000).toLocaleString()} of each region's ELO ladder —
          counted and ranked. Hover a country for its numbers, click it for the
          players.
        </p>
      </div>

      <div className="wm-bar">
        <div className="wm-toggle">
          {Object.entries(METRICS).map(([key, def]) => (
            <button
              key={key}
              className={`wm-tab ${metric === key ? "on" : ""}`}
              onClick={() => setMetric(key)}
            >
              {def.label}
            </button>
          ))}
        </div>
        <span className="wm-hint">{m.hint}</span>
      </div>

      <div className="panel wm-panel" ref={wrapRef}>
        {loading ? (
          <div className="skeleton tall" />
        ) : (
          <>
            <div className="wm-views">
              {shapes.WORLD_VIEWS.map((v) => (
                <button
                  key={v.key}
                  className={`wm-view ${view === v.key ? "on" : ""}`}
                  onClick={() => setView(v.key)}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <svg
              className="wm-svg"
              viewBox={viewBox}
              // Borders and dots are measured in user units, so zooming in
              // would fatten them: Malta's dot swelled into a blob over Sicily
              // at Europe zoom. Shrinking them by the same factor the view
              // magnifies keeps both a constant size on screen.
              style={{ "--wm-k": zoom }}
              role="img"
              aria-label={`World map of CS2 ${m.label.toLowerCase()} by country`}
              onMouseLeave={() => setHover(null)}
            >
              {shapes.COUNTRY_SHAPES.map((s, i) => (
                <path
                  key={s.code || `x${i}`}
                  d={s.d}
                  fill={fill(s.code)}
                  className={byCode[s.code] ? "wm-c on" : "wm-c"}
                  onMouseMove={(e) => show(s.code, e)}
                  onClick={() => byCode[s.code] && onCountry(byCode[s.code])}
                />
              ))}
              {shapes.COUNTRY_DOTS.map((d) => (
                <circle
                  key={d.code}
                  cx={d.x}
                  cy={d.y}
                  r={(byCode[d.code] ? 3.4 : 1.6) * zoom}
                  fill={fill(d.code)}
                  className={byCode[d.code] ? "wm-c wm-dot on" : "wm-c wm-dot"}
                  onMouseMove={(e) => show(d.code, e)}
                  onClick={() => byCode[d.code] && onCountry(byCode[d.code])}
                />
              ))}
            </svg>

            {hovered && (
              <div
                className={`wm-tip ${hover.flip ? "flip" : ""}`}
                style={{ left: hover.x, top: hover.y }}
              >
                <div className="wm-tip-head">
                  <Flag country={hovered.country} size={16} />
                  {COUNTRY_NAMES[hovered.country] || hovered.country.toUpperCase()}
                </div>
                <div className="wm-tip-row">
                  <span>Players</span><b>{hovered.count.toLocaleString()}</b>
                </div>
                <div className="wm-tip-row">
                  <span>Avg ELO</span>
                  <b>{hovered.thin ? "—" : hovered.avg_elo.toLocaleString()}</b>
                </div>
                {hovered.top && (
                  <div className="wm-tip-top">
                    Best: <b>{hovered.top.nickname}</b> · {hovered.top.elo.toLocaleString()}
                  </div>
                )}
              </div>
            )}

            <div className="wm-legend">
              <span className="wm-leg-cap">
                {metric === "count" ? "1" : min.toLocaleString()}
              </span>
              <div className="wm-leg-ramp">
                {RAMP.map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </div>
              <span className="wm-leg-cap">{max.toLocaleString()}</span>
              <span className="wm-leg-none">
                <i style={{ background: NO_DATA }} />
                {metric === "count"
                  ? "none ranked"
                  : `under ${data.min_for_avg} players`}
              </span>
            </div>
          </>
        )}
      </div>

      {!loading && (
        <div className="panel wm-table">
          <div className="panel-head">
            <span className="panel-title">Countries by {m.label.toLowerCase()}</span>
            <span className="panel-sub">
              {data.total.toLocaleString()} players · top {data.depth.toLocaleString()} per region
            </span>
          </div>
          {ranked.map((c, i) => (
            <button
              className="wm-row"
              key={c.country}
              onClick={() => onCountry(c)}
              onMouseEnter={() => setHover(null)}
            >
              <span className="wm-rank">{i + 1}</span>
              <Flag country={c.country} size={15} />
              <span className="wm-name">
                {COUNTRY_NAMES[c.country] || c.country.toUpperCase()}
              </span>
              {c.top && (
                <span
                  className="wm-top"
                  onClick={(e) => { e.stopPropagation(); onPick(c.top.nickname); }}
                >
                  {c.top.nickname}
                </span>
              )}
              <span className="wm-val">{m.format(c[metric])}</span>
              <span className="wm-bar-track">
                <i
                  style={{
                    width: `${Math.max(2, m.scale(c[metric], max, min) * 100)}%`,
                    background: fill(c.country),
                  }}
                />
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
