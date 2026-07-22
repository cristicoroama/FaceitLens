function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

export default function Hubs({ hubs }) {
  if (!hubs || hubs.length === 0) {
    return <div className="state">Not in any hubs (or hubs are private).</div>;
  }
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" /><circle cx="5" cy="5" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><path d="M6.5 6.5 10 10M17.5 6.5 14 10M6.5 17.5 10 14M17.5 17.5 14 14" />
          </svg>
        </div>
        <div className="panel-title">Hubs</div>
        <span className="panel-count">{hubs.length}</span>
      </div>
      <div className="lrows stagger">
        {hubs.map((h, i) => (
          <div className="lrow" key={i}>
            <div className="lrow-ava">{initials(h.name)}</div>
            <div className="lrow-main">
              <div className="lrow-name">{h.name}</div>
            </div>
            {h.players != null && (
              <div className="lrow-side">
                <div className="lrow-big">{h.players.toLocaleString()}</div>
                <div className="lrow-dim">players</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
