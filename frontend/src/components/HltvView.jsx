import { useState, useEffect } from "react";
import { TeamModal, PlayerModal } from "./HltvDetail.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

/** Friendly copy for the graceful-degradation reasons the backend returns. */
const REASONS = {
  not_configured:
    "The HLTV section needs a parse.bot key. Set PARSE_API_KEY (and optionally PARSE_HLTV_BASE) in the backend environment.",
  bad_api_key: "The parse.bot API key was rejected — check PARSE_API_KEY.",
  scraper_not_found: "Scraper endpoint not found — check PARSE_HLTV_BASE.",
  ratelimited: "Rate limited by parse.bot. Try again shortly.",
  network: "Couldn't reach parse.bot. Check your connection.",
  badjson: "The scraper returned an unexpected response.",
  ssl: "TLS error reaching parse.bot (set STEAM_INSECURE=1 behind a proxy).",
};

const TABS = [
  ["rankings", "World Ranking"],
  ["results", "Results"],
  ["upcoming", "Upcoming"],
  ["team-stats", "Team Stats"],
  ["player-stats", "Player Stats"],
];

/** Logo/avatar that renders only when a URL exists and actually loads.
    The scraper returns a `logo` field once it's revised to extract the image;
    until then `src` is null and nothing shows — no broken-image icons. */
function Logo({ src, alt, className = "hltv-logo" }) {
  const [ok, setOk] = useState(true);
  if (!src || !ok) return null;
  return (
    <img
      className={className}
      src={src}
      alt={alt || ""}
      loading="lazy"
      onError={() => setOk(false)}
    />
  );
}

