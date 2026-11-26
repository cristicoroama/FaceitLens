import { useState } from "react";
import { useCommunityData } from "../lib/community-api.js";
import { REGIONS } from "./Climbers.jsx";
import "../styles/community.css";

const LEVEL_COLORS = ["#eeeeee", "#1ce400", "#1ce400", "#ffc800", "#ffc800", "#ffc800", "#ffc800", "#ff6309", "#ff6309", "#fe1f00"];

export default function RankDistribution({ nickname: initialNick = "", elo }) {
  const [region, setRegion] = useState("");
  const [draft, setDraft] = useState(initialNick);
  const [nickname, setNickname] = useState(initialNick);
  const params = new URLSearchParams();
  if (region) params.set("region", region);
  if (nickname) params.set("nickname", nickname);
  if (elo != null && !nickname) params.set("elo", String(elo));
  const { data, error, loading } = useCommunityData(`/api/community/distribution/?${params}`);

  const levels = data?.levels || [];
  const peak = Math.max(1, ...levels.map((l) => l.count));
  const you = data?.you;
  const pct = you?.percentile;

  return (
    <div className="panel cm-panel">
      <div className="panel-head">
        <div className="panel-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" />
          </svg>
        </div>
        <div className="panel-title">Rank distribution</div>
        {data?.population ? <span className="panel-count">{data.population}</span> : null}
        <div className="panel-sub">among players tracked by FaceitLens</div>
      </div>

      <div className="cm-controls">
        <select className="cm-select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region">
          {REGIONS.map((r) => <option key={r || "all"} value={r}>{r || "All regions"}</option>)}
        </select>
        <form className="cm-inline-form" onSubmit={(e) => { e.preventDefault(); setNickname(draft.trim()); }}>
          <input className="cm-input" value={draft} maxLength={100} placeholder="Your nickname"
            onChange={(e) => setDraft(e.target.value)} aria-label="Nickname" />
          <button className="act-btn" type="submit">Where am I?</button>
        </form>
      </div>

      {loading && !data && <div className="cm-empty">Loading…</div>}
      {error && <div className="cm-empty">{error.message}</div>}
      {data && data.population === 0 && <div className="cm-empty">Not enough tracked players here yet.</div>}

      {data && data.population > 0 && (
        <>
          <div className="cm-hist" role="img"
            aria-label={levels.map((l) => `level ${l.level}: ${l.pct}%`).join(", ")}>
            {levels.map((l) => {
              const mine = you && you.level === l.level;
              return (
                <div key={l.level} className={`cm-hist-col${mine ? " mine" : ""}`}
                  title={`Level ${l.level} (${l.min_elo}${l.max_elo ? `–${l.max_elo}` : "+"} ELO): ${l.count} players, ${l.pct}%`}>
                  <span className="cm-hist-pct">{l.pct}%</span>
                  <div className="cm-hist-bar-wrap">
                    <div className="cm-hist-bar" style={{ height: `${(l.count / peak) * 100}%`, background: LEVEL_COLORS[l.level - 1] }} />
                  </div>
                  <span className="cm-hist-label">{l.level}</span>
                </div>
              );
            })}
          </div>
          <div className="cm-stats-row">
            <span>Median <b>{data.median ?? "—"}</b> ELO</span>
            <span>Mean <b>{data.mean ?? "—"}</b> ELO</span>
            <span>{data.population} players{data.region ? ` in ${data.region}` : ""}</span>
          </div>
          {nickname && !you && <div className="cm-note">We have no recent ELO reading for {nickname}. Look them up first and check back tomorrow.</div>}
          {you && pct && (
            <div className="cm-you">
              <b>{you.nickname || "You"}</b> at {you.elo} ELO is in the <b>top {pct.top_percent}%</b>
              {" "}(#{pct.position} of {pct.population}) of players tracked by FaceitLens{data.region ? ` in ${data.region}` : ""}.
            </div>
          )}
        </>
      )}
      <div className="cm-foot">Latest snapshot from the last {data?.window_days || 30} days. Not a global FACEIT ranking.</div>
    </div>
  );
}
