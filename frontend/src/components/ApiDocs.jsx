import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";
const DISPLAY_BASE = "https://api.faceit-lens.com";

const ENDPOINTS = [
  {
    id: "players", group: "Players",
    items: [
      { m: "GET", path: "/api/player/{nickname}/", desc: "Full player summary: ELO, level, lifetime + recent stats, maps, teammates, nemeses, activity, match history and smurf signals.", ex: "/api/player/donk666/" },
      { m: "GET", path: "/api/player/{nickname}/collectibles/", desc: "Account trust score, Steam level, medals and the full Steam inventory with market value.", ex: "/api/player/donk666/collectibles/" },
      { m: "GET", path: "/api/player/{nickname}/leetify/", desc: "Leetify demo-based ranks and skill ratings (aim, utility, positioning).", ex: "/api/player/donk666/leetify/" },
      { m: "GET", path: "/api/player/{nickname}/real/", desc: "Real demo-parsed HLTV 2.0 stats (requires the demo worker to have parsed matches).", ex: "/api/player/donk666/real/" },
      { m: "GET", path: "/api/player/{nickname}/clips/", desc: "Allstar.gg auto-generated highlight clips: embeddable iframe URLs, thumbnails, map and kill count. Empty until Allstar has clips for the player.", ex: "/api/player/donk666/clips/" },
      { m: "GET", path: "/api/steam/?id={steamid}", desc: "Resolve a SteamID64 or profile URL to the linked FACEIT player.", ex: "/api/steam/?id=76561198000000000" },
    ],
  },
  {
    id: "match", group: "Match & tools",
    items: [
      { m: "GET", path: "/api/match/{match_id}/", desc: "Simplified scoreboard for one finished match.", ex: "/api/match/1-xxxx/" },
      { m: "GET", path: "/api/matchroom/?url={room}", desc: "Scout a live/upcoming match room: both teams with ELO/level + an ELO win prediction.", ex: "/api/matchroom/?url=faceit.com/en/cs2/room/1-xxxx" },
      { m: "GET", path: "/api/squad/?players={a,b,c}", desc: "Combined stats for a group of players and matches played together.", ex: "/api/squad/?players=s1mple,ZywOo,NiKo" },
      { m: "GET", path: "/api/met/?p1={a}&p2={b}", desc: "Whether two players have crossed paths recently (together / against).", ex: "/api/met/?p1=s1mple&p2=b1t" },
      { m: "GET", path: "/api/hubs/?q={name}", desc: "Search FACEIT hubs by name.", ex: "/api/hubs/?q=ESEA" },
    ],
  },
  {
    id: "scene", group: "Leaderboards & pro scene",
    items: [
      { m: "GET", path: "/api/leaderboard/?region={EU|NA|SA|OCE}", desc: "Regional FACEIT ranking. Optional &country=ro filter.", ex: "/api/leaderboard/?region=EU&country=ro" },
    ],
  },
  {
    id: "ai", group: "AI",
    items: [
      { m: "GET", path: "/api/analyze/{nickname}/", desc: "Short AI scouting report generated from the player's stats.", ex: "/api/analyze/donk666/" },
      { m: "GET", path: "/api/roast/{nickname}/", desc: "A short, funny AI roast based on the player's stats.", ex: "/api/roast/donk666/" },
    ],
  },
];

const NAV = [
  { title: "Getting started", links: [
    ["overview", "Overview"], ["auth", "Authentication"], ["limits", "Rate limits"], ["attribution", "Attribution"],
  ]},
  { title: "Endpoints", links: ENDPOINTS.map((g) => [g.id, g.group]) },
];

const OVERALL_LABEL = {
  operational: "All systems operational",
  partial: "Partially operational",
  outage: "Major outage",
};

function StatusBadge({ data, loading }) {
  if (loading) return <span className="api-status checking"><i />Checking…</span>;
  if (!data) return <span className="api-status down"><i />Status unavailable</span>;
  const cls = data.overall === "operational" ? "up" : data.overall === "partial" ? "warn" : "down";
  return <span className={`api-status ${cls}`}><i />{OVERALL_LABEL[data.overall] || "Unknown"}</span>;
}

/** Full per-service breakdown, shown in the Overview section. */
function StatusPanel({ data, loading }) {
  return (
    <div className="svc-panel">
      <div className="svc-panel-head">System status</div>
      {loading && <div className="svc-row"><span className="svc-dot checking" /> Checking services…</div>}
      {!loading && data && data.services.map((s) => (
        <div className="svc-row" key={s.name}>
          <span className={`svc-dot ${s.ok ? "up" : "down"}`} />
          <span className="svc-name">{s.name}</span>
          <span className="svc-detail">{s.detail}</span>
          <span className={`svc-state ${s.ok ? "up" : "down"}`}>{s.ok ? "Operational" : "Down"}</span>
        </div>
      ))}
      {!loading && !data && <div className="svc-row"><span className="svc-dot down" /> Could not reach the status endpoint.</div>}
    </div>
  );
}

