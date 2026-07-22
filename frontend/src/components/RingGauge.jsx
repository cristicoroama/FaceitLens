/** Circular SVG progress gauge with a glowing gradient stroke.
    Used by Trust, Leetify skill ratings and the Demos hero. */
export default function RingGauge({
  value,
  max = 100,
  size = 120,
  stroke = 10,
  color = "var(--accent)",
  display,
  sublabel,
  valueSize,
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, (Number(value) || 0) / max));

  return (
    <div className="ringg" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          className="ringg-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
        />
        <circle
          className="ringg-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ filter: `drop-shadow(0 0 7px ${color})` }}
        />
      </svg>
      <div className="ringg-in">
        <div className="ringg-val" style={{ color, fontSize: valueSize }}>
          {display ?? Math.round(Number(value) || 0)}
        </div>
        {sublabel && <div className="ringg-sub">{sublabel}</div>}
      </div>
    </div>
  );
}
