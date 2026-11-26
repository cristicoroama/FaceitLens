import { useEffect, useState } from "react";
import { fetchDemoCoach } from "../lib/demo-api.js";
import "../styles/demo.css";

function fmt(value, unit) {
  if (value == null) return "—";
  if (unit === "%") return `${value}%`;
  if (unit === "$") return `$${value}`;
  return `${value}×`;
}

function FocusArea({ area, index }) {
  const focus = area.status === "focus";
  return (
    <div className={`demo-focus ${focus ? "demo-focus-on" : ""}`}>
      <div className="demo-focus-head">
        <span className="demo-focus-num">{index + 1}</span>
        <span className="demo-focus-title">{area.title}</span>
        <span className={`demo-pill ${focus ? "demo-pill-bad" : "demo-pill-good"}`}>
          {focus ? "Focus" : "On track"}
        </span>
      </div>
      <div className="demo-focus-nums">
        <span className="demo-strong">{fmt(area.value, area.unit)}</span>
        <span className="demo-muted">vs {fmt(area.baseline, area.unit)} for your level</span>
      </div>
      <div className="demo-focus-evidence">{area.evidence}</div>
      <div className="demo-focus-tip">{area.tip}</div>
    </div>
  );
}

export default function DemoCoach({ nickname }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setData(null);
    fetchDemoCoach(nickname)
      .then((j) => alive && setData(j))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [nickname]);

  const askAi = async () => {
    setAiLoading(true);
    try {
      setData(await fetchDemoCoach(nickname, { ai: true }));
    } catch (e) {
      setError(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return <div className="demo-card demo-muted">Building your coach report…</div>;
  if (error) return <div className="demo-card demo-status-error">{error}</div>;
  if (!data?.available) {
    return (
      <div className="demo-card demo-muted">
        The coach needs parsed demos. Parse a few of your recent matches first.
      </div>
    );
  }
  if (!data.focus_areas.length) {
    return (
      <div className="demo-card">
        <div className="demo-title">Coach</div>
        <div className="demo-muted">{data.summary}</div>
      </div>
    );
  }

  return (
    <div className="demo-card">
      <div className="demo-card-head">
        <div>
          <div className="demo-title">Coach: 3 things to work on</div>
          <div className="demo-sub">
            From your last {data.matches} parsed matches ({data.rounds} rounds), compared with typical level{" "}
            {data.level ?? "?"} players
          </div>
        </div>
        {!data.ai_summary && (
          <button type="button" className="btn ghost" onClick={askAi} disabled={aiLoading}>
            {aiLoading ? "Writing…" : "AI practice plan"}
          </button>
        )}
      </div>
      <div className="demo-focus-grid">
        {data.focus_areas.map((a, i) => (
          <FocusArea key={a.key} area={a} index={i} />
        ))}
      </div>
      <div className="demo-summary">{data.ai_summary || data.summary}</div>
    </div>
  );
}