export default function HltvView({ onPick }) {
  const [tab, setTab] = useState("rankings");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [teamModal, setTeamModal] = useState(null); // { url, name }
  const [playerModal, setPlayerModal] = useState(null); // { url?, id?, name }
  const [openTeam, setOpenTeam] = useState(null); // team_url of the expanded ranking row
  const [rosters, setRosters] = useState({}); // team_url -> { loading, data, error }

  /** Rankings: expand a team inline and lazy-load its roster once. */
  function toggleTeam(t) {
    const url = t.team_url;
    if (!url) return;
    if (openTeam === url) {
      setOpenTeam(null);
      return;
    }
    setOpenTeam(url);
    if (!rosters[url]) {
      setRosters((r) => ({ ...r, [url]: { loading: true } }));
      fetch(`${API_BASE}/api/hltv/team-details/?url=${encodeURIComponent(url)}`)
        .then((res) => res.json())
        .then((j) => setRosters((r) => ({ ...r, [url]: { loading: false, data: j } })))
        .catch((e) => setRosters((r) => ({ ...r, [url]: { loading: false, error: e.message } })));
    }
  }

  async function load(section) {
    setLoading(true);
    setError("");
    setData(null);
    try {
      // Stats tabs get a deeper list so name-search has more to match against.
      const lim = section.endsWith("-stats") ? 100 : 50;
      const resp = await fetch(`${API_BASE}/api/hltv/${section}/?limit=${lim}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setQuery("");
    load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const attribution = data?.attribution;
  const items = data?.items || [];
  const filtered =
    query.trim() && (tab === "player-stats" || tab === "team-stats")
      ? items.filter((it) =>
          `${it.name || ""} ${it.team || ""}`
            .toLowerCase()
            .includes(query.trim().toLowerCase())
        )
      : items;

  const maxPts = Math.max(1, ...filtered.map((t) => Number(t.points) || 0));

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-title">
          <div className="panel-ic" style={{ width: 38, height: 38 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 18, height: 18 }}>
              <path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
            </svg>
          </div>
          HLTV <em>Pro Scene</em>
        </div>
        <div className="page-hero-sub">
          World rankings, live results, upcoming matches and the top team &amp; player
          stats — straight from the professional Counter-Strike circuit.
        </div>
      </div>

      <div className="ptabs">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            className={`ptab ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {(tab === "player-stats" || tab === "team-stats") && data?.available && (
        <div className="lb-controls">
          <input
            type="text"
            placeholder={tab === "player-stats" ? "Search player / team…" : "Search team…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {loading && <div className="state">Loading…</div>}
      {error && <div className="state error">{error}</div>}

      {!loading && data && !data.available && (
        <div className="state">{REASONS[data.reason] || "HLTV data unavailable."}</div>
      )}

      {!loading && data?.available && filtered.length === 0 && (
        <div className="state">
          {query.trim()
            ? `No match for "${query.trim()}" in the loaded top ${items.length}. This filters the current stats list, not all of HLTV.`
            : "No data."}
        </div>
      )}

      {!loading && data?.available && filtered.length > 0 && (
        <div className={tab === "rankings" ? "rank-grid" : "squad stagger"}>
          {tab === "rankings" &&
            filtered.map((t, i) => {
              const pos = Number(t.rank) || i + 1;
              const pct = Math.max(4, Math.round(((Number(t.points) || 0) / maxPts) * 100));
              const top = pos <= 3 ? `top${pos}` : "";
              const initials = (t.name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
              const isOpen = openTeam === t.team_url && t.team_url;
              const st = (t.team_url && rosters[t.team_url]) || null;
              const roster = st?.data?.available ? st.data.roster || [] : [];
              return (
                <div className="rank-item" key={`${t.name}-${i}`}>
                  <div
                    className={`rank-card ${top} ${t.team_url ? "clickable" : ""} ${isOpen ? "open" : ""}`}
                    style={{ animationDelay: `${Math.min(i, 14) * 0.03}s` }}
                    onClick={t.team_url ? () => toggleTeam(t) : undefined}
                  >
                    <div className="rank-pos">#{pos}</div>
                    <div className="rank-logo-wrap">
                      {t.logo ? (
                        <Logo src={t.logo} alt={t.name} className="rank-logo-img" />
                      ) : (
                        <span className="rank-logo-ph">{initials}</span>
                      )}
                    </div>
                    <div className="rank-main">
                      <div className="rank-name">{t.name}</div>
                      {t.players && t.players.length > 0 && !isOpen && (
                        <div className="rank-players">{t.players.join(" · ")}</div>
                      )}
                      <div className="rank-bar-track">
                        <div className="rank-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="rank-pts">
                      <span className="rank-pts-num">{t.points ?? "—"}</span>
                      <span className="rank-pts-label">points</span>
                    </div>
                    {t.team_url && <span className="rank-chev">▾</span>}
                  </div>

                  {isOpen && (
                    <div className="rank-roster">
                      {st?.loading && <div className="state" style={{ padding: "18px 0" }}>Loading roster…</div>}
                      {st?.error && <div className="state error">{st.error}</div>}
                      {st?.data && !st.data.available && (
                        <div className="state" style={{ padding: "14px 0" }}>
                          Roster unavailable for this team right now.
                        </div>
                      )}
                      {roster.length > 0 && (
                        <div className="rr-grid">
                          {roster.map((p, pi) => (
                            <button
                              className="rr-card"
                              key={pi}
                              onClick={() =>
                                setPlayerModal({ url: p.player_url, id: p.player_id, name: p.name })
                              }
                              title={`View ${p.name}`}
                            >
                              {p.photo ? (
                                <Logo src={p.photo} alt={p.name} className="rr-photo" />
                              ) : (
                                <span className="rr-photo ph">
                                  {(p.name || "?").slice(0, 2).toUpperCase()}
                                </span>
                              )}
                              <span className="rr-name">{p.name}</span>
                              {p.country && <span className="rr-country">{p.country}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                      {st?.data?.available && roster.length === 0 && (
                        <div className="state" style={{ padding: "14px 0" }}>No roster data.</div>
                      )}
                      <div className="rr-foot">
                        <a
                          href={t.team_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          HLTV team profile →
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

          {tab === "results" &&
            filtered.map((m, i) => (
              <a
                className="squad-row hltv-link"
                key={`${m.match_id || i}`}
                href={m.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="hltv-match">
                  <span className="hltv-team">
                    <Logo src={m.team1_logo} alt={m.team1} />
                    {m.team1 || "?"}
                  </span>
                  <span className="hltv-score">{m.score || "vs"}</span>
                  <span className="hltv-team right">
                    {m.team2 || "?"}
                    <Logo src={m.team2_logo} alt={m.team2} />
                  </span>
                </span>
                <span className="squad-wr">{m.event || ""}</span>
                {m.date && <span className="hltv-date">{m.date}</span>}
              </a>
            ))}

          {tab === "upcoming" &&
            filtered.map((m, i) => (
              <a
                className="squad-row hltv-link"
                key={i}
                href={m.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="hltv-match">
                  <span className="hltv-team">
                    <Logo src={m.team1_logo} alt={m.team1} />
                    {m.team1 || "TBD"}
                  </span>
                  <span className="hltv-score">vs</span>
                  <span className="hltv-team right">
                    {m.team2 || "TBD"}
                    <Logo src={m.team2_logo} alt={m.team2} />
                  </span>
                </span>
                <span className="squad-wr">{m.event || ""}</span>
                <span className="hltv-date">
                  {[m.date, m.time].filter(Boolean).join(" ") || m.status || ""}
                </span>
              </a>
            ))}

          {tab === "team-stats" &&
            filtered.map((t, i) => (
              <div
                className={`squad-row hltv-pstat ${t.team_url ? "clickable" : ""}`}
                key={`${t.name}-${i}`}
                onClick={t.team_url ? () => setTeamModal({ url: t.team_url, name: t.name }) : undefined}
              >
                <span className="squad-rank">#{i + 1}</span>
                <Logo src={t.logo} alt={t.name} />
                <span className="squad-name">{t.name}</span>
                <span className="pstat-col hide-sm">{t.maps ? `${t.maps} maps` : ""}</span>
                {t.kd_diff != null && (
                  <span className={`pstat-diff ${String(t.kd_diff).startsWith("-") ? "neg" : "pos"}`}>
                    {t.kd_diff}
                  </span>
                )}
                <span className="pstat-col">{t.kd ?? "—"}</span>
                <span className="pstat-rating" title="HLTV rating">{t.rating ?? "—"}</span>
              </div>
            ))}

          {tab === "player-stats" &&
            filtered.map((p, i) => (
              <div className="squad-row hltv-pstat" key={`${p.name}-${i}`}>
                <span className="squad-rank">#{i + 1}</span>
                <Logo src={p.logo} alt="" className="hltv-flag" />
                <span
                  className="squad-name link"
                  onClick={() => setPlayerModal({ id: p.player_id, url: p.player_url, name: p.name })}
                  title={`View ${p.name}`}
                >
                  {p.name}
                </span>
                <span className="hltv-teamtag">
                  <Logo src={p.team_logo} alt={p.team} className="hltv-logo sm" />
                  <span className="pstat-team-name hide-sm">{p.team || ""}</span>
                </span>
                {p.kd_diff != null && (
                  <span className={`pstat-diff ${String(p.kd_diff).startsWith("-") ? "neg" : "pos"}`}>
                    {p.kd_diff}
                  </span>
                )}
                <span className="pstat-col hide-sm">{p.kd ?? "—"}</span>
                <span className="pstat-rating" title="HLTV rating">{p.rating ?? "—"}</span>
              </div>
            ))}
        </div>
      )}

      {attribution && (
        <div className="side-note" style={{ marginTop: "1rem" }}>
          <a href={attribution.url} target="_blank" rel="noopener noreferrer">
            {attribution.text}
          </a>
        </div>
      )}

      {teamModal && (
        <TeamModal
          teamUrl={teamModal.url}
          teamName={teamModal.name}
          onClose={() => setTeamModal(null)}
          onOpenPlayer={(ref) => setPlayerModal(ref)}
        />
      )}
      {playerModal && (
        <PlayerModal
          playerRef={playerModal}
          onClose={() => setPlayerModal(null)}
          onFaceit={onPick}
        />
      )}
    </>
  );
}
