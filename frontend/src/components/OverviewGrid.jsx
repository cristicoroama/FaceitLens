import CountUp from "./CountUp.jsx";

function Card({ label, approx, value, color, trend, subs }) {
  return (
    <div className="ov-card">
      <div className="ov-card-label">
        {label}
        {approx && <span className="ov-approx">*</span>}
      </div>
      <div className="ov-card-value" style={color ? { color } : undefined}>
        {value}
        {trend && trend !== "flat" && (
          <span className={`trend ${trend === "up" ? "up" : "down"}`}>
            {trend === "up" ? "▲" : "▼"}
          </span>
        )}
      </div>
      {subs && (
        <div className="ov-card-subs">
          {subs.map((s) => (
            <div className="ov-sub" key={s.label}>
              <span>{s.label}</span>
              <span className="ov-sub-val">{s.value ?? "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OverviewGrid({ data, maps, mapFilter, onMapFilter }) {
  const s = data.stats || {};
  const ra = data.recent_avg || {};
  const h = data.hltv || {};
  const ex = data.elo_extremes || {};
  const mk = data.multikills;
  const sess = data.last_session;

  function ratingColor(r) {
    if (r == null) return undefined;
    if (r >= 1.15) return "var(--win)";
    if (r < 0.95) return "var(--loss)";
    return "var(--accent)";
  }

  return (
    <>
      {sess && sess.tilt && (
        <div className="tilt-warn">🚨 Tilt warning — {sess.losses} losses this session, take a break</div>
      )}

      <div className="ov-head">
        <div className="section-title" style={{ margin: 0 }}>
          Overview {mapFilter ? `· ${mapFilter.replace("de_", "")}` : ""}
        </div>
        {maps && maps.length > 0 && (
          <select className="map-filter" value={mapFilter || ""} onChange={(e) => onMapFilter(e.target.value || null)}>
            <option value="">All maps</option>
            {maps.map((m) => <option key={m} value={m}>{m.replace("de_", "")}</option>)}
          </select>
        )}
      </div>

      <div className="ov-grid">
        <Card
          label="Rating 2.0" approx value={h.rating ?? "—"} color={ratingColor(h.rating)}
          subs={[
            { label: "KPR", value: h.kpr },
            { label: "DPR", value: h.dpr },
            { label: "KAST*", value: h.kast != null ? `${h.kast}%` : null },
          ]}
        />
        <Card
          label="K/D" value={ra.kd ?? s.avg_kd ?? "—"} trend={data.kd_trend}
          subs={[
            { label: "Kills", value: ra.kills },
            { label: "Deaths", value: ra.deaths },
            { label: "Assists", value: ra.assists },
          ]}
        />
        <Card
          label="Win Rate" value={s.win_rate != null ? `${s.win_rate}%` : "—"}
          subs={[
            { label: "Matches", value: s.matches },
            { label: "Best streak", value: s.longest_win_streak },
            { label: "Current", value: s.current_win_streak },
          ]}
        />
        <Card
          label="ADR" approx value={ra.adr ?? "—"}
          subs={[
            { label: "K/R", value: ra.kr },
            { label: "HS%", value: ra.hs != null ? `${ra.hs}%` : null },
            { label: "Impact*", value: h.impact },
          ]}
        />
        <Card
          label="ELO" value={<CountUp value={data.elo} />} color="var(--accent)"
          subs={[
            { label: "Highest", value: ex.high },
            { label: "Lowest", value: ex.low },
            { label: "Average", value: ex.avg },
          ]}
        />
        {sess && (
          <Card
            label="Last Session" value={`${sess.wins}-${sess.losses}`}
            color={sess.elo_change >= 0 ? "var(--win)" : "var(--loss)"}
            subs={[
              { label: "ELO", value: `${sess.elo_change >= 0 ? "+" : ""}${sess.elo_change}` },
              { label: "Streak", value: data.streak ? `${data.streak.count}${data.streak.type}` : "—" },
              { label: "Last 10", value: data.form },
            ]}
          />
        )}
        {mk && (
          <Card
            label="Multi-Kills" value={mk.triple_total}
            subs={[
              { label: "Triple", value: mk.triple_total },
              { label: "Quad", value: mk.quadro_total },
              { label: "Ace (5K)", value: mk.penta_total },
            ]}
          />
        )}
      </div>
    </>
  );
}
