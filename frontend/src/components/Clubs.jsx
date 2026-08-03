import { useState } from "react";
import { Icon } from "../icons.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

export default function Clubs({ onPick }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    const query = q.trim();
    if (!query) return;
    setLoading(true); setError(""); setClub(null); setResults([]);
    try {
      const resp = await fetch(`${API_BASE}/api/clubs/?q=${encodeURIComponent(query)}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
      setResults(json.items || []);
      if ((json.items || []).length === 0) setError("No clubs found.");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function openClub(c) {
    setLoading(true); setError(""); setResults([]);
    try {
      const resp = await fetch(`${API_BASE}/api/club/${encodeURIComponent(c.club_id)}/`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
      setClub(json);
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
          FACEIT <em>Clubs</em>
        </div>
        <div className="page-hero-sub">
          Search any FACEIT club and browse its roster. Click a member to open their profile.
        </div>
      </div>

      <div className="search">
        <input
          type="text"
          placeholder="Club name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button onClick={search} disabled={loading}>{loading ? "…" : "Search"}</button>
      </div>

      {error && <div className="state error">{error}</div>}
      {loading && <div className="state">Loading…</div>}

      {results.length > 0 && (
        <div className="lrows stagger">
          {results.map((c) => (
            <div className="lrow lrow-click" key={c.club_id} onClick={() => openClub(c)}>
              {c.avatar ? (
                <img className="lrow-ava img" src={c.avatar} alt="" loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
              ) : (
                <div className="lrow-ava">{initials(c.name)}</div>
              )}
              <div className="lrow-main"><div className="lrow-name">{c.name}</div></div>
              <span className="m2-chev">›</span>
            </div>
          ))}
        </div>
      )}

      {club && (
        <>
          <div className="club-hero">
            {club.avatar ? (
              <img className="club-hero-ava" src={club.avatar} alt="" />
            ) : (
              <div className="club-hero-ava ph">{initials(club.name)}</div>
            )}
            <div className="club-hero-info">
              <div className="club-hero-name">{club.name}</div>
              <div className="club-hero-meta">
                {club.owner && <span>{Icon.award} {club.owner}</span>}
                <span>{club.member_count} members</span>
              </div>
              {club.description && <div className="club-hero-desc">{club.description}</div>}
            </div>
          </div>

          <div className="section-title">Members <span className="section-count">{club.members.length}</span></div>
          {club.members.length === 0 ? (
            <div className="state">Member list is private for this club.</div>
          ) : (
            <div className="club-members">
              {club.members.map((m) => (
                <button className="club-member" key={m.player_id || m.nickname} onClick={() => onPick(m.nickname)}>
                  {m.avatar ? (
                    <img src={m.avatar} alt="" loading="lazy"
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                  ) : (
                    <span className="club-member-ph">{initials(m.nickname)}</span>
                  )}
                  <span className="club-member-name">{m.nickname}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
