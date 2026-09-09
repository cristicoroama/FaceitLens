import { useState, useEffect } from "react";
import { API_BASE } from "../api.js";
import { MapThumb } from "../map-art.jsx";
import { CupStarIcon } from "@solar-icons/react/linear/cup-star";
import { TargetIcon } from "@solar-icons/react/linear/target";
import { FireIcon } from "@solar-icons/react/linear/fire";

/* Same card shell as the CS2 grid, on purpose. These two views sit behind one
   toggle, so a different card style would read as a different site rather than
   the same profile in another game. */
function Card({ label, period, value, color, subs, ic }) {
  return (
    <div className="ov-card">
      {ic && <div className="ov-ic">{ic}</div>}
      <div className="ov-card-label">
        {label}
        {period && <span className="ov-window">{period}</span>}
      </div>
      <div className="ov-card-value" style={color ? { color } : undefined}>
        {value}
      </div>
      {subs && (
        <div className="ov-card-subs">
          {subs.filter(Boolean).map((s) => (
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

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function int(v) {
  const n = num(v);
  return n == null ? null : Math.round(n);
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

  const by = {};
  for (const c of data.cards || []) by[c.key] = c.value;

  const wr = num(by["Win Rate %"]);
  const kd = num(by["Average K/D Ratio"]);
  const hs = num(by["Average Headshots %"]);
  const played = int(by["Matches"]);
  const wins = int(by["Wins"]);
  const losses = played != null && wins != null ? played - wins : null;
  const longest = int(by["Longest Win Streak"]);
  const current = int(by["Current Win Streak"]);

  const wins10 = (data.form || []).filter(Boolean).length;
  const losses10 = (data.form || []).length - wins10;

  // Break-even is structural here: 50% is as many wins as losses, 1.00 is as
  // many kills as deaths. No population data is being invented.
  const wrColor = wr == null ? undefined : wr >= 50 ? "var(--win)" : "var(--loss)";
  const kdColor = kd == null ? undefined : kd >= 1 ? "var(--win)" : "var(--loss)";

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
        <div className="form-strip">
          <span className="form-strip-label">Last results</span>
          <div className="form-strip-chips">
            {data.form.map((won, i) => (
              <span
                key={i}
                className={`res res-${won ? "w" : "l"}`}
                aria-label={won ? "Win" : "Loss"}
              >
                {won ? "W" : "L"}
              </span>
            ))}
          </div>
          <span className="form-strip-tally">
            <b className="fs-w">{wins10}W</b>
            <span className="fs-sep">–</span>
            <b className="fs-l">{losses10}L</b>
          </span>
          <span className="form-strip-hint">newest first</span>
        </div>
      )}

      <div className="ov-grid">
        <Card
          label="Win Rate"
          period="all time"
          ic={<CupStarIcon />}
          value={wr != null ? `${Math.round(wr)}%` : "—"}
          color={wrColor}
          subs={[
            { label: "Matches", value: played?.toLocaleString() },
            { label: "Wins", value: wins?.toLocaleString() },
            { label: "Losses", value: losses?.toLocaleString() },
          ]}
        />
        <Card
          label="Avg K/D"
          period="all time"
          ic={<TargetIcon />}
          value={kd != null ? kd.toFixed(2) : "—"}
          color={kdColor}
          subs={[
            { label: "Avg Headshots", value: hs != null ? `${Math.round(hs)}%` : null },
          ]}
        />
        <Card
          label="Win Streak"
          period="longest"
          ic={<FireIcon />}
          value={longest ?? "—"}
          subs={[{ label: "Current", value: current ?? "—" }]}
        />
      </div>

      {data.maps?.length > 0 && (
        <div className="csgo-maps">
          <div className="panel-head">
            <div className="panel-title">Maps</div>
            <div className="panel-sub">{data.maps.length} played</div>
          </div>
          <div className="csgo-map-list">
            {data.maps.map((m) => {
              const rate = num(m.win_rate);
              // 50% is a coin flip, so it belongs on the winning side of the
              // line — a map you break even on is not a map you lose on.
              const up = rate != null && rate >= 50;
              return (
                <div className="csgo-map" key={m.map}>
                  <span className="csgo-map-name">
                    <MapThumb map={m.map} className="csgo-map-thumb" />
                    {m.map}
                  </span>
                  <span className="csgo-map-n">{m.matches}</span>
                  <div className="csgo-map-bar">
                    {rate != null && (
                      <div
                        className={`csgo-map-fill ${up ? "up" : "down"}`}
                        style={{ width: `${Math.max(0, Math.min(100, rate))}%` }}
                      />
                    )}
                  </div>
                  <span className={`csgo-map-wr ${rate == null ? "" : up ? "up" : "down"}`}>
                    {rate != null ? `${Math.round(rate)}%` : "—"}
                  </span>
                  <span className="csgo-map-kd">
                    {m.avg_kd != null ? Number(m.avg_kd).toFixed(2) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
