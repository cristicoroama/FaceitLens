import { useState } from "react";
import { FaceitLevel, Flag } from "./RankIcons.jsx";
import { Icon } from "../icons.jsx";
import { API_BASE } from "../api.js";
import "../styles/match.css";

const STEAM64_BASE = 76561197960265728n;
const MAX_PLAYERS = 10;

const SAMPLE = `# userid name uniqueid connected ping loss state rate
#  2 1 "player_one" [U:1:12345678] 10:21 35 0 active 786432
#  3 2 "player_two" STEAM_1:0:23456789 10:20 41 0 active 786432
https://steamcommunity.com/profiles/76561198000000000`;

export function parseSteamIds(text) {
  const out = [];
  const re = /\[U:1:(\d+)\]|STEAM_[0-5]:([01]):(\d+)|(?<!\d)(7656119\d{10})(?!\d)|steamcommunity\.com\/id\/([\w.-]+)/g;
  for (const m of String(text || "").matchAll(re)) {
    let id = null;
    if (m[1]) id = (STEAM64_BASE + BigInt(m[1])).toString();
    else if (m[3]) id = (STEAM64_BASE + BigInt(m[3]) * 2n + BigInt(m[2])).toString();
    else if (m[4]) id = m[4];
    else if (m[5]) id = `https://steamcommunity.com/id/${m[5]}`;
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

function TrustPill({ trust }) {
  if (!trust) return <span className="lc-dim">—</span>;
  const tier = String(trust.tier || "").toLowerCase();
  return (
    <span className={`lc-trust t-${tier}`} title={trust.flags?.map((f) => `${f.label}: ${f.detail}`).join(" · ") || undefined}>
      <b>{trust.score}</b> {trust.tier}
    </span>
  );
}

function BanCell({ row }) {
  const bits = [];
  if (row.faceit?.banned) bits.push(["FACEIT ban", "bad"]);
  if (row.steam?.vac_banned) bits.push([`VAC${row.steam.vac_count > 1 ? ` ×${row.steam.vac_count}` : ""}`, "bad"]);
  if (row.steam?.game_ban_count) bits.push([`Game ban ×${row.steam.game_ban_count}`, "bad"]);
  if (!bits.length) {
    return <span className="lc-ok">{row.steam?.available ? "Clean" : row.faceit ? "No FACEIT ban" : "—"}</span>;
  }
  return (
    <span className="lc-bans">
      {bits.map(([t, c]) => <span key={t} className={`lc-ban ${c}`}>{t}</span>)}
    </span>
  );
}

function PlayerCell({ row, onPick }) {
  const f = row.faceit;
  if (row.hidden) return <span className="lc-dim">Profile unavailable</span>;
  if (!f) {
    return (
      <span className="lc-p">
        {row.steam?.avatar
          ? <img className="lc-ava" src={row.steam.avatar} alt="" loading="lazy" />
          : <span className="lc-ava ph" aria-hidden="true">?</span>}
        <span className="lc-nick-wrap">
          <a className="lc-nick" href={row.steam?.profile_url} target="_blank" rel="noopener noreferrer">
            {row.steam?.persona || row.steam_id}
          </a>
          <span className="lc-dim">{row.error || "No FACEIT account"}</span>
        </span>
      </span>
    );
  }
  const href = `/player/${encodeURIComponent(f.nickname)}`;
  return (
    <span className="lc-p">
      {f.avatar
        ? <img className="lc-ava" src={f.avatar} alt="" loading="lazy" />
        : <span className="lc-ava ph" aria-hidden="true">{(f.nickname || "?").slice(0, 2).toUpperCase()}</span>}
      <FaceitLevel level={f.level || 1} size={18} />
      {f.country && <Flag country={f.country} size={13} />}
      <a
        className="lc-nick"
        href={href}
        onClick={(e) => {
          if (!onPick || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          onPick(f.nickname);
        }}
      >
        {f.nickname}
      </a>
    </span>
  );
}

export default function LobbyCheck({ onPick }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ids = parseSteamIds(text);

  async function check() {
    if (!ids.length) {
      setError("No Steam IDs found. Paste the output of status, profile links or SteamID64s.");
      return;
    }
    setLoading(true);
    setError("");
    setRows(null);
    try {
      const resp = await fetch(`${API_BASE}/api/lobby/check/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ids.slice(0, MAX_PLAYERS) }),
      });
      let json = null;
      try { json = await resp.json(); } catch { json = null; }
      if (!resp.ok) throw new Error(json?.error || `Error ${resp.status}`);
      setRows(json.players || []);
      setMeta({ truncated: ids.length > MAX_PLAYERS || json.truncated, steam: json.steam_data });
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-title">
          <div className="panel-ic" style={{ width: 38, height: 38 }}>
            <span style={{ fontSize: 18, display: "grid" }}>{Icon.shieldCheck}</span>
          </div>
          Lobby <em>Check</em>
        </div>
        <div className="page-hero-sub">
          Paste the output of the CS2 console <code>status</code> command, Steam profile
          links or SteamID64s, and see every player's FACEIT level, ELO, trust score and bans at once.
        </div>
      </div>

      <div className="lc-input">
        <label htmlFor="lc-text" className="lc-label">Players to check</label>
        <textarea
          id="lc-text"
          className="lc-text"
          rows={7}
          spellCheck={false}
          placeholder={SAMPLE}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) check();
          }}
        />
        <div className="lc-actions">
          <span className="lc-dim" aria-live="polite">
            {ids.length
              ? `${ids.length} player${ids.length === 1 ? "" : "s"} found${ids.length > MAX_PLAYERS ? `, the first ${MAX_PLAYERS} will be checked` : ""}`
              : "No players found yet"}
          </span>
          <button type="button" className="act-btn" onClick={() => setText(SAMPLE)}>Show example</button>
          <button type="button" className="lc-go" onClick={check} disabled={loading || !ids.length}>
            {loading ? "Checking…" : "Check lobby"}
          </button>
        </div>
      </div>

      <details className="lc-help">
        <summary>How do I get the status output?</summary>
        <ol>
          <li>Enable the developer console in CS2: Settings → Game → Enable Developer Console.</li>
          <li>While in a match, press <kbd>~</kbd> to open the console.</li>
          <li>Type <code>status</code> and press Enter.</li>
          <li>Select the player lines (they contain <code>[U:1:…]</code>), copy them with Ctrl+C and paste them above.</li>
        </ol>
        <p>Steam profile links and 17-digit SteamID64s work too, one per line or mixed with other text. Custom /id/ links only resolve when the server has a Steam API key.</p>
      </details>

      {error && <div className="state error">{error}</div>}

      {loading && (
        <div className="lc-skel" aria-hidden="true">
          {Array.from({ length: Math.min(ids.length || 5, MAX_PLAYERS) }).map((_, i) => (
            <div className="sk lc-skel-row" key={i} />
          ))}
        </div>
      )}

      {rows && (
        <div className="lc-table-wrap">
          <table className="lc-table">
            <caption className="sr-only">Lobby check results</caption>
            <thead>
              <tr>
                <th className="l" scope="col">Player</th>
                <th scope="col">ELO</th>
                <th scope="col">Matches</th>
                <th scope="col">Trust</th>
                <th scope="col">Bans</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.steam_id} className={r.faceit?.banned || r.steam?.vac_banned ? "is-banned" : ""}>
                  <td className="l"><PlayerCell row={r} onPick={onPick} /></td>
                  <td className="num">{r.faceit?.elo ?? "—"}</td>
                  <td className="num">{r.faceit?.matches ?? "—"}</td>
                  <td><TrustPill trust={r.trust} /></td>
                  <td><BanCell row={r} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="hltv-note">
            Trust is an account-age, hours and activity score, not cheat detection.
            {meta?.steam === false && " Steam data (VAC bans, hours, account age) isn't configured on this server, so the score uses FACEIT activity only."}
            {meta?.truncated && ` Only the first ${MAX_PLAYERS} players were checked.`}
          </div>
        </div>
      )}
    </>
  );
}
