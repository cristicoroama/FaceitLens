import { useCallback, useEffect, useRef, useState } from "react";
import { communityJson, sendGoal } from "../lib/community-api.js";
import "../styles/community.css";

const UNITS = { elo: "", kd: "", hs: "%", adr: "", winrate: "%" };
const STEP = { elo: 1, kd: 0.01, hs: 1, adr: 1, winrate: 1 };

function fmt(metric, v) {
  if (v == null) return "—";
  const n = Number(v);
  return `${metric === "kd" ? n.toFixed(2) : Math.round(n)}${UNITS[metric] || ""}`;
}

export default function Goals({ user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [signedOut, setSignedOut] = useState(false);
  const [metric, setMetric] = useState("elo");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  const apply = useCallback((p) => p
    .then((j) => { if (alive.current) { setData(j); setError(null); } })
    .catch((e) => {
      if (!alive.current) return;
      if (e.status === 401) setSignedOut(true);
      else setError(e.message);
    }), []);

  useEffect(() => {
    if (user === null) { setSignedOut(true); return; }
    setSignedOut(false);
    apply(communityJson("/api/community/goals/", { credentials: "include" }));
  }, [user, apply]);

  async function add(e) {
    e.preventDefault();
    if (!target || busy) return;
    setBusy(true);
    await apply(sendGoal("POST", "/api/community/goals/", { metric, target: Number(target) }));
    if (alive.current) { setBusy(false); setTarget(""); }
  }

  function remove(id) {
    apply(sendGoal("DELETE", `/api/community/goals/${id}/`));
  }

  const header = (
    <div className="panel-head">
      <div className="panel-ic">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" />
        </svg>
      </div>
      <div className="panel-title">Goals</div>
      <div className="panel-sub">vs your last 30 matches</div>
    </div>
  );

  if (signedOut) {
    return (
      <div className="panel cm-panel">
        {header}
        <div className="cm-empty">Sign in to set ELO, K/D, HS%, ADR or win-rate goals and track them here.</div>
      </div>
    );
  }

  const metrics = data?.metrics || [];
  const current = metrics.find((m) => m.id === metric);
  const items = data?.items || [];

  return (
    <div className="panel cm-panel">
      {header}
      {error && <div className="cm-empty">{error}</div>}
      {data && !data.linked && (
        <div className="cm-note">Link your FACEIT account to measure progress. Goals still save without it.</div>
      )}

      {items.length === 0 && data && <div className="cm-empty">No goals yet. Pick a metric and a target below.</div>}

      {items.length > 0 && (
        <ul className="cm-goals">
          {items.map((g) => (
            <li key={g.id} className={`cm-goal${g.achieved ? " done" : ""}`}>
              <div className="cm-goal-head">
                <span className="cm-goal-label">{g.label} <b>{fmt(g.metric, g.target)}</b></span>
                <span className="cm-goal-now">
                  {g.achieved ? "Achieved" : `now ${fmt(g.metric, g.current)}`}
                </span>
                <button type="button" className="cm-x" onClick={() => remove(g.id)} aria-label={`Remove ${g.label} goal`}>×</button>
              </div>
              <div className="cm-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={g.achieved ? 100 : (g.progress ?? 0)}>
                <div className="cm-bar-fill" style={{ width: `${g.achieved ? 100 : (g.progress ?? 0)}%` }} />
              </div>
              {g.start_value != null && !g.achieved && (
                <div className="cm-goal-sub">started at {fmt(g.metric, g.start_value)} · {g.progress ?? 0}% of the way</div>
              )}
            </li>
          ))}
        </ul>
      )}

      {data && (
        <form className="cm-goal-form" onSubmit={add}>
          <select className="cm-select" value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="Metric">
            {metrics.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <input className="cm-input" type="number" inputMode="decimal" value={target}
            min={current?.min} max={current?.max} step={STEP[metric] || 1}
            placeholder={data.stats?.[metric] != null ? `now ${fmt(metric, data.stats[metric])}` : "Target"}
            onChange={(e) => setTarget(e.target.value)} aria-label="Target" />
          <button className="act-btn" type="submit" disabled={busy || !target}>Add goal</button>
        </form>
      )}
    </div>
  );
}
