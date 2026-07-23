import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

function cleanDate(s) {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function FaceitStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/faceitstatus/`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => alive && setData(j))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const overall = data?.overall;
  const banner =
    overall === "operational" ? { cls: "up", text: "All FACEIT systems operational" }
    : overall === "issues" ? { cls: "warn", text: "FACEIT is reporting active issues" }
    : { cls: "down", text: "Couldn't reach FACEIT status" };

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-title">
          <div className="panel-ic" style={{ width: 38, height: 38 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 18, height: 18 }}>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          FACEIT <em>Status</em>
        </div>
        <div className="page-hero-sub">
          Live platform status straight from FACEIT's official status page — is
          matchmaking, login or anti-cheat down? Check before you blame your internet.
        </div>
      </div>

      {loading && <div className="state">Checking FACEIT…</div>}

      {!loading && (
        <>
          <div className={`fs-banner ${banner.cls}`}>
            <span className="fs-banner-dot" />
            {banner.text}
          </div>

          {data && (
            <>
              <div className="section-title">Components</div>
              <div className="fs-components">
                {data.components.map((c) => (
                  <div className={`fs-comp ${c.ok ? "up" : "down"}`} key={c.name}>
                    <span className="fs-comp-dot" />
                    <span className="fs-comp-name">{c.name}</span>
                    <span className="fs-comp-state">{c.ok ? "Operational" : "Issues"}</span>
                  </div>
                ))}
              </div>

              {data.incidents && data.incidents.length > 0 && (
                <>
                  <div className="section-title">Recent incidents</div>
                  <div className="fs-incidents">
                    {data.incidents.map((inc, i) => (
                      <a className="fs-inc" href={inc.link} target="_blank" rel="noopener noreferrer" key={i}>
                        <span className={`fs-inc-badge ${inc.resolved ? "ok" : "active"}`}>
                          {inc.resolved ? "Resolved" : inc.state}
                        </span>
                        <div className="fs-inc-main">
                          <div className="fs-inc-title">{inc.title}</div>
                          {inc.components.length > 0 && (
                            <div className="fs-inc-comps">{inc.components.join(" · ")}</div>
                          )}
                        </div>
                        <span className="fs-inc-date">{cleanDate(inc.date)}</span>
                      </a>
                    ))}
                  </div>
                </>
              )}

              <div className="hltv-note" style={{ textAlign: "left", padding: "12px 2px 0" }}>
                Source: <a href={data.source} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>faceitstatus.com</a> (official).
                Cached ~5 min. This mirrors FACEIT's own status — not a FaceitLens judgement.
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
