import { useState, useRef } from "react";

export default function Activity({ activity }) {
  const [tip, setTip] = useState(null); // {x, y, text}
  const wrapRef = useRef(null);

  if (!activity || activity.length === 0) return null;

  const map = {};
  let max = 1;
  activity.forEach((a) => { map[a.date] = a.count; if (a.count > max) max = a.count; });

  const days = [];
  const today = new Date();
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, count: map[key] || 0 });
  }

  function shade(c) {
    if (!c) return "color-mix(in srgb, var(--bg-elev-3) 60%, transparent)";
    const t = Math.min(1, c / max);
    return `rgba(var(--accent-rgb), ${0.25 + t * 0.75})`;
  }

  function fmt(key) {
    return new Date(key).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function onEnter(e, d) {
    const rect = wrapRef.current.getBoundingClientRect();
    const cell = e.currentTarget.getBoundingClientRect();
    setTip({
      x: cell.left - rect.left + cell.width / 2,
      y: cell.top - rect.top,
      text: `${fmt(d.key)} · ${d.count} ${d.count === 1 ? "match" : "matches"}`,
    });
  }

  return (
    <div className="panel" ref={wrapRef} style={{ position: "relative" }}>
      <div className="panel-head">
        <div className="panel-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" />
          </svg>
        </div>
        <div className="panel-title">Activity</div>
        <div className="panel-sub">last 12 weeks</div>
      </div>
      <div className="activity-grid">
        {days.map((d) => (
          <div
            key={d.key}
            className="activity-cell"
            style={{ background: shade(d.count) }}
            onMouseEnter={(e) => onEnter(e, d)}
            onMouseLeave={() => setTip(null)}
          />
        ))}
      </div>
      {tip && (
        <div className="activity-tip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}
