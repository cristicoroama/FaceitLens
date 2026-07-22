function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

export default function Nicknames({ nicknames }) {
  if (!nicknames || nicknames.length <= 1) {
    return (
      <div className="state">
        No nickname changes recorded yet. FaceitLens starts tracking nicknames
        from the first time a player is searched.
      </div>
    );
  }
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7V5h16v2M12 5v14M9 19h6" />
          </svg>
        </div>
        <div className="panel-title">Known Nicknames</div>
        <span className="panel-count">{nicknames.length}</span>
      </div>
      <div className="lrows stagger">
        {nicknames.map((n) => (
          <div className="lrow" key={n.nickname}>
            <div className="lrow-ava">{initials(n.nickname)}</div>
            <div className="lrow-main">
              <div className="lrow-name">{n.nickname}</div>
            </div>
            <div className="lrow-side">
              <div className="lrow-dim">
                first seen {new Date(n.first_seen).toLocaleDateString("en-GB")}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
