export default function Activity({ activity }) {
  if (!activity || activity.length === 0) return null;

  const map = {};
  let max = 1;
  activity.forEach((a) => { map[a.date] = a.count; if (a.count > max) max = a.count; });

  // build last 12 weeks (84 days) grid, oldest -> newest
  const days = [];
  const today = new Date();
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, count: map[key] || 0 });
  }

  function shade(c) {
    if (!c) return "var(--bg-elev-2)";
    const t = Math.min(1, c / max);
    const alpha = 0.25 + t * 0.75;
    return `rgba(255, 85, 0, ${alpha})`;
  }

  return (
    <>
      <div className="section-title">Activity (last 12 weeks)</div>
      <div className="activity">
        <div className="activity-grid">
          {days.map((d) => (
            <div
              key={d.key}
              className="activity-cell"
              style={{ background: shade(d.count) }}
              title={`${d.key}: ${d.count} ${d.count === 1 ? "match" : "matches"}`}
            />
          ))}
        </div>
      </div>
    </>
  );
}