function Endpoint({ e }) {
  const [out, setOut] = useState(null);
  async function tryIt() {
    setOut("loading");
    try {
      const resp = await fetch(`${API_BASE}${e.ex}`);
      const json = await resp.json();
      setOut(JSON.stringify(json, null, 2).slice(0, 1600));
    } catch (err) { setOut(`Error: ${err.message}`); }
  }
  return (
    <div className="doc-ep">
      <div className="doc-ep-head">
        <span className="doc-method">{e.m}</span>
        <code className="doc-path">{e.path}</code>
        <button className="doc-try" onClick={tryIt}>Try it →</button>
      </div>
      <div className="doc-desc">{e.desc}</div>
      <div className="doc-ex">
        <span>Example</span>
        <a href={DISPLAY_BASE + e.ex} target="_blank" rel="noopener noreferrer">{DISPLAY_BASE + e.ex}</a>
      </div>
      {out && <pre className="doc-out">{out === "loading" ? "Loading…" : out}</pre>}
    </div>
  );
}

export default function ApiDocs() {
  const [active, setActive] = useState("overview");
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/status/`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => alive && setStatus(j))
      .catch(() => alive && setStatus(null))
      .finally(() => alive && setStatusLoading(false));
    return () => { alive = false; };
  }, []);

  function jump(id) {
    setActive(id);
    const el = document.getElementById(`doc-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="apidoc">
      {/* left nav */}
      <aside className="apidoc-nav">
        <div className="apidoc-brand">
          <span className="apidoc-brand-name">FaceitLens API</span>
          <span className="apidoc-brand-ver">v1</span>
        </div>
        {NAV.map((sec) => (
          <div className="apidoc-nav-sec" key={sec.title}>
            <div className="apidoc-nav-title">{sec.title}</div>
            {sec.links.map(([id, label]) => (
              <button
                key={id}
                className={`apidoc-nav-link ${active === id ? "active" : ""}`}
                onClick={() => jump(id)}
              >
                {label}
              </button>
            ))}
          </div>
        ))}
      </aside>

      {/* main */}
      <div className="apidoc-main">
        <div className="apidoc-topline">
          <div className="apidoc-crumbs">API Reference › Getting Started › Overview</div>
          <StatusBadge data={status} loading={statusLoading} />
        </div>

        <section id="doc-overview" className="apidoc-sec">
          <h1 className="apidoc-h1">FaceitLens API</h1>
          <div className="apidoc-tagline">
            Base URL <code>{DISPLAY_BASE}</code> · REST · JSON · GET only
          </div>
          <p className="apidoc-p">
            The FaceitLens API exposes the same data that powers the app — player
            summaries, trust scores, inventories, match histories, the HLTV pro
            scene and more. Everything is read-only, returns JSON, and is cached
            hard. No key required.
          </p>

          <StatusPanel data={status} loading={statusLoading} />

          <h2 className="apidoc-h2">Quick example</h2>
          <pre className="apidoc-code">curl "{DISPLAY_BASE}/api/player/donk666/"</pre>

          <h2 className="apidoc-h2">What you'll find</h2>
          <ul className="apidoc-list">
            <li><b>Authentication</b> — none needed, it's open.</li>
            <li><b>Rate limits</b> — be gentle; responses are cached.</li>
            <li><b>Attribution</b> — a link back is appreciated.</li>
            <li><b>Endpoints</b> — every URL the API supports, with live "Try it".</li>
          </ul>
        </section>

        <section id="doc-auth" className="apidoc-sec">
          <h2 className="apidoc-h2">Authentication</h2>
          <p className="apidoc-p">
            None. The API is public and read-only — just call the URLs directly.
            There are no keys, tokens or headers to set.
          </p>
        </section>

        <section id="doc-limits" className="apidoc-sec">
          <h2 className="apidoc-h2">Rate limits</h2>
          <p className="apidoc-p">
            No hard limit yet, but please be reasonable — this runs on a hobby
            budget. Every response is cached (player summaries ~3 min, match &
            inventory data hours), so hammering the same endpoint won't get you
            fresher data, just a slower site for everyone. Cache your own results
            where you can.
          </p>
        </section>

        <section id="doc-attribution" className="apidoc-sec">
          <h2 className="apidoc-h2">Attribution</h2>
          <p className="apidoc-p">
            If you build something with this, a "Powered by FaceitLens" credit
            linking to <a href="https://faceit-lens.com" target="_blank" rel="noopener noreferrer">faceit-lens.com</a> is
            appreciated. Data ultimately comes from the FACEIT API, Steam, Leetify
            and HLTV — respect their terms too.
          </p>
        </section>

        {ENDPOINTS.map((g) => (
          <section id={`doc-${g.id}`} className="apidoc-sec" key={g.id}>
            <h2 className="apidoc-h2">{g.group}</h2>
            {g.items.map((e) => <Endpoint e={e} key={e.path} />)}
          </section>
        ))}

        <div className="apidoc-foot">
          Provided as-is for hobby / community use — no uptime guarantees, endpoints
          may change. Built something cool? Ping me on Discord.
        </div>
      </div>
    </div>
  );
}
