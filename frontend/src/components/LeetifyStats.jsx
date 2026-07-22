import { useState, useEffect } from "react";
import leetifyBadge from "../assets/leetify-badge.jpg";
import PremierBadge from "./PremierBadge.jsx";
import RingGauge from "./RingGauge.jsx";
import { FaceitLevel, CompRank, groupName } from "./RankIcons.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

// Skill ratings are 0-100 (higher better). Colour by tier, don't rescale.
function ratingColor(v) {
  if (v >= 70) return "#22c55e";
  if (v >= 50) return "#84cc16";
  if (v >= 30) return "#eab308";
  return "#ef4444";
}

function fmt(value, unit) {
  if (value == null) return "—";
  if (unit === "ms") return Math.round(value).toLocaleString();
  const r = Math.round(value * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// Required by Leetify's developer guidelines.
// Rule 1/3.2: official "Data provided by Leetify" logo, unmodified (scaled only),
// linking to leetify.com. Rule 3.1: "View on Leetify" links back to the source.
function Attribution({ url }) {
  return (
    <div className="leet-attrib">
      <a href="https://leetify.com/" target="_blank" rel="noopener noreferrer" className="leet-credit">
        <img src={leetifyBadge} alt="Data provided by Leetify" className="leet-badge" />
      </a>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="leet-view">
          View on Leetify →
        </a>
      )}
    </div>
  );
}

function Ring({ label, value }) {
  const color = ratingColor(value);
  return (
    <div className="leet-ring" style={{ display: "grid", placeItems: "center", gap: 10 }}>
      <RingGauge value={value} max={100} size={116} stroke={10} color={color} sublabel="/100" />
      <div className="leet-ring-label">{label}</div>
    </div>
  );
}

/** Presentational Leetify block — reused by the FACEIT profile tab and the
    Steam-first profile page. `data` is the /leetify/ endpoint payload. */
export function LeetifyView({ data }) {
  if (!data) return null;

  if (!data.available) {
    return (
      <div className="leet-empty">
        <div className="real-empty-title">Not tracked on Leetify</div>
        <p>
          Leetify has no demo-based data for this player yet. These stats (aim,
          utility, preaim, reaction time, ranks) come from the{" "}
          <a href="https://leetify.com/" target="_blank" rel="noopener noreferrer">
            Leetify
          </a>{" "}
          public API for players it has parsed.
        </p>
        {data.profile_url && <Attribution url={data.profile_url} />}
      </div>
    );
  }

  const { ranks = {}, rating = {}, stats = [] } = data;
  const compMaps = (ranks.competitive || []).filter((m) => Number(m.rank) > 0);
  const hasRanks =
    ranks.premier != null || ranks.faceit != null ||
    ranks.wingman != null || ranks.leetify != null;

  return (
    <>
      {hasRanks && (
        <>
          <div className="section-title">Ranks</div>
          <div className="leet-ranks">
            {ranks.premier != null && (
              <div className="leet-rank">
                <div className="leet-rank-val"><PremierBadge rating={ranks.premier} /></div>
                <div className="leet-rank-label">Premier</div>
              </div>
            )}
            {ranks.faceit != null && (
              <div className="leet-rank">
                <div className="leet-rank-val faceit">
                  <FaceitLevel level={ranks.faceit} size={34} />
                  {ranks.faceit_elo != null && <span className="leet-elo">{ranks.faceit_elo} ELO</span>}
                </div>
                <div className="leet-rank-label">FACEIT</div>
              </div>
            )}
            {ranks.wingman != null && Number(ranks.wingman) > 0 && (
              <div className="leet-rank">
                <div className="leet-rank-val"><CompRank rank={ranks.wingman} height={30} /></div>
                <div className="leet-rank-label">Wingman</div>
              </div>
            )}
            {ranks.leetify != null && (
              <div className="leet-rank">
                <div className="leet-rank-val">{ranks.leetify}</div>
                <div className="leet-rank-label">Leetify Rating</div>
              </div>
            )}
          </div>
        </>
      )}

      {compMaps.length > 0 && (
        <>
          <div className="section-title">Competitive per map</div>
          <div className="leet-comp-grid">
            {compMaps.map((m) => (
              <div className="leet-comp-tile" key={m.map_name} title={groupName(m.rank)}>
                <CompRank rank={m.rank} height={26} />
                <div className="leet-comp-map">{(m.map_name || "").replace(/^(de|cs)_/, "")}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {(rating.aim != null || rating.positioning != null || rating.utility != null) && (
        <>
          <div className="section-title">Leetify Skill Rating</div>
          <div className="leet-rings">
            {rating.aim != null && <Ring label="Aim" value={rating.aim} />}
            {rating.positioning != null && <Ring label="Positioning" value={rating.positioning} />}
            {rating.utility != null && <Ring label="Utility" value={rating.utility} />}
          </div>
        </>
      )}

      {stats.length > 0 && (
        <>
          <div className="section-title">Detailed stats</div>
          <div className="real-grid">
            {stats.map((s) => (
              <div className="real-stat" key={s.key}>
                <div className="real-stat-val">
                  {fmt(s.value, s.unit)}
                  {s.unit && <span className="leet-unit">{s.unit}</span>}
                </div>
                <div className="real-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <Attribution url={data.profile_url} />
    </>
  );
}

/** Default: fetches by FACEIT nickname (profile tab). */
export default function LeetifyStats({ nickname }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setData(null);
    fetch(`${API_BASE}/api/player/${encodeURIComponent(nickname)}/leetify/`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.error) setError(j.error);
        else setData(j);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [nickname]);

  if (loading) return <div className="state">Loading Leetify stats…</div>;
  if (error) return <div className="state error">{error}</div>;
  return <LeetifyView data={data} />;
}
