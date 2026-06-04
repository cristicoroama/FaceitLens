export default function SessionCard({ streak, session }) {
  if (!streak && !session) return null;
  return (
    <div className="session-card">
      {session && session.tilt && (
        <div className="tilt-warn">🚨 Tilt warning — {session.losses} losses, take a break</div>
      )}
      <div className="session-row">
        {streak && (
          <div className={`session-item ${streak.type === "W" ? "good" : "bad"}`}>
            <div className="session-num">
              {streak.count}{streak.type}
            </div>
            <div className="session-label">Current streak</div>
          </div>
        )}
        {session && (
          <>
            <div className="session-item">
              <div className="session-num">
                {session.wins}-{session.losses}
              </div>
              <div className="session-label">Last session</div>
            </div>
            <div className={`session-item ${session.elo_change >= 0 ? "good" : "bad"}`}>
              <div className="session-num">
                {session.elo_change >= 0 ? "+" : ""}{session.elo_change}
              </div>
              <div className="session-label">ELO this session</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
