import RingGauge from "./RingGauge.jsx";

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

      <div className="trust-gauge">
        <RingGauge
          value={trust.score}
          max={100}
          size={150}
          stroke={12}
          color={color}
          display={
            <>
              {trust.score}
              <span className="trust-pct" style={{ fontSize: 18 }}>%</span>
            </>
          }
          sublabel="trust"
          valueSize={38}
        />
      </div>
      <div className="trust2-tier" style={{ color, borderColor: color }}>
        {trust.tier}
      </div>

      <div className="trust-sub">Breakdown</div>
      {trust.breakdown.map((b) => {
        const pct = b.max > 0 ? Math.round((b.score / b.max) * 100) : 0;
        return (
          <div className="tb2-row" key={b.label}>
            <div className="tb2-top">
              <span className="tb2-label">{b.label}</span>
              {b.detail && <span className="tb2-detail">{b.detail}</span>}
              <span className="tb2-val">
                {b.score}
                <span className="tb2-max">/{b.max}</span>
              </span>
            </div>
            <div className="tb2-track">
              <div
                className="tb2-fill"
                style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }}
              />
            </div>
          </div>
        );
      })}
      {trust.bonus > 0 && (
        <div className="tb2-row">
          <div className="tb2-top">
            <span className="tb2-label">FACEIT verified bonus</span>
            <span className="tb2-val" style={{ color: "var(--accent)" }}>+{trust.bonus}</span>
          </div>
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
