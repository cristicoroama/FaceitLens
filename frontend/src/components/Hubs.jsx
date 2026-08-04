import { useState } from "react";
import { Icon } from "../icons.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

export default function Hubs({ onPick }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    const query = q.trim();
    if (!query) return;
    setLoading(true); setError(""); setHub(null); setResults([]);
    try {
      const resp = await fetch(`${API_BASE}/api/hubs/?q=${encodeURIComponent(query)}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
      setResults(json.items || []);
      if ((json.items || []).length === 0) setError("No hubs found.");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function openHub(h) {
    setLoading(true); setError(""); setResults([]);
    try {
      const resp = await fetch(`${API_BASE}/api/hub/${encodeURIComponent(h.hub_id)}/`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
      setHub(json);
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

      {results.length > 0 && (
        <div className="lrows stagger">
          {results.map((c) => (
            <div className="lrow lrow-click" key={c.hub_id} onClick={() => openHub(c)}>
              {/* Hub search returns no image at all — only the detail endpoint
                  has one — so the row leans on initials plus the facts that
                  actually help you pick: who runs it and how busy it is. */}
              <div className="lrow-ava">{initials(c.name)}</div>
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
