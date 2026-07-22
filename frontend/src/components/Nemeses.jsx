function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

/** Rivals faced most often. win_rate is the PLAYER's win rate vs them —
    low = they own you. */
export default function Nemeses({ nemeses, onPick }) {
  if (!nemeses || nemeses.length === 0) return null;
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-ic" style={{
          background: "linear-gradient(135deg, rgba(255,92,122,0.2), rgba(255,176,32,0.08))",
          borderColor: "rgba(255,92,122,0.35)", color: "var(--loss)",
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 3.5 20 9l-2 2-1-1-6.5 6.5a2.1 2.1 0 0 1-3-3L14 7l-1-1 1.5-2.5ZM4 20l4-4M8 8l-4 4 3 3" />
          </svg>
        </div>
        <div className="panel-title">Nemeses</div>
        <div className="panel-sub">rivals you meet most</div>
      </div>
      <div className="lrows stagger">
        {nemeses.map((n, i) => {
          const wr = Number(n.win_rate) || 0; // player's WR vs this rival
          const color = wr >= 50 ? "var(--win)" : "var(--loss)";
          return (
            <div
              className={`lrow ${onPick ? "lrow-click" : ""}`}
              key={n.nickname}
              onClick={onPick ? () => onPick(n.nickname) : undefined}
            >
              <span className="lrow-rank">#{i + 1}</span>
              {n.avatar ? (
                <img className="lrow-ava img" src={n.avatar} alt="" loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
              ) : (
                <div className="lrow-ava">{initials(n.nickname)}</div>
              )}
              <div className="lrow-main">
                <div className="lrow-name">{n.nickname}</div>
                <div className="lrow-track">
                  <div className="lrow-fill" style={{ width: `${wr}%`, background: color }} />
                </div>
              </div>
              <div className="lrow-side">
                <div className="lrow-big" style={{ color }}>{n.win_rate}%</div>
                <div className="lrow-dim">{n.games} faced</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
