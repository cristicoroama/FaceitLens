import { useEffect, useMemo, useState } from "react";
import { getJson } from "../api.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BLOCKS = ["00–04", "04–08", "08–12", "12–16", "16–20", "20–24"];
const STRENGTH = { "-2": "Much weaker", "-1": "Weaker", "0": "Even", "1": "Stronger", "2": "Much stronger" };

function signed(n, d = 1) {
  if (n == null) return "—";
  const v = Number(n).toFixed(d);
  return n > 0 ? `+${v}` : v;
}

function LuckChart({ series }) {
  const W = 560, H = 150, P = 8;
  let e = 0, a = 0;
  const pts = series.map(([, p, w]) => { e += p; a += w; return [e, a]; });
  const max = Math.max(1, ...pts.map(([x, y]) => Math.max(x, y)));
  const x = (i) => P + (i / Math.max(1, pts.length - 1)) * (W - 2 * P);
  const y = (v) => H - P - (v / max) * (H - 2 * P);
  const line = (k) => pts.map((pt, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(pt[k]).toFixed(1)}`).join(" ");
  return (
    <svg className="an-luck-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
      aria-label="Expected wins against actual wins over the last matches">
      <path d={line(0)} className="an-exp" />
      <path d={line(1)} className="an-act" />
    </svg>
  );
}

function Luck({ l }) {
  if (!l) return null;
  const tone = l.delta >= 1.5 ? "pos" : l.delta <= -1.5 ? "neg" : "";
  const verdict = l.delta >= 1.5 ? "Outperforming the odds" : l.delta <= -1.5 ? "Below the odds" : "Right on the odds";
  return (
    <div className="ins-card an-luck">
      <div className="section-title">Luck vs skill <span className="section-count">last {l.matches}</span></div>
      <div className="an-luck-top">
        <div>
          <div className={`an-big ${tone}`}>{signed(l.delta)}</div>
          <div className="ins-dim">wins vs FACEIT's own forecast</div>
        </div>
        <div className="an-luck-txt">
          <b>{verdict}</b>
          <span>FACEIT expected <b>{l.expected_wins}</b> wins from these matches. You won <b>{l.actual_wins}</b>.</span>
          <span><b className="pos">{l.upsets}</b> upsets won as the underdog · <b className="neg">{l.chokes}</b> losses as the favourite</span>
        </div>
      </div>
      <LuckChart series={l.series} />
      <div className="an-legend"><i className="an-act-dot" />Actual wins <i className="an-exp-dot" />Expected (FACEIT forecast)</div>
      {l.by_strength.length > 0 && (
        <div className="an-strength">
          <div className="ins-dim" style={{ marginBottom: 6 }}>By opponent strength (average skill level vs yours)</div>
          {l.by_strength.map((b) => (
            <div className="an-str-row" key={b.diff}>
              <span className="an-str-lbl">{STRENGTH[String(b.diff)]}</span>
              <div className="ins-bar-track">
                <i style={{ width: `${b.win_rate}%` }} className={b.win_rate >= b.expected ? "pos" : "neg"} />
                <b style={{ left: `${b.expected}%` }} title={`Expected ${b.expected}%`} />
              </div>
              <span className="an-str-val">{b.win_rate}%</span>
              <span className="an-str-n">{b.matches}</span>
            </div>
          ))}
          <div className="ins-dim">The white tick is FACEIT's expected win rate for that group.</div>
        </div>
      )}
    </div>
  );
}

function Heatmap({ timeline }) {
  const [metric, setMetric] = useState("wr");
  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array.from({ length: 6 }, () => ({ n: 0, w: 0, kd: [], adr: [] })));
    for (const [ts, win, kd, adr] of timeline) {
      const d = new Date(ts * 1000);
      const day = (d.getDay() + 6) % 7;
      const c = g[day][Math.floor(d.getHours() / 4)];
      c.n += 1; c.w += win;
      if (kd != null) c.kd.push(kd);
      if (adr != null) c.adr.push(adr);
    }
    return g;
  }, [timeline]);
  if (timeline.length < 20) return null;
  const val = (c) => {
    if (c.n < 3) return null;
    if (metric === "wr") return (100 * c.w) / c.n;
    const arr = metric === "kd" ? c.kd : c.adr;
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  };
  const all = grid.flat().map(val).filter((v) => v != null);
  const lo = Math.min(...all), hi = Math.max(...all);
  const cells = [];
  grid.forEach((row, di) => row.forEach((c, bi) => cells.push({ di, bi, c, v: val(c) })));
  const ranked = cells.filter((x) => x.v != null).sort((a, b) => b.v - a.v);
  const fmt = (v) => (v == null ? "" : metric === "wr" ? `${Math.round(v)}%` : metric === "kd" ? v.toFixed(2) : Math.round(v));
  return (
    <div className="ins-card">
      <div className="section-title">
        When you play best
        <span className="section-count">{timeline.length} matches</span>
        <div className="hub-view">
          {[["wr", "Win rate"], ["kd", "K/D"], ["adr", "ADR"]].map(([k, l]) => (
            <button key={k} type="button" className={`hub-view-opt ${metric === k ? "on" : ""}`} onClick={() => setMetric(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="an-heat">
        <span />
        {BLOCKS.map((b) => <span key={b} className="an-heat-h">{b}</span>)}
        {DAYS.map((d, di) => [
          <span key={d} className="an-heat-d">{d}</span>,
          ...BLOCKS.map((_, bi) => {
            const { c, v } = cells[di * 6 + bi];
            const t = v == null || hi === lo ? null : (v - lo) / (hi - lo);
            return (
              <span key={`${d}-${bi}`} className={`an-cell ${v == null ? "empty" : ""}`}
                style={t == null ? undefined : { "--t": t.toFixed(2) }}
                title={c.n ? `${d} ${BLOCKS[bi]} · ${c.n} matches · ${fmt(v) || "too few"}` : "No matches"}>
                {v != null ? fmt(v) : c.n ? "·" : ""}
              </span>
            );
          }),
        ])}
      </div>
      {ranked.length >= 2 && (
        <div className="an-heat-sum">
          <span>Best: <b className="pos">{DAYS[ranked[0].di]} {BLOCKS[ranked[0].bi]}</b> ({fmt(ranked[0].v)})</span>
          <span>Worst: <b className="neg">{DAYS[ranked.at(-1).di]} {BLOCKS[ranked.at(-1).bi]}</b> ({fmt(ranked.at(-1).v)})</span>
          <span className="ins-dim">Your local time · slots with fewer than 3 matches are greyed out</span>
        </div>
      )}
    </div>
  );
}

function Bar({ label, value, max, unit = "", hint }) {
  if (value == null) return null;
  return (
    <div className="an-prof-row" title={hint}>
      <span className="an-prof-lbl">{label}</span>
      <div className="an-prof-track"><i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>
      <span className="an-prof-val">{value}{unit}</span>
    </div>
  );
}

function Profile({ p }) {
  if (!p) return null;
  const [name, desc] = p.role;
  return (
    <div className="ins-card">
      <div className="section-title">Playstyle <span className="section-count">last {p.matches}</span></div>
      <div className="an-role"><b>{name}</b><span>{desc}</span></div>
      <Bar label="Opening duels taken" value={p.entry_share} max={40} unit="% of rounds" />
      <Bar label="Opening duels won" value={p.entry_success} max={100} unit="%" />
      <Bar label="1v1 clutches won" value={p.v1_rate} max={100} unit="%" hint={`${p.v1_count || 0} attempts`} />
      <Bar label="1v2 clutches won" value={p.v2_rate} max={100} unit="%" hint={`${p.v2_count || 0} attempts`} />
      <Bar label="Utility damage / round" value={p.util_dpr} max={15} />
      <Bar label="Flashes / round" value={p.flash_pr} max={1} />
      <Bar label="Sniper kills / round" value={p.sniper_pr} max={0.6} />
    </div>
  );
}

function Consistency({ c }) {
  if (!c) return null;
  const W = 560, H = 90, P = 6;
  const max = Math.max(140, ...c.series), min = Math.min(30, ...c.series);
  const x = (i) => P + (i / Math.max(1, c.series.length - 1)) * (W - 2 * P);
  const y = (v) => H - P - ((v - min) / (max - min)) * (H - 2 * P);
  const path = c.series.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <div className="ins-card">
      <div className="section-title">Consistency <span className="section-count">last {c.matches}</span></div>
      <div className="an-cons-top">
        <div><div className="an-big">{c.verdict}</div><div className="ins-dim">ADR swings ±{c.cv}% match to match</div></div>
        <div className="an-cons-stats">
          <span>Floor <b>{c.adr_floor}</b></span>
          <span>Average <b>{c.adr_avg}</b></span>
          <span>Ceiling <b>{c.adr_ceiling}</b></span>
          <span>Bad games <b className="neg">{c.bad_rate}%</b></span>
        </div>
      </div>
      <svg className="an-cons-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="ADR per match">
        <rect x="0" width={W} y={y(c.adr_ceiling)} height={Math.max(1, y(c.adr_floor) - y(c.adr_ceiling))} className="an-band" />
        <line x1="0" x2={W} y1={y(c.adr_avg)} y2={y(c.adr_avg)} className="an-avg" />
        <path d={path} className="an-adr" />
      </svg>
      <div className="ins-dim">Shaded band: your usual range (10th–90th percentile). Bad game = under 0.5 kills per round.</div>
    </div>
  );
}

export default function Analysis({ nickname }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setData(null); setError("");
    getJson(`/api/player/${encodeURIComponent(nickname)}/analysis/`)
      .then((j) => alive && setData(j))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [nickname]);

  if (error) return <div className="state error">{error}</div>;
  if (!data) return <div className="state">Crunching the last 200 matches…</div>;
  if (!data.luck && !data.profile && !data.consistency && (data.timeline || []).length < 20) {
    return <div className="state">Not enough recent matches for an analysis yet.</div>;
  }
  return (
    <div className="ins">
      <Luck l={data.luck} />
      <Heatmap timeline={data.timeline || []} />
      <div className="an-two">
        <Profile p={data.profile} />
        <Consistency c={data.consistency} />
      </div>
    </div>
  );
}
