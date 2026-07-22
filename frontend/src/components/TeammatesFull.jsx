function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

export default function TeammatesFull({ mates }) {
  if (!mates || mates.length === 0) {
    return <div className="state">No teammates found in recent matches.</div>;
  }
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17.5" cy="9.5" r="2.5" /><path d="M15.5 15.5a5 5 0 0 1 6 4.5" />
          </svg>
        </div>
        <div className="panel-title">Teammates</div>
        <span className="panel-count">{mates.length}</span>
        <div className="panel-sub">recent matches</div>
      </div>
      <div className="lrows stagger">
        {mates.map((m, i) => {
          const wr = Number(m.win_rate) || 0;
          const color = wr >= 50 ? "var(--win)" : "var(--loss)";
          return (
            <div className="lrow" key={m.nickname}>
              <span className="lrow-rank">#{i + 1}</span>
              <div className="lrow-ava">{initials(m.nickname)}</div>
              <div className="lrow-main">
                <div className="lrow-name">{m.nickname}</div>
                <div className="lrow-track">
                  <div className="lrow-fill" style={{ width: `${wr}%`, background: color }} />
                </div>
              </div>
              <div className="lrow-side">
                <div className="lrow-big" style={{ color }}>{m.win_rate}%</div>
                <div className="lrow-dim">{m.games} games</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
