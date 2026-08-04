import { useState, useEffect } from "react";
import { Icon } from "../icons.jsx";
import { getJson } from "../api.js";

function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

export default function Hubs({ onPick }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // True while the list is FACEIT's busiest hubs rather than search results.
  const [popular, setPopular] = useState(false);
  // A hub can run several ladders: one all-time, plus one per season.
  const [boards, setBoards] = useState([]);
  const [season, setSeason] = useState(null);   // null = all-time
  const [rank, setRank] = useState(null);
  const [rankLoading, setRankLoading] = useState(false);

  async function loadRanking(hubId, seasonKey) {
    setRankLoading(true);
    try {
      const qs = seasonKey ? `?season=${encodeURIComponent(seasonKey)}` : "";
      const json = await getJson(`/api/hub/${encodeURIComponent(hubId)}/ranking/${qs}`);
      setRank(json);
    } catch { setRank(null); }
    finally { setRankLoading(false); }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const json = await getJson(`/api/hubs/`);
        if (!cancelled) {
          setResults(json.items || []);
          setPopular(true);
        }
      } catch { /* the search box still works */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  async function search() {
    const query = q.trim();
    if (!query) return;
    setLoading(true); setError(""); setHub(null); setResults([]); setPopular(false);
    try {
      const json = await getJson(`/api/hubs/?q=${encodeURIComponent(query)}`);
      setResults(json.items || []);
      if ((json.items || []).length === 0) setError("No hubs found.");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function openHub(h) {
    setLoading(true); setError(""); setResults([]);
    try {
      const json = await getJson(`/api/hub/${encodeURIComponent(h.hub_id)}/`);
      setHub(json);

      // Ladders are a separate call and plenty of hubs don't run one, so a
      // failure here must leave the hub profile standing.
      setBoards([]); setRank(null); setSeason(null);
      try {
        const lj = await getJson(`/api/hub/${encodeURIComponent(h.hub_id)}/leaderboards/`);
        if ((lj.items || []).length) {
          setBoards(lj.items);
          loadRanking(h.hub_id, null);
        }
      } catch { /* no ladder for this hub */ }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-title">
          <div className="panel-ic" style={{ width: 38, height: 38 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 18, height: 18 }}>
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
            </svg>
          </div>
          FACEIT <em>Hubs</em>
        </div>
        <div className="page-hero-sub">
          Search any FACEIT hub and browse its members. Click one to open their profile.
        </div>
      </div>

      <div className="search">
        <input
          type="text"
          placeholder="Hub name — e.g. ESEA, Rio, Deutschland…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button onClick={search} disabled={loading}>{loading ? "…" : "Search"}</button>
      </div>

      {error && <div className="state error">{error}</div>}
      {loading && <div className="state">Loading…</div>}

      {results.length > 0 && popular && (
        <div className="section-title">
          Busiest hubs <span className="section-count">or search above</span>
        </div>
      )}
      {results.length > 0 && (
        <div className="lrows stagger">
          {results.map((c) => (
            <div className="lrow lrow-click" key={c.hub_id} onClick={() => openHub(c)}>
              {/* Hub *search* carries no image; the backend backfills it from
                  the detail endpoint, so this is populated most of the time.
                  Initials remain the fallback. */}
              {c.avatar ? (
                <img className="lrow-ava img" src={c.avatar} alt="" loading="lazy"
                  onError={(e) => { e.currentTarget.replaceWith(
                    Object.assign(document.createElement("div"),
                      { className: "lrow-ava", textContent: initials(c.name) })); }} />
              ) : (
                <div className="lrow-ava">{initials(c.name)}</div>
              )}
              <div className="lrow-main">
                <div className="lrow-name">{c.name}</div>
                <div className="lrow-sub">
                  {c.organizer && <span>{c.organizer}</span>}
                  {c.region && <span>{c.region}</span>}
                  {c.members != null && <span>{c.members.toLocaleString()} members</span>}
                </div>
              </div>
              <span className="m2-chev">›</span>
            </div>
          ))}
        </div>
      )}

      {hub && (
        <>
          <div className={`hub-hero ${hub.cover ? "has-cover" : ""}`}>
            {hub.cover && (
              <img className="hub-hero-cover" src={hub.cover} alt="" aria-hidden="true" loading="lazy"
                onError={(e) => { e.currentTarget.remove(); }} />
            )}
            {hub.avatar ? (
              <img className="hub-hero-ava" src={hub.avatar} alt="" />
            ) : (
              <div className="hub-hero-ava ph">{initials(hub.name)}</div>
            )}
            <div className="hub-hero-info">
              <div className="hub-hero-name">{hub.name}</div>
              <div className="hub-hero-meta">
                {hub.organizer && <span>{Icon.award} {hub.organizer}</span>}
                {hub.region && <span>{hub.region}</span>}
                {hub.players != null && <span>{hub.players.toLocaleString()} players</span>}
                {hub.min_level != null && hub.max_level != null && (
                  <span>Level {hub.min_level}–{hub.max_level}</span>
                )}
              </div>
              {hub.description && <div className="hub-hero-desc">{hub.description}</div>}
            </div>
          </div>

          {boards.length > 0 && (
            <>
              <div className="section-title">
                Ranking
                {rank?.items?.length ? (
                  <span className="section-count">top {rank.items.length}</span>
                ) : null}
              </div>

              {/* Only worth a switcher when the hub actually runs seasons. */}
              {boards.some((b) => b.season) && (
                <div className="hub-seasons">
                  <button
                    className={`hub-season ${season === null ? "on" : ""}`}
                    onClick={() => { setSeason(null); loadRanking(hub.hub_id, null); }}
                  >
                    All-time
                  </button>
                  {boards.filter((b) => b.season).map((b) => (
                    <button
                      key={b.leaderboard_id}
                      className={`hub-season ${season === b.season ? "on" : ""}`}
                      onClick={() => { setSeason(b.season); loadRanking(hub.hub_id, b.season); }}
                    >
                      {b.name || `Season ${b.season}`}
                    </button>
                  ))}
                </div>
              )}

              {rankLoading && <div className="state">Loading ranking…</div>}
              {!rankLoading && rank?.items?.length === 0 && (
                <div className="state">Nobody has placed on this ladder yet.</div>
              )}
              {!rankLoading && rank?.items?.length > 0 && (
                <div className="lrows">
                  {rank.items.map((r) => (
                    <div
                      className="lrow lrow-click"
                      key={`${r.position}-${r.nickname}`}
                      onClick={() => r.nickname && onPick(r.nickname)}
                    >
                      <span className="hub-pos">#{r.position}</span>
                      {r.avatar ? (
                        <img className="lrow-ava img" src={r.avatar} alt="" loading="lazy" />
                      ) : (
                        <div className="lrow-ava">{initials(r.nickname)}</div>
                      )}
                      <div className="lrow-main">
                        <div className="lrow-name">{r.nickname}</div>
                        <div className="lrow-sub">
                          <span>{r.played} played</span>
                          <span>{r.won}W {r.lost}L</span>
                          {r.win_rate != null && <span>{r.win_rate}% win rate</span>}
                        </div>
                      </div>
                      <span className="hub-points">{r.points}<small>pts</small></span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="section-title">Members <span className="section-count">{hub.members.length}</span></div>
          {hub.members.length === 0 ? (
            <div className="state">This hub doesn't publish its member list.</div>
          ) : (
            <div className="hub-members">
              {hub.members.map((m) => (
                <button className="hub-member" key={m.player_id || m.nickname} onClick={() => onPick(m.nickname)}>
                  {m.avatar ? (
                    <img src={m.avatar} alt="" loading="lazy"
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
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
