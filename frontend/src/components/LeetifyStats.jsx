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

/** A signed, rounded rating: "+3.80", "-1.20", "0.00".
 *
 * Exists because a raw float went to screen once and rendered
 * "4.130000000000001". Anything that has been through arithmetic has to be
 * formatted before it is displayed — binary floating point simply cannot hold
 * most decimal values exactly, and toFixed is what hides that.
 */
function signed(v, places = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return (n > 0 ? "+" : "") + n.toFixed(places);
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
          {/* One row per platform, with CURRENT and BEST side by side.
              A row of separate cards showed only where a player is now; the
              pair shows where they've been, which is the more interesting half
              — 13,354 reads very differently under a peak of 15,100.

              A `<table>` because it is one: platforms down, two measures
              across. It's laid out with grid so the columns can size to
              content, but the markup stays a table so a screen reader still
              gets row and column headers. */}
          <div className="section-title">Ranks</div>
          <table className="leet-ranks">
            <thead>
              <tr>
                <th scope="col">Platform</th>
                <th scope="col">Current</th>
                <th scope="col">Best</th>
              </tr>
            </thead>
            <tbody>
              {ranks.premier != null && (
                <tr>
                  <th scope="row">Premier</th>
                  <td><div className="rankcell"><PremierBadge rating={ranks.premier} /></div></td>
                  <td>
                    <div className="rankcell">
                      {ranks.premier_best != null
                        ? <PremierBadge rating={ranks.premier_best} />
                        : <span className="leet-none">—</span>}
                    </div>
                  </td>
                </tr>
              )}
              {ranks.faceit != null && (
                <tr>
                  <th scope="row">FACEIT</th>
                  <td>
                    <div className="rankcell">
                      <FaceitLevel level={ranks.faceit} size={30} />
                      {ranks.faceit_elo != null && <span className="leet-elo">{ranks.faceit_elo} ELO</span>}
                    </div>
                  </td>
                  <td>
                    <div className="rankcell">
                      {ranks.faceit_best != null
                        ? <FaceitLevel level={ranks.faceit_best} size={30} />
                        : <span className="leet-none">—</span>}
                    </div>
                  </td>
                </tr>
              )}
              {/* Shown when EITHER figure exists.
                  Gating on the current rank alone hid the whole row for anyone
                  who has played Wingman but has no live rank right now —
                  which is most people, since Wingman ranks decay. They still
                  have a peak, and that peak is the more interesting half. */}
              {(Number(ranks.wingman) > 0 || Number(ranks.wingman_best) > 0) && (
                <tr>
                  <th scope="row">Wingman</th>
                  <td>
                    <div className="rankcell">
                      {Number(ranks.wingman) > 0
                        ? <CompRank rank={ranks.wingman} height={28} />
                        : <span className="leet-none">Unranked</span>}
                    </div>
                  </td>
                  <td>
                    <div className="rankcell">
                      {Number(ranks.wingman_best) > 0
                        ? <CompRank rank={ranks.wingman_best} height={28} />
                        : <span className="leet-none">—</span>}
                    </div>
                  </td>
                </tr>
              )}
              {ranks.leetify != null && (
                <tr>
                  <th scope="row">Leetify rating</th>
                  {/* Rounded, and signed.
                      Printed raw this rendered "4.130000000000001" — the number
                      arrives as a float that has been through arithmetic, and
                      binary floating point cannot hold 4.13 exactly.
                      The sign stays because this is a delta against the
                      average: -1.2 and +1.2 are opposite verdicts. */}
                  <td><div className="rankcell num">{signed(ranks.leetify)}</div></td>
                  <td><div className="rankcell"><span className="leet-none">—</span></div></td>
                </tr>
              )}
              {ranks.renown != null && (
                <tr>
                  <th scope="row">Renown</th>
                  <td><div className="rankcell num">{Number(ranks.renown).toLocaleString()}</div></td>
                  <td><div className="rankcell"><span className="leet-none">—</span></div></td>
                </tr>
              )}
            </tbody>
          </table>
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
                         (r != null ? ` · rating ${signed(r)}` : "")}
                >
                  <div className="leet-form-map">{(m.map_name || "").replace(/^(de|cs)_/, "").slice(0, 4)}</div>
                  {r != null && (
                    /* Same formatter as the headline figure. The old
                       Math.round(r * 100) / 100 dodged the float artefact but
                       dropped trailing zeros, so a column of ratings read
                       "+4.1 / +3.85 / +2" — three different widths for the
                       same kind of number. */
                    <div className="leet-form-rating" style={{ color: good ? "#22c55e" : "#ef4444" }}>
                      {signed(r)}
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
