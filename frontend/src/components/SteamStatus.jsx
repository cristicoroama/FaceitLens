import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

function fmtNum(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString();
}
function loadColor(load) {
  const l = (load || "").toLowerCase();
  if (l === "low") return "var(--win)";
  if (l === "medium") return "var(--gold)";
  if (l === "high" || l === "full") return "var(--loss)";
  return "var(--text-dim)";
}
function stateOk(s) {
  return (s || "").toLowerCase() === "normal";
}

export default function SteamStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/steamstatus/`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => alive && setData(j))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const mm = data?.matchmaking || {};
  const good = data?.overall === "operational";

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-title">
          <div className="panel-ic" style={{ width: 38, height: 38 }}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ width: 18, height: 18 }}>
              <path d="M11.98 2C6.72 2 2.4 6.03 2.03 11.19l5.36 2.22a2.79 2.79 0 0 1 1.57-.48l.14.01 2.39-3.46v-.05a3.72 3.72 0 1 1 3.72 3.72h-.09l-3.4 2.43v.13a2.8 2.8 0 0 1-5.58.2l-3.84-1.6A10 10 0 1 0 11.98 2Z" />
            </svg>
          </div>
          Steam / <em>CS2 Status</em>
        </div>
        <div className="page-hero-sub">
          Live Counter-Strike 2 matchmaking status, online players and datacenter
          load — straight from Valve's official Steam Web API.
        </div>
      </div>

      {loading && <div className="state">Checking Steam…</div>}

      {!loading && (!data || !data.available) && (
        <div className="state">
          Steam status is unavailable{data?.reason === "no_key" ? " (server has no Steam API key set)" : ""}.
        </div>
      )}

      {!loading && data && data.available && (
        <>
          <div className={`fs-banner ${good ? "up" : "warn"}`}>
            <span className="fs-banner-dot" />
            {good ? "CS2 matchmaking is online" : "CS2 is reporting issues"}
          </div>

          <div className="ss-stats">
            <div className="ss-stat">
              <div className="ss-stat-val">{fmtNum(mm.online_players)}</div>
              <div className="ss-stat-label">Players online</div>
            </div>
            <div className="ss-stat">
              <div className="ss-stat-val">{fmtNum(mm.searching_players)}</div>
              <div className="ss-stat-label">In queue</div>
            </div>
            <div className="ss-stat">
              <div className="ss-stat-val">
                {mm.search_seconds_avg != null ? `${mm.search_seconds_avg}s` : "—"}
              </div>
              <div className="ss-stat-label">Avg search</div>
            </div>
            <div className="ss-stat">
              <div className="ss-stat-val">{fmtNum(mm.online_servers)}</div>
              <div className="ss-stat-label">Servers</div>
            </div>
          </div>

          <div className="section-title">Steam services</div>
          <div className="fs-components">
            {data.services.map((s) => (
              <div className={`fs-comp ${stateOk(s.state) ? "up" : "down"}`} key={s.name}>
                <span className="fs-comp-dot" />
                <span className="fs-comp-name">{s.name}</span>
                <span className="fs-comp-state">{s.state}</span>
              </div>
            ))}
          </div>

          {data.datacenters && data.datacenters.length > 0 && (
            <>
              <div className="section-title">Datacenters <span className="section-count">{data.datacenters.length}</span></div>
              <div className="ss-dc-grid">
                {data.datacenters.map((d) => (
                  <div className="ss-dc" key={d.name}>
                    <span className="ss-dc-name">{d.name}</span>
                    <span className="ss-dc-load" style={{ color: loadColor(d.load) }}>
                      {d.load || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="hltv-note" style={{ textAlign: "left", padding: "12px 2px 0" }}>
            Source: Valve's official Steam Web API (CS2 game server status). Cached ~2 min.
            {data.app_version ? ` CS2 build ${data.app_version}.` : ""}
          </div>
        </>
      )}
    </>
  );
}
