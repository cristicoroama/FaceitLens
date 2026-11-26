import { useMemo, useState } from "react";
import { useCommunityData, synergyPath, fmtSigned } from "../lib/community-api.js";
import "../styles/community.css";

function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

export function SynergyDelta({ row }) {
  if (!row) return null;
  const wr = row.win_rate_delta;
  const rt = row.rating_delta;
  return (
    <span className="cm-syn" title={`Together over ${row.games} games: ${row.win_rate}% win rate${row.rating != null ? `, ${row.rating} rating (approx)` : ""}`}>
      {wr != null && <span className={wr >= 0 ? "up" : "down"}>{fmtSigned(wr, 0)}% WR</span>}
      {rt != null && <span className={rt >= 0 ? "up" : "down"}>{fmtSigned(rt, 2)} rtg</span>}
    </span>
  );
}

export function useSynergy(nickname) {
  const { data } = useCommunityData(synergyPath(nickname));
  return useMemo(() => {
    const byId = {};
    const byName = {};
    for (const t of data?.teammates || []) {
      if (t.player_id) byId[t.player_id] = t;
      if (t.nickname) byName[t.nickname] = t;
    }
    return { data, find: (m) => byId[m.player_id] || byName[m.nickname] || null };
  }, [data]);
}

export default function TeammatesFull({ mates, onPick, nickname }) {
  const [sort, setSort] = useState("games");
  const syn = useSynergy(nickname);
  const synRows = syn.data?.teammates || [];
  const canSynergy = synRows.length > 0;

  if ((!mates || mates.length === 0) && !canSynergy) {
    return <div className="state">No teammates found in recent matches.</div>;
  }

  const list = sort === "synergy" && canSynergy ? synRows : (mates || []);

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17.5" cy="9.5" r="2.5" /><path d="M15.5 15.5a5 5 0 0 1 6 4.5" />
          </svg>
        </div>
        <div className="panel-title">Teammates</div>
        <span className="panel-count">{list.length}</span>
        <div className="panel-sub">{sort === "synergy" ? `last ${syn.data?.matches || 0} matches` : "recent matches"}</div>
      </div>

      {canSynergy && (
        <div className="cm-controls">
          <div className="cm-seg" role="group" aria-label="Sort teammates">
            <button type="button" className={sort === "games" ? "on" : ""} aria-pressed={sort === "games"} onClick={() => setSort("games")}>Most games</button>
            <button type="button" className={sort === "synergy" ? "on" : ""} aria-pressed={sort === "synergy"} onClick={() => setSort("synergy")}>Best synergy</button>
          </div>
          <span className="cm-syn-base">
            your baseline {syn.data.overall?.win_rate ?? "—"}% WR
            {syn.data.overall?.rating != null ? ` · ${syn.data.overall.rating} rtg` : ""} · min {syn.data.min_games} games
          </span>
        </div>
      )}

      <div className="lrows stagger">
        {list.map((m, i) => {
          const wr = Number(m.win_rate) || 0;
          const color = wr >= 50 ? "var(--win)" : "var(--loss)";
          const s = sort === "synergy" ? m : syn.find(m);
          return (
            <div
              className={`lrow ${onPick ? "lrow-click" : ""}`}
              key={m.player_id || m.nickname}
              onClick={onPick ? () => onPick(m.nickname) : undefined}
            >
              <span className="lrow-rank">#{i + 1}</span>
              {m.avatar ? (
                <img className="lrow-ava img" src={m.avatar} alt="" loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
              ) : (
                <div className="lrow-ava">{initials(m.nickname)}</div>
              )}
              <div className="lrow-main">
                <div className="lrow-name">{m.nickname}<SynergyDelta row={s} /></div>
                <div className="lrow-track">
                  <div className="lrow-fill" style={{ width: `${wr}%`, background: color }} />
                </div>
              </div>
              <div className="lrow-side">
                <div className="lrow-big" style={{ color }}>{Math.round(wr)}%</div>
                <div className="lrow-dim">{m.games} games</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
