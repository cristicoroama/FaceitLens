import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";
const DISPLAY_BASE = "https://api.faceit-lens.com";

const ENDPOINTS = [
  {
    group: "Players",
    items: [
      { m: "GET", path: "/api/player/{nickname}/", desc: "Full player summary: ELO, level, stats, recent averages, maps, teammates, nemeses, activity, match history.", ex: "/api/player/donk666/" },
      { m: "GET", path: "/api/player/{nickname}/collectibles/", desc: "Account trust score, Steam level, medals and Steam inventory with market value.", ex: "/api/player/donk666/collectibles/" },
      { m: "GET", path: "/api/player/{nickname}/leetify/", desc: "Leetify demo-based ranks and skill ratings (aim, utility, positioning).", ex: "/api/player/donk666/leetify/" },
      { m: "GET", path: "/api/player/{nickname}/real/", desc: "Real demo-parsed HLTV 2.0 stats (needs the demo worker to have parsed matches).", ex: "/api/player/donk666/real/" },
      { m: "GET", path: "/api/steam/?id={steamid}", desc: "Resolve a SteamID64 or profile URL to the linked FACEIT player.", ex: "/api/steam/?id=76561198000000000" },
    ],
  },
  {
    group: "Match & tools",
    items: [
      { m: "GET", path: "/api/match/{match_id}/", desc: "Simplified scoreboard for a single finished match.", ex: "/api/match/1-xxxx/" },
      { m: "GET", path: "/api/matchroom/?url={faceit_room}", desc: "Scout a live/upcoming match room: both teams with ELO/level + a win prediction.", ex: "/api/matchroom/?url=faceit.com/en/cs2/room/1-xxxx" },
      { m: "GET", path: "/api/squad/?players={a,b,c}", desc: "Combined stats for a group of players and matches played together.", ex: "/api/squad/?players=s1mple,ZywOo,NiKo" },
      { m: "GET", path: "/api/met/?p1={a}&p2={b}", desc: "Whether two players have crossed paths in recent matches (together / against).", ex: "/api/met/?p1=s1mple&p2=b1t" },
    ],
  },
  {
    group: "Leaderboards & pro scene",
    items: [
      { m: "GET", path: "/api/leaderboard/?region={EU|NA|SA|OCE}", desc: "Regional FACEIT ranking. Optional &country=ro filter.", ex: "/api/leaderboard/?region=EU&country=ro" },
      { m: "GET", path: "/api/hltv/{section}/", desc: "HLTV pro scene: rankings, results, upcoming, team-stats, player-stats.", ex: "/api/hltv/rankings/" },
    ],
  },
  {
    group: "AI",
    items: [
      { m: "GET", path: "/api/analyze/{nickname}/", desc: "Short AI scouting report generated from the player's stats.", ex: "/api/analyze/donk666/" },
      { m: "GET", path: "/api/roast/{nickname}/", desc: "A short, funny AI roast based on the player's stats.", ex: "/api/roast/donk666/" },
    ],
  },
];

function Endpoint({ e }) {
  const [tried, setTried] = useState(null); // null | "loading" | text
  const url = DISPLAY_BASE + e.ex;

  async function tryIt() {
    setTried("loading");
    try {
      const resp = await fetch(`${API_BASE}${e.ex}`);
      const json = await resp.json();
      setTried(JSON.stringify(json, null, 2).slice(0, 1400));
    } catch (err) {
      setTried(`Error: ${err.message}`);
    }
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
        <span>Example:</span>
        <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
      </div>
      {tried && (
        <pre className="doc-out">{tried === "loading" ? "Loading…" : tried}</pre>
      )}
    </div>
  );
}

export default function ApiDocs() {
  return (
    <>
      <div className="page-hero">
        <div className="page-hero-title">
          <div className="panel-ic" style={{ width: 38, height: 38 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 18, height: 18 }}>
              <path d="m8 16-4-4 4-4M16 8l4 4-4 4M13 4l-2 16" />
            </svg>
          </div>
          API <em>Docs</em>
        </div>
        <div className="page-hero-sub">
          FaceitLens exposes a free, read-only JSON API. No key needed. All responses
          are cached; please be gentle. Base URL: <code>{DISPLAY_BASE}</code>
        </div>
      </div>

      {ENDPOINTS.map((g) => (
        <div key={g.group} style={{ marginBottom: 24 }}>
          <div className="section-title">{g.group}</div>
          {g.items.map((e) => <Endpoint e={e} key={e.path} />)}
        </div>
      ))}

      <div className="hltv-note" style={{ textAlign: "left", padding: "12px 2px 0" }}>
        Data comes from the FACEIT API, Steam, Leetify and HLTV. This API is provided
        as-is for hobby / community use — no uptime guarantees, and endpoints may
        change. If you build something cool with it, let me know.
      </div>
    </>
  );
}
