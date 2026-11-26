import { useState } from "react";
import SkillBadge from "./SkillBadge.jsx";
import { useCommunityData } from "../lib/community-api.js";
import "../styles/community.css";

export const REGIONS = ["", "EU", "NA", "SA", "OCE", "SEA"];

export default function Climbers({ onPick, limit = 10, initialDays = 7 }) {
  const [days, setDays] = useState(initialDays);
  const [region, setRegion] = useState("");
  const { data, error, loading } = useCommunityData(
    `/api/community/climbers/?days=${days}&limit=${limit}${region ? `&region=${region}` : ""}`,
  );
  const items = data?.items || [];
  const top = items.length ? items[0].gain : 1;

  return (
    <div className="panel cm-panel">
      <div className="panel-head">
        <div className="panel-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" />
          </svg>
        </div>
        <div className="panel-title">Top climbers</div>
        <div className="panel-sub">biggest ELO gains</div>
      </div>

      <div className="cm-controls">
        <div className="cm-seg" role="group" aria-label="Period">
          {[7, 30].map((d) => (
            <button key={d} type="button" className={days === d ? "on" : ""} aria-pressed={days === d}
              onClick={() => setDays(d)}>{d} days</button>
          ))}
        </div>
        <select className="cm-select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region">
          {REGIONS.map((r) => <option key={r || "all"} value={r}>{r || "All regions"}</option>)}
        </select>
      </div>

      {loading && <div className="cm-empty">Loading…</div>}
      {error && <div className="cm-empty">{error.message}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="cm-empty">No climbs recorded in this window yet.</div>
      )}

      {items.length > 0 && (
        <div className="lrows stagger">
          {items.map((c, i) => (
            <div
              key={c.player_id || c.nickname}
              className={`lrow ${onPick ? "lrow-click" : ""}`}
              onClick={onPick ? () => onPick(c.nickname) : undefined}
            >
              <span className="lrow-rank">#{i + 1}</span>
              <SkillBadge level={c.level} size={26} />
              <div className="lrow-main">
                <div className="lrow-name">
                  {c.nickname}
                  {c.level > c.start_level && <span className="cm-tag">lvl {c.start_level} → {c.level}</span>}
                </div>
                <div className="lrow-track">
                  <div className="lrow-fill" style={{ width: `${Math.max(4, (c.gain / top) * 100)}%`, background: "var(--win)" }} />
                </div>
              </div>
              <div className="lrow-side">
                <div className="lrow-big" style={{ color: "var(--win)" }}>+{c.gain}</div>
                <div className="lrow-dim">{c.start_elo} → {c.elo}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="cm-foot">Among players tracked by FaceitLens, from daily ELO snapshots.</div>
    </div>
  );
}
