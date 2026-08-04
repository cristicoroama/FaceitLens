import { useState } from "react";

import { Icon } from "../icons.jsx";
import { getJson } from "../api.js";

function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

/**
 * FACEIT team search.
 *
 * Teams are what people mean when they type "NAVI" or "FaZe" — those aren't
 * hubs, and searching for them under Hubs returned nothing, which read like a
 * broken feature rather than the wrong section.
 */
export default function Teams({ onPick }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    const query = q.trim();
    if (!query) return;
    setLoading(true); setError(""); setTeam(null); setResults([]);
    try {
      const json = await getJson(`/api/teams/?q=${encodeURIComponent(query)}`);
      setResults(json.items || []);
      if ((json.items || []).length === 0) setError("No teams found.");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function openTeam(t) {
    setLoading(true); setError(""); setResults([]);
    try {
      const json = await getJson(`/api/team/${encodeURIComponent(t.team_id)}/`);
      setTeam(json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const s = team?.stats;

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-title">
          <div className="panel-ic" style={{ width: 38, height: 38 }}>{Icon.people}</div>
          FACEIT <em>Teams</em>
        </div>
        <div className="page-hero-sub">
          Search any FACEIT team to see its roster and record. Click a player to open their stats.
        </div>
      </div>

      <div className="search">
        <input
          type="text"
          placeholder="Team name — e.g. NAVI, FaZe, Vitality…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button onClick={search} disabled={loading}>{loading ? "..." : "Search"}</button>
      </div>

      {error && <div className="state error">{error}</div>}
      {loading && <div className="state">Loading…</div>}

      {results.length > 0 && (
        <div className="lrows stagger">
          {results.map((t) => (
            <div className="lrow lrow-click" key={t.team_id} onClick={() => openTeam(t)}>
              {t.avatar ? (
                <img className="lrow-ava img" src={t.avatar} alt="" loading="lazy"
                  onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
              ) : (
                <div className="lrow-ava">{initials(t.name)}</div>
              )}
              <div className="lrow-main">
                <div className="lrow-name">
                  {t.name}
                  {t.verified && (
                    <span className="tm-verified" title="Verified team">{Icon.patchCheckFill}</span>
                  )}
                </div>
              </div>
              <span className="m2-chev">›</span>
            </div>
          ))}
        </div>
      )}

      {team && (
        <>
          <div className={`hub-hero ${team.cover ? "has-cover" : ""}`}>
            {team.cover && (
              <img className="hub-hero-cover" src={team.cover} alt="" aria-hidden="true" loading="lazy"
                onError={(e) => { e.currentTarget.remove(); }} />
            )}
            {team.avatar ? (
              <img className="hub-hero-ava" src={team.avatar} alt="" />
            ) : (
              <div className="hub-hero-ava ph">{initials(team.name)}</div>
            )}
            <div className="hub-hero-info">
              <div className="hub-hero-name">
                {team.name}
                {team.verified && (
                  <span className="tm-verified" title="Verified team">{Icon.patchCheckFill}</span>
                )}
              </div>
              <div className="hub-hero-meta">
                {team.nickname && team.nickname !== team.name && <span>{team.nickname}</span>}
                <span>{team.members.length} players</span>
                {team.faceit_url && (
                  <a href={team.faceit_url} target="_blank" rel="noopener noreferrer">
                    View on FACEIT
                  </a>
                )}
              </div>
              {team.description && <div className="hub-hero-desc">{team.description}</div>}
            </div>
          </div>

          {/* Plenty of teams exist on paper and have never played, so the whole
              block only appears when there's actually a record to show. */}
          {s && s.matches ? (
            <>
              <div className="section-title">Record</div>
              <div className="stats-grid">
                <div className="stat"><div className="stat-val">{s.matches}</div><div className="stat-lbl">Matches</div></div>
                <div className="stat"><div className="stat-val">{s.wins ?? "—"}</div><div className="stat-lbl">Wins</div></div>
                <div className={`stat`}>
                  <div className={`stat-val ${s.win_rate >= 50 ? "pos" : "neg"}`}>
                    {s.win_rate != null ? `${s.win_rate}%` : "—"}
                  </div>
                  <div className="stat-lbl">Win rate</div>
                </div>
                <div className="stat">
                  <div className="stat-val">{s.longest_streak ?? "—"}</div>
                  <div className="stat-lbl">Best streak</div>
                </div>
              </div>

              {s.maps?.length > 0 && (
                <>
                  <div className="section-title">Maps</div>
                  <div className="lrows">
                    {s.maps.map((m) => (
                      <div className="lrow" key={m.map}>
                        <div className="lrow-main">
                          <div className="lrow-name">{(m.map || "").replace(/^de_/, "")}</div>
                          <div className="lrow-sub"><span>{m.matches} matches</span></div>
                        </div>
                        <span className={m.win_rate >= 50 ? "pos" : "neg"}>{m.win_rate}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : null}

          <div className="section-title">
            Roster <span className="section-count">{team.members.length}</span>
          </div>
          {team.members.length === 0 ? (
            <div className="state">This team has no listed players.</div>
          ) : (
            <div className="hub-members">
              {team.members.map((m) => (
                <button className="hub-member" key={m.player_id || m.nickname}
                        onClick={() => onPick(m.nickname)}>
                  {m.avatar ? (
                    <img src={m.avatar} alt="" loading="lazy" />
                  ) : (
                    <span className="hub-member-ph">{initials(m.nickname)}</span>
                  )}
                  <span className="hub-member-name">{m.nickname}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
