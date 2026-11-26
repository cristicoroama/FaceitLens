import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMatchDemo, requestMatchParse } from "../lib/demo-api.js";
import "../styles/demo.css";

const POLL_MS = 8000;
const ACTIVE = new Set(["queued", "processing"]);

function pct(v) {
  return v == null ? "—" : `${v}%`;
}

function ratingClass(r) {
  if (r >= 1.15) return "demo-good";
  if (r < 0.9) return "demo-bad";
  return "";
}

function StatusLine({ state }) {
  if (state.status === "queued") {
    return (
      <div className="demo-status">
        <span className="demo-spinner" aria-hidden="true" />
        Queued{state.position ? ` · position ${state.position}` : ""}. Parsing usually takes a few minutes.
      </div>
    );
  }
  if (state.status === "processing") {
    return (
      <div className="demo-status">
        <span className="demo-spinner" aria-hidden="true" />
        Downloading and parsing the demo…
      </div>
    );
  }
  if (state.status === "failed") {
    return <div className="demo-status demo-status-error">Parsing failed{state.error ? `: ${state.error}` : "."}</div>;
  }
  return null;
}

function PlayerTable({ match }) {
  return (
    <div className="demo-table-wrap">
      <table className="demo-table">
        <thead>
          <tr>
            <th className="demo-left">Player</th>
            <th title="HLTV Rating 2.0">Rating</th>
            <th>K-D-A</th>
            <th>ADR</th>
            <th>KAST</th>
            <th title="Opening kills / deaths">Open</th>
            <th title="Trade kills / traded deaths">Trades</th>
            <th title="Clutches won / attempted">Clutch</th>
            <th title="Enemies flashed per flash thrown">Flash eff.</th>
            <th title="HE + fire damage">Util dmg</th>
            <th title="Average equipment value">Avg equip</th>
          </tr>
        </thead>
        <tbody>
          {match.players.map((p) => (
            <tr key={p.steamid}>
              <td className="demo-left demo-name">{p.name || p.steamid}</td>
              <td className={`demo-strong ${ratingClass(p.rating)}`}>{p.rating.toFixed(2)}</td>
              <td>{`${p.kills}-${p.deaths}-${p.assists}`}</td>
              <td>{p.adr ?? "—"}</td>
              <td>{pct(p.kast)}</td>
              <td>{`${p.opening_kills}/${p.opening_deaths}`}</td>
              <td>{`${p.trade_kills}/${p.traded_deaths}`}</td>
              <td>{`${p.clutch_won}/${p.clutch_attempts}`}</td>
              <td>{p.utility.flash_efficiency ?? "—"}</td>
              <td>{Math.round(p.utility.he_damage + p.utility.fire_damage)}</td>
              <td>{p.economy.avg_equip != null ? `$${p.economy.avg_equip}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DemoMatchPanel({ matchId }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const j = await fetchMatchDemo(matchId);
      setState(j);
      setError("");
      return j;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    setLoading(true);
    setState(null);
    load();
  }, [load]);

  useEffect(() => {
    if (!state || !ACTIVE.has(state.status)) return undefined;
    timer.current = setTimeout(load, POLL_MS);
    return () => clearTimeout(timer.current);
  }, [state, load]);

  const parse = async () => {
    setBusy(true);
    setError("");
    try {
      setState(await requestMatchParse(matchId));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="demo-card demo-muted">Checking demo stats…</div>;

  const done = state?.status === "done" && state.match;
  const canRequest = !state || state.status === "none" || (state.status === "failed" && state.attempts < 3);

  return (
    <div className="demo-card">
      <div className="demo-card-head">
        <div>
          <div className="demo-title">Demo stats</div>
          <div className="demo-sub">
            {done
              ? `${state.match.map || "Unknown map"} · ${state.match.rounds} rounds · parsed from the demo`
              : "Real rating, KAST, trades, utility and economy, parsed from the match demo."}
          </div>
        </div>
        {canRequest && (
          <button type="button" className="btn primary" onClick={parse} disabled={busy}>
            {busy ? "Requesting…" : state?.status === "failed" ? "Retry parse" : "Parse this demo"}
          </button>
        )}
      </div>
      {error && <div className="demo-status demo-status-error">{error}</div>}
      {state && <StatusLine state={state} />}
      {done && state.match.players.length > 0 && <PlayerTable match={state.match} />}
      {done && state.match.players.length === 0 && (
        <div className="demo-muted">The demo was parsed but no player rows are available.</div>
      )}
    </div>
  );
}
