import { useState } from "react";

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
      <div className="section-title">Have We Met?</div>
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
            {result.p1} and {result.p2} have never crossed paths in recent matches.
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
    </>
  );
}
