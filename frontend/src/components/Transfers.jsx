import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

/** Friendly copy for the graceful-degradation reasons the backend returns. */
const REASONS = {
  no_api_key:
    "Transfers need a free Liquipedia API key. Set LIQUIPEDIA_API_KEY in the backend environment (request one at liquipedia.net/api).",
  bad_api_key: "The Liquipedia API key was rejected — check LIQUIPEDIA_API_KEY.",
  ratelimited: "Rate limited by Liquipedia (60 req/hour). Try again shortly.",
  network: "Couldn't reach Liquipedia. Check your connection.",
  ssl: "TLS error reaching Liquipedia (set STEAM_INSECURE=1 behind a proxy).",
};

const KIND = {
  join: { label: "Joined", cls: "tf-join", arrow: "→" },
  leave: { label: "Left", cls: "tf-leave", arrow: "←" },
  move: { label: "Moved", cls: "tf-move", arrow: "⇄" },
};

export default function Transfers({ onPick }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`${API_BASE}/api/transfers/?limit=40`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attribution = data?.attribution;

  return (
    <>
      <div className="section-title">Transfers</div>

      {loading && <div className="state">Loading transfers…</div>}
      {error && <div className="state error">{error}</div>}

      {!loading && data && !data.available && (
        <div className="state">{REASONS[data.reason] || "Transfers unavailable."}</div>
      )}

      {!loading && data?.available && data.items.length === 0 && (
        <div className="state">No recent transfers found.</div>
      )}

      {!loading && data?.available && data.items.length > 0 && (
        <div className="squad">
          {data.items.map((t, i) => {
            const k = KIND[t.kind] || KIND.move;
            return (
              <div className="squad-row" key={`${t.player}-${t.date}-${i}`}>
                <span className={`tf-badge ${k.cls}`}>{k.label}</span>
                <span
                  className="squad-name link"
                  onClick={() => onPick && onPick(t.player)}
                  title={`Search ${t.player}`}
                >
                  {t.player}
                </span>
                <span className="tf-teams">
                  <span className="tf-team">{t.from_team || "—"}</span>
                  <span className="tf-arrow">{k.arrow}</span>
                  <span className="tf-team">{t.to_team || "—"}</span>
                </span>
                {t.date && <span className="squad-elo">{t.date}</span>}
              </div>
            );
          })}
        </div>
      )}

      {attribution && (
        <div className="side-note" style={{ marginTop: "1rem" }}>
          <a href={attribution.url} target="_blank" rel="noopener noreferrer">
            {attribution.text}
          </a>
        </div>
      )}
    </>
  );
}
