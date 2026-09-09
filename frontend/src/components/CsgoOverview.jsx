import { useState, useEffect } from "react";
import { API_BASE } from "../api.js";

function fmt(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const shown = Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2);
  return unit ? `${shown}${unit}` : shown;
}

export default function CsgoOverview({ nickname, matches }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!nickname) return;
    let alive = true;
    setLoading(true);
    fetch(`${API_BASE}/api/player/${encodeURIComponent(nickname)}/csgo/`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => alive && setData(j))
      .catch(() => alive && setData({ available: false }))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [nickname]);

  if (loading) return <div className="state">Loading CS:GO record…</div>;
  if (!data?.available) {
    return <div className="state">No CS:GO stats available for this account.</div>;
  }

  return (
    <div className="csgo">
      {/* CS:GO closed before FACEIT's advanced stats existed, so this is a
          shorter record than the CS2 one on purpose — not a gap we failed to
          fill. Saying so beats leaving people to wonder where ADR went. */}
      <div className="csgo-note">
        <img src="/games/csgo.png" alt="" className="csgo-note-ic" />
        <div>
          <strong>CS:GO career</strong>
          <span>
            {matches != null ? `${matches.toLocaleString()} matches · ` : ""}
            finished when CS2 launched. FACEIT never recorded ADR, entry or
            utility stats for CS:GO, so this is everything it kept.
          </span>
        </div>
      </div>

      {data.form?.length > 0 && (
        <div className="csgo-form">
          <span className="csgo-form-label">Last results</span>
          <div className="csgo-form-strip">
            {data.form.map((won, i) => (
              <span key={i} className={`csgo-pip ${won ? "w" : "l"}`}>
                {won ? "W" : "L"}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="csgo-cards">
        {data.cards.map((c) => (
          <div className="csgo-card" key={c.key}>
            <span className="csgo-card-label">{c.label}</span>
            <span className="csgo-card-val">{fmt(c.value, c.unit)}</span>
          </div>
        ))}
        {Object.entries(data.extra || {}).map(([k, v]) => (
          <div className="csgo-card" key={k}>
            <span className="csgo-card-label">{k}</span>
            <span className="csgo-card-val">{fmt(v, "")}</span>
          </div>
        ))}
      </div>

      {data.maps?.length > 0 && (
        <div className="csgo-maps">
          <div className="panel-head">
            <div className="panel-title">Maps</div>
            <div className="panel-sub">{data.maps.length} played</div>
          </div>
          <div className="csgo-map-list">
            {data.maps.map((m) => (
              <div className="csgo-map" key={m.map}>
                <span className="csgo-map-name">{m.map}</span>
                <span className="csgo-map-n">{m.matches}</span>
                {m.win_rate != null && (
                  <div className="csgo-map-bar">
                    <div
                      className="csgo-map-fill"
                      style={{ width: `${Math.max(0, Math.min(100, Number(m.win_rate)))}%` }}
                    />
                  </div>
                )}
                <span className="csgo-map-wr">
                  {m.win_rate != null ? `${Math.round(Number(m.win_rate))}%` : "—"}
                </span>
                <span className="csgo-map-kd">
                  {m.avg_kd != null ? Number(m.avg_kd).toFixed(2) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
