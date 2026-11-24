import { useState } from "react";
import { MapIcon, mapLabel } from "../map-art.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function HaveWeMet({ player }) {
  const [other, setOther] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function check() {
    const o = other.trim();
    if (!o) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const resp = await fetch(
        `${API_BASE}/api/met/?p1=${encodeURIComponent(player)}&p2=${encodeURIComponent(o)}`
      );
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
      setResult(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="panel-head" style={{ marginBottom: 12 }}>
        <div className="panel-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M17 8h5M19.5 5.5v5" />
          </svg>
        </div>
        <div className="panel-title">Have We Met?</div>
        <div className="panel-sub">check shared match history</div>
      </div>
      <div className="search">
        <input
          type="text"
          placeholder={`Another player to check against ${player}`}
          value={other}
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && check()}
        />
        <button onClick={check} disabled={loading}>{loading ? "..." : "Check"}</button>
      </div>
      {error && <div className="state error">{error}</div>}
      {result && (
        result.encounters === 0 ? (
          <div className="state">
            {result.p1} and {result.p2} have never crossed paths in their last {Math.min(...(result.checked || [100]))} matches.
          </div>
        ) : (
          <div className="squad-summary">
            <div className="squad-summary-item">
              <div className="squad-summary-num">{result.encounters}</div>
              <div className="squad-summary-label">Encounters</div>
            </div>
            <div className="squad-summary-item">
              <div className="squad-summary-num" style={{ color: "var(--win)" }}>{result.together}</div>
              <div className="squad-summary-label">Together</div>
            </div>
            <div className="squad-summary-item">
              <div className="squad-summary-num" style={{ color: "var(--loss)" }}>{result.against}</div>
              <div className="squad-summary-label">Against</div>
            </div>
          </div>
        )
      )}
      {result?.matches?.length > 0 && (
        <div className="hwm">
          <div className="hwm-sum">
            {result.together > 0 && <span>Together: <b className="pos">{result.together_wins}W</b> <b className="neg">{result.together - result.together_wins}L</b></span>}
            {result.against > 0 && <span>Head to head: <b>{result.p1}</b> {result.p1_wins_against} – {result.against - result.p1_wins_against} <b>{result.p2}</b></span>}
            <span className="hwm-dim">checked the last {result.checked?.[0]} and {result.checked?.[1]} matches</span>
          </div>
          <div className="hwm-list">
            {result.matches.map((m) => (
              <a key={m.match_id} className="hwm-row" href={`https://www.faceit.com/en/cs2/room/${m.match_id}`} target="_blank" rel="noopener noreferrer">
                <span className={`hwm-tag ${m.together ? "t" : "a"}`}>{m.together ? "With" : "Vs"}</span>
                <span className="hwm-map"><MapIcon map={m.map} size={16} />{mapLabel(m.map)}</span>
                <span className="hwm-score">{m.score || ""}</span>
                <span className={m.p1_won ? "pos" : "neg"}>{m.p1_won ? "W" : "L"}</span>
                <span className="hwm-kd">{result.p1} {m.p1 || "—"}</span>
                <span className="hwm-kd">{result.p2} {m.p2 || "—"}</span>
                <span className="hwm-dim">{m.finished_at ? new Date(m.finished_at * 1000).toLocaleDateString() : ""}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
