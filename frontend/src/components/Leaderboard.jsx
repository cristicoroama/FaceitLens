import { useState, useEffect } from "react";
import SkillBadge from "./SkillBadge.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

const REGIONS = ["EU", "NA", "SA", "OCE"];

export default function Leaderboard({ onPick }) {
  const [region, setRegion] = useState("EU");
  const [country, setCountry] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ region });
      if (country.trim()) qs.set("country", country.trim().toLowerCase());
      const resp = await fetch(`${API_BASE}/api/leaderboard/?${qs}`);
      const json = await resp.json();
      setItems(json.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="lb-controls">
        <select value={region} onChange={(e) => setRegion(e.target.value)}>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Country code (e.g. ro)"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <button onClick={load} disabled={loading}>
          {loading ? "..." : "Load"}
        </button>
      </div>
      <div className="squad">
        {items.map((p) => (
          <div className="squad-row" key={p.player_id || p.nickname}>
            <span className="squad-rank">#{p.position}</span>
            <span className="squad-name link" onClick={() => onPick(p.nickname)}>
              {p.nickname}
            </span>
            <SkillBadge level={p.level} />
            <span className="squad-elo">{p.elo ?? "—"}</span>
          </div>
        ))}
        {!loading && items.length === 0 && (
          <div className="state">No data for this region/country.</div>
        )}
      </div>
    </>
  );
}
