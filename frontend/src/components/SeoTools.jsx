import { useEffect, useState } from "react";
import { FaceitLevel, Flag } from "./RankIcons.jsx";
import { LEVELS, levelFor } from "../faceit-levels.js";
import { getJson } from "../api.js";

function Hero({ eyebrow, title, sub, children }) {
  return (
    <div className="st-hero">
      <div className="st-eyebrow">{eyebrow}</div>
      <h1 className="st-title">{title}</h1>
      <p className="st-sub">{sub}</p>
      {children}
    </div>
  );
}

function looksLikeRoom(v) {
  return /faceit\.com\/.*\/room\//i.test(v) || /^1-[0-9a-f-]{20,}$/i.test(v.trim());
}

function playerFromInput(v) {
  const m = v.match(/players?\/([^/?#\s]+)/i);
  return m ? decodeURIComponent(m[1]) : v.trim();
}

function TopPlayers({ onPick }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    getJson("/api/leaderboard/?region=EU&limit=10").then((j) => setRows(j.items || [])).catch(() => setRows([]));
  }, []);
  if (!rows?.length) return null;
  return (
    <div className="st-top">
      <div className="section-title">Try it on the top of the EU ladder</div>
      <div className="st-top-list">
        {rows.map((r) => (
          <a key={r.player_id || r.nickname} className="st-top-row" href={`/player/${encodeURIComponent(r.nickname)}`}
            onClick={(e) => { if (!e.metaKey && !e.ctrlKey && e.button === 0) { e.preventDefault(); onPick(r.nickname); } }}>
            <span className="st-top-pos">#{r.position}</span>
            {r.country && <Flag country={r.country} size={14} />}
            <span className="st-top-name">{r.nickname}</span>
            <FaceitLevel level={r.level || 10} size={20} />
            <span className="st-top-elo">{r.elo}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function SmurfChecker({ onPick, onPath }) {
  const [v, setV] = useState("");
  function go() {
    const q = v.trim();
    if (!q) return;
    if (looksLikeRoom(q)) onPath(`/matchroom?room=${encodeURIComponent(q)}`);
    else if (/7656\d{13}/.test(q)) onPath(`/steam/${q.match(/7656\d{13}/)[0]}`);
    else onPick(playerFromInput(q));
  }
  return (
    <>
      <Hero eyebrow="Free tool" title="FACEIT Smurf Checker for CS2"
        sub="Paste a FACEIT match room link to check all 10 players at once, or a nickname or Steam link to check one account.">
        <div className="st-search">
          <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder="Match room link, FACEIT nickname or Steam profile" />
          <button className="btn-primary" onClick={go}>Check</button>
        </div>
      </Hero>
      <div className="section-title">What we look at</div>
      <div className="st-grid">
        {[
          ["Account age", "A Steam account made weeks ago with a high level is the classic smurf pattern."],
          ["CS2 hours", "Few hours played with Level 9–10 performance is worth a closer look."],
          ["Bans", "Previous FACEIT and VAC bans on the account, from the official APIs."],
          ["Performance vs level", "K/D, ADR and headshot rate that are far above the player's FACEIT level."],
          ["FACEIT matches", "Very few matches on FACEIT combined with high ELO."],
          ["Reputation", "Community reputation and medals from CSRep, shown with a trust score."],
        ].map(([t, d]) => (
          <div className="st-card" key={t}><b>{t}</b><span>{d}</span></div>
        ))}
      </div>
      <p className="st-note">A low trust score is a signal to look closer, never proof. Plenty of legit players are new to FACEIT or play on a fresh account.</p>
    </>
  );
}

export function EloChecker({ onPick }) {
  const [v, setV] = useState("");
  const go = () => { const q = playerFromInput(v); if (q) onPick(q); };
  return (
    <>
      <Hero eyebrow="Free tool" title="FACEIT ELO Checker"
        sub="Check the FACEIT ELO, level, win rate, K/D and recent matches of any CS2 player. Type a nickname or paste a FACEIT profile link.">
        <div className="st-search">
          <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder="FACEIT nickname (case-sensitive) or profile link" />
          <button className="btn-primary" onClick={go}>Check ELO</button>
        </div>
      </Hero>
      <LevelTable compact />
      <TopPlayers onPick={onPick} />
    </>
  );
}

function LevelTable({ compact }) {
  return (
    <div className={`st-levels ${compact ? "compact" : ""}`}>
      {LEVELS.map((l) => (
        <div className="st-level" key={l.level}>
          <FaceitLevel level={l.level} size={compact ? 30 : 38} />
          <span className="st-level-name">Level {l.level}</span>
          <span className="st-level-range">{l.max ? `${l.min.toLocaleString()} – ${l.max.toLocaleString()}` : `${l.min.toLocaleString()}+`}</span>
        </div>
      ))}
    </div>
  );
}

export function FaceitLevels() {
  const [elo, setElo] = useState("1200");
  const [wr, setWr] = useState("52");
  const [gain, setGain] = useState("25");
  const e = Number(elo), w = Math.min(99, Math.max(1, Number(wr))) / 100, g = Math.max(1, Number(gain));
  const cur = levelFor(e);
  const next = cur && LEVELS.find((l) => l.level === cur.level + 1);
  const need = next ? next.min - e : null;
  const perMatch = g * w - g * (1 - w);
  const matches = need != null && need > 0 && perMatch > 0 ? Math.ceil(need / perMatch) : null;
  const winsInRow = need != null && need > 0 ? Math.ceil(need / g) : null;
  return (
    <>
      <Hero eyebrow="FACEIT CS2" title="FACEIT Levels and ELO Ranges"
        sub="Every FACEIT level with the ELO it starts and ends at, how ELO is gained and lost, and a calculator for how many matches you need to reach the next level." />
      <LevelTable />
      <div className="section-title">Next level calculator</div>
      <div className="st-calc">
        <label>Your ELO<input type="number" value={elo} onChange={(x) => setElo(x.target.value)} /></label>
        <label>Win rate %<input type="number" value={wr} onChange={(x) => setWr(x.target.value)} /></label>
        <label>ELO per match<input type="number" value={gain} onChange={(x) => setGain(x.target.value)} /></label>
        <div className="st-calc-out">
          {cur && <span>You are <b>Level {cur.level}</b>.</span>}
          {!next && cur && <span>Level 10 is the top. Challenger is the top 1000 of your region.</span>}
          {next && need > 0 && (
            <>
              <span><b>{need}</b> ELO to Level {next.level}.</span>
              <span>That is <b>{winsInRow}</b> wins in a row, or about <b>{matches ?? "∞"}</b> matches at {Math.round(w * 100)}% win rate.</span>
              {perMatch <= 0 && <span className="neg">Below 50% win rate you lose ELO on average.</span>}
            </>
          )}
        </div>
      </div>
    </>
  );
}
