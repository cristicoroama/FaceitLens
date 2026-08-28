// Threshold config per metric. higherBetter=false means lower values are better.
const METRICS = {
  rating: { label: "Rating 2.0", approx: true, min: 0.6, max: 1.4, higherBetter: true,
            tiers: [[1.2, "great"], [1.05, "good"], [0.9, "okay"], [0, "poor"]] },
  kd:     { label: "K/D", min: 0.6, max: 1.6, higherBetter: true,
            tiers: [[1.3, "great"], [1.1, "good"], [0.95, "okay"], [0, "poor"]] },
  kpr:    { label: "KPR", min: 0.4, max: 1.0, higherBetter: true,
            tiers: [[0.8, "great"], [0.7, "good"], [0.6, "okay"], [0, "poor"]] },
  dpr:    { label: "DPR", min: 0.55, max: 0.85, higherBetter: false,
            tiers: [[0.62, "great"], [0.68, "good"], [0.74, "okay"], [Infinity, "poor"]] },
  /* Not approximate. FACEIT publishes ADR per match and this is the mean of
     those values — the same arithmetic anyone would do by hand. The star used
     to sit here anyway, which made a measured figure look guessed and put it in
     the same class as KAST and Impact, which genuinely are inferred. */
  adr:    { label: "ADR", min: 50, max: 100, higherBetter: true,
            tiers: [[90, "great"], [80, "good"], [68, "okay"], [0, "poor"]] },
  kast:   { label: "KAST %", approx: true, min: 55, max: 85, higherBetter: true,
            tiers: [[78, "great"], [72, "good"], [66, "okay"], [0, "poor"]] },
  impact: { label: "Impact", approx: true, min: 0.6, max: 1.5, higherBetter: true,
            tiers: [[1.2, "great"], [1.05, "good"], [0.9, "okay"], [0, "poor"]] },
  firepower: { label: "Firepower", approx: true, min: 40, max: 100, higherBetter: true,
            tiers: [[85, "great"], [70, "good"], [55, "okay"], [0, "poor"]] },
  hs:     { label: "HS %", min: 20, max: 70, higherBetter: true,
            tiers: [[55, "great"], [45, "good"], [35, "okay"], [0, "poor"]] },
};

const TIER_META = {
  great: { color: "#22c55e", text: "GREAT" },
  good:  { color: "#84cc16", text: "GOOD" },
  okay:  { color: "#eab308", text: "OKAY" },
  poor:  { color: "#ef4444", text: "POOR" },
};

function tierFor(cfg, value) {
  if (cfg.higherBetter) {
    for (const [limit, tier] of cfg.tiers) if (value >= limit) return tier;
  } else {
    for (const [limit, tier] of cfg.tiers) if (value <= limit) return tier;
  }
  return "poor";
}

function pctFor(cfg, value) {
  const raw = (value - cfg.min) / (cfg.max - cfg.min);
  const dir = cfg.higherBetter ? raw : 1 - raw;
  return Math.max(4, Math.min(96, dir * 100));
}

function Gauge({ metricKey, value, delay }) {
  const cfg = METRICS[metricKey];
  const tier = tierFor(cfg, value);
  const meta = TIER_META[tier];
  const pct = pctFor(cfg, value);
  const display =
    metricKey === "kast" || metricKey === "hs" ? `${Math.round(value)}` : value;

  return (
    <div className="g2" style={{ animationDelay: `${delay}s` }}>
      <div className="g2-top">
        <span className="g2-label">
          {cfg.label}
          {cfg.approx && <span className="gauge-approx">*</span>}
        </span>
        <span
          className="g2-chip"
          style={{
            color: meta.color,
            borderColor: meta.color,
            background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
          }}
        >
          {meta.text}
        </span>
      </div>
      <div className="g2-value" style={{ color: meta.color }}>{display}</div>
      <div className="g2-track">
        <div className="g2-marker" style={{ left: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function HltvStats({ hltv }) {
  if (!hltv) {
    return <div className="state">Not enough match data for HLTV stats.</div>;
  }
  const order = ["rating", "firepower", "dpr", "kast", "kd", "adr", "kpr", "impact", "hs"]
    .filter((k) => hltv[k] != null);
  return (
    <>
      <div className="panel-head" style={{ marginBottom: 12 }}>
        <div className="panel-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" />
          </svg>
        </div>
        <div className="panel-title">HLTV-style Metrics</div>
        <div className="panel-sub">last {hltv.matches} matches</div>
      </div>
      <div className="g2-grid">
        {order.map((k, i) => (
          <Gauge key={k} metricKey={k} value={hltv[k]} delay={i * 0.05} />
        ))}
      </div>
      <div className="hltv-note">
        Metrics marked <b>*</b> (Rating 2.0, Firepower, KAST, ADR, Impact) are
        approximations — true HLTV Rating needs per-round demo data the FACEIT API
        doesn't expose.
      </div>
    </>
  );
}
