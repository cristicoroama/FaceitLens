const TIER_COLOR = {
  EXCELLENT: "#22c55e",
  GOOD: "#84cc16",
  FAIR: "#eab308",
  LOW: "#f59e0b",
  SUSPICIOUS: "#ef4444",
};

export default function TrustScore({ trust, steamLevel }) {
  if (!trust) return null;
  const color = TIER_COLOR[trust.tier] || "var(--accent)";

  return (
    <div className="trust-card">
      <div className="trust-head">
        Account Trust
        <span
          className="trust-help"
          title="Built from account signals (Steam age, CS2 hours, Steam level, bans, inventory, FACEIT activity). This is a legitimacy score, NOT cheat detection — that needs demo analysis."
        >
          ?
        </span>
      </div>

      <div className="trust-score" style={{ color }}>
        {trust.score}
        <span className="trust-pct">%</span>
      </div>
      <div className="trust-tier" style={{ color, borderColor: color }}>
        {trust.tier}
      </div>
      <div className="trust-bar">
        <div className="trust-bar-fill" style={{ width: `${trust.score}%`, background: color }} />
      </div>

      <div className="trust-sub">Breakdown</div>
      {trust.breakdown.map((b) => (
        <div className="trust-row" key={b.label}>
          <span className="trust-dot" style={{ background: color }} />
          <span className="trust-row-label">{b.label}</span>
          <span className="trust-row-val">
            {b.score}
            <span className="trust-row-max">/{b.max}</span>
          </span>
        </div>
      ))}
      {trust.bonus > 0 && (
        <div className="trust-row">
          <span className="trust-dot" style={{ background: "var(--accent)" }} />
          <span className="trust-row-label">FACEIT verified bonus</span>
          <span className="trust-row-val" style={{ color: "var(--accent)" }}>+{trust.bonus}</span>
        </div>
      )}

      <div className="trust-sub">Account flags</div>
      <div className="trust-flags">
        {trust.flags.map((f) => (
          <div className={`trust-flag ${f.ok ? "ok" : "bad"}`} key={f.label} title={f.detail}>
            <div className="trust-flag-ic">{f.ok ? "✓" : "!"}</div>
            <div className="trust-flag-lb">{f.label}</div>
            <div className="trust-flag-dt">{f.detail}</div>
          </div>
        ))}
      </div>

      {steamLevel != null && (
        <div className="trust-steamlevel">
          Steam level <b>{steamLevel}</b>
        </div>
      )}

      <div className="trust-note">
        Legitimacy score from account signals — not demo-based cheat detection.
      </div>
    </div>
  );
}
