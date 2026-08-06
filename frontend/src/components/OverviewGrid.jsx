import CountUp from "./CountUp.jsx";
import FormStrip from "./FormStrip.jsx";
import { Icon } from "../icons.jsx";

/* mini stroke icons for the stat cards */
const IC = {
  rating: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>,
  kd: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="8" /><path d="M12 4v16M4 12h16" /></svg>,
  wr: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4Z" /></svg>,
  adr: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>,
  elo: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m12 2 2.6 6.6L21 9l-5 4.4L17.5 21 12 17.3 6.5 21 8 13.4 3 9l6.4-.4L12 2Z" /></svg>,
  session: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>,
  mk: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 19 12 5l7 14H5Z" /><path d="M12 12v3" /></svg>,
};

function Card({ label, approx, value, color, trend, subs, ic }) {
  return (
    <div className="ov-card">
      {ic && <div className="ov-ic">{ic}</div>}
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
        <div className="tilt-warn">{Icon.exclamationTriangle} Tilt warning — {sess.losses} losses this session, take a break</div>
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

      {/* Above the cards: the last ten results are the first thing anyone
          scouting a player looks for, and the card grid only ever showed them
          summed into a "6-4" buried in the session card's third sub-row. */}
      <FormStrip matches={data.recent_matches} />

      <div className="ov-grid">
        <Card
          ic={IC.rating}
          label="Rating 2.0" approx value={h.rating ?? "—"} color={ratingColor(h.rating)}
          subs={[
            { label: "KPR", value: h.kpr },
            { label: "DPR", value: h.dpr },
            { label: "KAST*", value: h.kast != null ? `${h.kast}%` : null },
          ]}
        />
        <Card
          ic={IC.kd}
          label="K/D" value={ra.kd ?? s.avg_kd ?? "—"} trend={data.kd_trend}
          subs={[
            { label: "Kills", value: ra.kills },
            { label: "Deaths", value: ra.deaths },
            { label: "Assists", value: ra.assists },
          ]}
        />
        <Card
          ic={IC.wr}
          label="Win Rate" value={s.win_rate != null ? `${s.win_rate}%` : "—"}
          subs={[
            { label: "Matches", value: s.matches },
            { label: "Best streak", value: s.longest_win_streak },
            { label: "Current", value: s.current_win_streak },
          ]}
        />
        <Card
          ic={IC.adr}
          label="ADR" approx value={ra.adr ?? "—"}
          subs={[
            { label: "K/R", value: ra.kr },
            { label: "HS%", value: ra.hs != null ? `${ra.hs}%` : null },
            { label: "Impact*", value: h.impact },
          ]}
        />
        <Card
          ic={IC.elo}
          label="ELO" value={<CountUp value={data.elo} />} color="var(--accent)"
          subs={[
            { label: "Highest", value: ex.high },
            { label: "Lowest", value: ex.low },
            { label: "Average", value: ex.avg },
          ]}
        />
        {sess && (
          <Card
            ic={IC.session}
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
            ic={IC.mk}
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
