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

  const {
    ranks = {}, rating = {}, stats = [], ratings = [], bans = [],
    stat_groups: groups = [], recent_matches: recent = [],
    recent_teammates: teammates = [],
  } = data;
  const compMaps = (ranks.competitive || []).filter((m) => Number(m.rank) > 0);
  const hasRanks =
    ranks.premier != null || ranks.faceit != null || ranks.wingman != null ||
    ranks.leetify != null || ranks.renown != null;

  // The three 0-100 skill ratings already have their own rings above; these
  // four are impact numbers on a different scale, so they get their own row.
  const IMPACT = new Set(["clutch", "opening", "ct_leetify", "t_leetify"]);
  const impact = ratings.filter((r) => IMPACT.has(r.key) && r.value != null);

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
            {ranks.renown != null && (
              <div className="leet-rank">
                <div className="leet-rank-val">{Number(ranks.renown).toLocaleString()}</div>
                <div className="leet-rank-label">Renown</div>
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

      {impact.length > 0 && (
        <>
          <div className="section-title">Impact</div>
          <div className="leet-impact">
            {impact.map((r) => (
              <div className="leet-impact-cell" key={r.key}>
                <div
                  className="leet-impact-val"
                  style={{ color: r.value > 0 ? "#22c55e" : r.value < 0 ? "#ef4444" : "var(--text-dim)" }}
                >
                  {r.value > 0 ? "+" : ""}{Math.round(r.value * 1000) / 1000}
                </div>
                <div className="real-stat-label">{r.label}</div>
              </div>
            ))}
          </div>
          <p className="leet-note">Impact figures are centred on zero: above is better than average, below is worse.</p>
        </>
      )}

      {bans.length > 0 && (
        <>
          <div className="section-title">Ban history</div>
          <div className="leet-bans">
            {bans.map((b, i) => (
              <div className="leet-ban" key={i}>
                <span className="leet-ban-platform">{b.platform}</span>
                {b.nickname && <span className="leet-ban-nick">as {b.nickname}</span>}
                {b.banned_since && (
                  <span className="leet-ban-date">
                    {new Date(b.banned_since).toLocaleDateString("en-GB",
                      { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {stats.length > 0 && groups.map((g) => {
        const rows = stats.filter((x) => x.group === g.key);
        if (!rows.length) return null;
        return (
          <div key={g.key}>
            <div className="section-title">{g.label}</div>
            <div className="real-grid">
              {rows.map((x) => (
                <div className="real-stat" key={x.key}>
                  <div className="real-stat-val">
                    {fmt(x.value, x.unit)}
                    {x.unit && <span className="leet-unit">{x.unit}</span>}
                  </div>
                  <div className="real-stat-label">{x.label}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {recent.length > 1 && (
        <>
          <div className="section-title">Recent form</div>
          <div className="leet-form">
            {recent.slice().reverse().map((m) => {
              const r = m.leetify_rating;
              const good = r != null && r >= 0;
              return (
                <div
                  className={`leet-form-cell ${m.outcome === "win" ? "win" : m.outcome === "loss" ? "loss" : ""}`}
                  key={m.id}
                  title={`${(m.map_name || "").replace(/^(de|cs)_/, "")} · ${(m.score || []).join("-")}` +
                         (r != null ? ` · rating ${Math.round(r * 1000) / 1000}` : "")}
                >
                  <div className="leet-form-map">{(m.map_name || "").replace(/^(de|cs)_/, "").slice(0, 4)}</div>
                  {r != null && (
                    <div className="leet-form-rating" style={{ color: good ? "#22c55e" : "#ef4444" }}>
                      {good ? "+" : ""}{Math.round(r * 100) / 100}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {teammates.length > 0 && (
        <>
          <div className="section-title">Plays most with</div>
          <div className="leet-mates">
            {teammates.map((t) => (
              <a
                className="leet-mate"
                key={t.steam64_id}
                href={`https://leetify.com/app/profile/${t.steam64_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="leet-mate-id">{t.steam64_id.slice(-8)}</span>
                <span className="leet-mate-n">{t.matches} matches</span>
              </a>
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
