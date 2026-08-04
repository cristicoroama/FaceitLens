import { useState, useEffect } from "react";

import { Icon } from "../icons.jsx";
import { getJson } from "../api.js";

function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

function when(ts) {
  if (!ts) return null;
  const d = new Date(Number(ts) * (String(ts).length > 10 ? 1 : 1000));
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
}

/**
 * Championships and tournaments.
 *
 * `/championships?game=cs2` is the only competition endpoint FACEIT lets you
 * browse without knowing a name, so it's what loads by default; searching
 * then queries championships and tournaments together, since from the outside
 * they're the same thing to whoever is looking.
 */
export default function Competitions({ onPick }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [detail, setDetail] = useState(null);
  const [organizer, setOrganizer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  useEffect(() => { load(""); /* eslint-disable-next-line */ }, []);

  async function load(query) {
    setLoading(true); setError(""); setDetail(null); setOrganizer(null); setItems([]);
    try {
      const qs = query ? `?q=${encodeURIComponent(query)}` : "";
      const json = await getJson(`/api/competitions/${qs}`);
      setItems(json.items || []);
      setSearched(!!query);
      if (query && (json.items || []).length === 0) setError("Nothing found.");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function open(c) {
    setLoading(true); setError(""); setItems([]); setOrganizer(null);
    try {
      const kind = c.kind === "tournament" ? "tournament" : "championship";
      const json = await getJson(`/api/competition/${kind}/${encodeURIComponent(c.id)}/`);
      setDetail(json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function openOrganizer(id) {
    setLoading(true); setError("");
    try {
      const json = await getJson(`/api/organizer/${encodeURIComponent(id)}/`);
      setOrganizer(json); setDetail(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-title">
          <div className="panel-ic" style={{ width: 38, height: 38 }}>{Icon.trophy}</div>
          CS2 <em>Competitions</em>
        </div>
        <div className="page-hero-sub">
          Championships and tournaments running on FACEIT — brackets, placements and who organises them.
        </div>
      </div>

      <div className="search">
        <input
          type="text"
          placeholder="Search a championship or tournament…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(q.trim())}
        />
        <button onClick={() => load(q.trim())} disabled={loading}>
          {loading ? "..." : "Search"}
        </button>
      </div>

      {error && <div className="state error">{error}</div>}
      {loading && <div className="state">Loading…</div>}

      {/* ---- list ---- */}
      {!loading && items.length > 0 && (
        <>
          <div className="section-title">
            {searched ? "Results" : "Open championships"}
            <span className="section-count">{items.length}</span>
          </div>
          <div className="lrows stagger">
            {items.map((c) => (
              <div className="lrow lrow-click" key={`${c.kind}-${c.id}`} onClick={() => open(c)}>
                {c.avatar ? (
                  <img className="lrow-ava img" src={c.avatar} alt="" loading="lazy" />
                ) : (
                  <div className="lrow-ava">{initials(c.name)}</div>
                )}
                <div className="lrow-main">
                  <div className="lrow-name">
                    {c.name}
                    {c.featured && <span className="cmp-tag hot">Featured</span>}
                  </div>
                  <div className="lrow-sub">
                    <span className="cmp-kind">{c.kind}</span>
                    {c.organizer && <span>{c.organizer}</span>}
                    {c.region && <span>{c.region}</span>}
                    {c.status && <span>{c.status}</span>}
                    {when(c.starts_at) && <span>{when(c.starts_at)}</span>}
                  </div>
                </div>
                <span className="m2-chev">›</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---- one competition ---- */}
      {detail && (
        <>
          <div className={`hub-hero ${detail.cover ? "has-cover" : ""}`}>
            {detail.cover && (
              <img className="hub-hero-cover" src={detail.cover} alt="" aria-hidden="true"
                loading="lazy" onError={(e) => { e.currentTarget.remove(); }} />
            )}
            {detail.avatar ? (
              <img className="hub-hero-ava" src={detail.avatar} alt="" />
            ) : (
              <div className="hub-hero-ava ph">{initials(detail.name)}</div>
            )}
            <div className="hub-hero-info">
              <div className="hub-hero-name">{detail.name}</div>
              <div className="hub-hero-meta">
                <span className="cmp-kind">{detail.kind}</span>
                {detail.region && <span>{detail.region}</span>}
                {detail.status && <span>{detail.status}</span>}
                {detail.players != null && <span>{detail.players} players</span>}
                {detail.subscriptions != null && (
                  <span>{detail.subscriptions}{detail.slots ? ` / ${detail.slots}` : ""} joined</span>
                )}
                {detail.best_of && <span>Bo{detail.best_of}</span>}
                {detail.organizer_id && (
                  <button className="cmp-org" onClick={() => openOrganizer(detail.organizer_id)}>
                    View organiser
                  </button>
                )}
                {detail.faceit_url && (
                  <a href={detail.faceit_url} target="_blank" rel="noopener noreferrer">
                    View on FACEIT
                  </a>
                )}
              </div>
              {detail.description && <div className="hub-hero-desc">{detail.description}</div>}
            </div>
          </div>

          {/* Final placements — championships only, and only once played. */}
          {detail.results?.length > 0 && (
            <>
              <div className="section-title">Final standings</div>
              <div className="lrows">
                {detail.results.map((r) => (
                  <div className="lrow" key={`${r.position}-${r.name}`}>
                    <span className="hub-pos">#{r.position}</span>
                    <div className="lrow-main"><div className="lrow-name">{r.name}</div></div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Bracket — tournaments only, and only once drawn. */}
          {detail.rounds?.length > 0 && (
            <>
              <div className="section-title">Bracket</div>
              <div className="brk">
                {detail.rounds.map((rnd, i) => (
                  <div className="brk-round" key={rnd.name || i}>
                    <div className="brk-round-name">{rnd.name || `Round ${i + 1}`}</div>
                    {rnd.matches.map((m, j) => {
                      const aw = m.a.score != null && m.b.score != null && m.a.score > m.b.score;
                      const bw = m.a.score != null && m.b.score != null && m.b.score > m.a.score;
                      return (
                        <div className="brk-match" key={j}>
                          <div className={`brk-side ${aw ? "won" : ""}`}>
                            <span>{m.a.name || "TBD"}</span><b>{m.a.score ?? "–"}</b>
                          </div>
                          <div className={`brk-side ${bw ? "won" : ""}`}>
                            <span>{m.b.name || "TBD"}</span><b>{m.b.score ?? "–"}</b>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ---- one organiser ---- */}
      {organizer && (
        <>
          <div className={`hub-hero ${organizer.cover ? "has-cover" : ""}`}>
            {organizer.cover && (
              <img className="hub-hero-cover" src={organizer.cover} alt="" aria-hidden="true"
                loading="lazy" onError={(e) => { e.currentTarget.remove(); }} />
            )}
            {organizer.avatar ? (
              <img className="hub-hero-ava" src={organizer.avatar} alt="" />
            ) : (
              <div className="hub-hero-ava ph">{initials(organizer.name)}</div>
            )}
            <div className="hub-hero-info">
              <div className="hub-hero-name">{organizer.name}</div>
              <div className="hub-hero-meta">
                {organizer.followers != null && <span>{organizer.followers.toLocaleString()} followers</span>}
                {Object.entries(organizer.links || {}).map(([k, v]) => (
                  <a key={k} href={v} target="_blank" rel="noopener noreferrer">{k}</a>
                ))}
              </div>
              {organizer.description && <div className="hub-hero-desc">{organizer.description}</div>}
            </div>
          </div>

          {[["Hubs", organizer.hubs], ["Championships", organizer.championships],
            ["Tournaments", organizer.tournaments]].map(([label, list]) =>
            list?.length ? (
              <div key={label}>
                <div className="section-title">{label}<span className="section-count">{list.length}</span></div>
                <div className="lrows">
                  {list.map((x) => (
                    <div className="lrow" key={x.id || x.hub_id}>
                      <div className="lrow-main">
                        <div className="lrow-name">{x.name}</div>
                        {(x.players != null || x.region) && (
                          <div className="lrow-sub">
                            {x.region && <span>{x.region}</span>}
                            {x.players != null && <span>{x.players} players</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </>
      )}
    </>
  );
}
