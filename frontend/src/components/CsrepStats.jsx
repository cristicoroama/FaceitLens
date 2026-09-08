import { useState, useEffect } from "react";
import csrepLogo from "../assets/csrep-logo.webp";
import RingGauge from "./RingGauge.jsx";
import PremierBadge from "./PremierBadge.jsx";
import { CompRank, FaceitLevel, groupName } from "./RankIcons.jsx";
import { MapIcon, mapLabel } from "../map-art.jsx";
import Medals from "./Medals.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

/** Platform names, cased the way the platforms case themselves.
 *
 * This is not a metric rename — CSRep's terms forbid those — it is spelling a
 * proper noun correctly. Anything not listed falls through to `humanise`. */
const BRAND = {
  faceit: "FACEIT",
  gamersclub: "Gamers Club",
  cybershoke: "Cybershoke",
  premier: "Premier",
  wingman: "Wingman",
  competitive: "Competitive",
  leetify: "Leetify",
};

/** Steam's own persona-state and profile-visibility enums.
 *
 * Decoding these is not reinterpreting a CSRep signal — they are Valve's
 * integers, and 1 means "Online" everywhere Steam is documented. */
const STEAM_STATUS = [
  "Offline", "Online", "Busy", "Away", "Snooze",
  "Looking to Trade", "Looking to Play",
];
const STEAM_PRIVACY = { 1: "Private", 2: "Friends Only", 3: "Public" };

function humanise(key) {
  const raw = String(key);
  if (BRAND[raw]) return BRAND[raw];
  const words = raw.replace(/[_-]+/g, " ").split(" ").filter(Boolean);

  // Ban types arrive SHOUTING ("BAN_EVASION"), field names arrive snake
  // ("trust_score"). Title-casing without first lowering leaves the former as
  // "BAN EVASION", so words get lowered before capitalising. The exception is
  // a key that is ONE short all-caps token — "VAC", "AFK" — an acronym that
  // "Vac" and "Afk" would quietly destroy. Scoping the exception to
  // single-word keys matters: per word it would render "BAN Evasion".
  if (words.length === 1 && words[0].length <= 3 && words[0] === words[0].toUpperCase()) {
    return words[0];
  }
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Rank keys are namespaced: "premier:season4", "competitive:de_dust2".
 *
 * Only the namespace is humanised — a map name is not prose, and title-casing
 * "de_dust2" into "De Dust2" would be a downgrade, not a translation. */
function rankLabel(key) {
  const [group, ...rest] = String(key).split(":");
  const detail = rest.join(":");
  return detail ? `${humanise(group)} · ${detail}` : humanise(group);
}

/** Format a number for display without rescaling it.
 *
 * CSRep returns both 0-100 scores and 0-1 ratios, the latter at full float
 * precision (0.986327706222794). Rounding for display is formatting, NOT the
 * rescaling §4 prohibits — the untouched value stays in the title attribute.
 * LeetifyStats carries the same note for the same reason. */
function fmtNum(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (Number.isInteger(n)) return n.toLocaleString();
  return String(Math.round(n * 1000) / 1000);
}

function fmtDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
}

function scalar(v) {
  if (v == null) return null;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return fmtNum(v);
  if (typeof v === "string") return v;
  return null;
}

/** §8 attribution: the CSRep logo, visible wherever their data is shown,
 *  linking to that player's csrep.gg profile. §4: the probabilistic
 *  disclaimer travels with it and must not be removed.
 *
 *  Both come from the backend (`data.attribution`), so the compliance surface
 *  has a single owner rather than being retyped in the markup. */
/** A one-line CSRep credit, for pages that borrow a slice of their data
 *  rather than rendering the whole tab — the medal grid on a profile whose
 *  Steam inventory is private, for instance. §8 applies to any surface their
 *  data reaches, not only to this component. */
export function CsrepCredit({ attribution, note }) {
  if (!attribution) return null;
  return (
    <div className="csrep-credit-line">
      <a href={attribution.href} target="_blank" rel="noopener noreferrer">
        <img src={csrepLogo} alt="Data provided by CSRep" />
      </a>
      <span>{note || attribution.disclaimer}</span>
    </div>
  );
}

function Attribution({ attribution }) {
  if (!attribution) return null;
  return (
    <div className="csrep-attrib">
      <a href={attribution.href} target="_blank" rel="noopener noreferrer"
         className="csrep-credit">
        <img src={csrepLogo} alt="Data provided by CSRep" className="csrep-badge" />
      </a>
      <p className="csrep-disclaimer">{attribution.disclaimer}</p>
    </div>
  );
}

/** A label/value line. The workhorse of this tab.
 *
 * Everything that is not the headline reads as a row, not a card. Twenty
 * equally-sized boxes give twenty facts the same importance, which is how a
 * profile turns into a database dump. */
function Row({ label, value, detail, title }) {
  if (value == null || value === "") return null;
  return (
    <div className="csrep-row" title={title}>
      <span className="csrep-row-label">{label}</span>
      {detail && <span className="csrep-row-detail">{detail}</span>}
      <span className="csrep-row-val">{value}</span>
    </div>
  );
}

function Group({ title, children }) {
  const kids = Array.isArray(children) ? children.filter(Boolean) : children;
  if (!kids || (Array.isArray(kids) && !kids.some(Boolean))) return null;
  return (
    <div className="csrep-group">
      <div className="csrep-group-head">{title}</div>
      {kids}
    </div>
  );
}

/** One breakdown component, as a proportional bar plus its literal value.
 *
 * The bar is a graphical encoding of the number, not a replacement for it —
 * the exact figure stays printed alongside and the raw float sits in the
 * tooltip, so nothing about the signal is restated or rounded away. */
function Meter({ label, value }) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const pct = Math.max(0, Math.min(1, num)) * 100;
  return (
    <div className="csrep-meter" title={String(value)}>
      <div className="csrep-meter-top">
        <span className="csrep-meter-label">{label}</span>
        <span className="csrep-meter-val">{fmtNum(num)}</span>
      </div>
      <div className="csrep-meter-track">
        <div className="csrep-meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** The reputation block: one gauge, everything else subordinate to it.
 *
 * Deliberately NOT colour-coded by threshold, unlike this project's own
 * TrustScore card. Painting 100 green would layer our verdict onto a
 * probabilistic assessment — precisely what §4 forbids — so the ring takes
 * the neutral accent and the disclaimer does the interpreting. */
function Reputation({ reputation }) {
  if (!reputation || typeof reputation !== "object") return null;
  const { trust_score: score, breakdown, ...rest } = reputation;

  const meters = [
    ...Object.entries(breakdown || {}),
    ...Object.entries(rest),
  ].filter(([, v]) => typeof v === "number");

  if (score == null && !meters.length) return null;

  return (
    <div className="csrep-hero">
      {score != null && (
        <div className="csrep-hero-gauge">
          <RingGauge
            value={score}
            max={100}
            size={132}
            stroke={11}
            color="var(--accent)"
            display={fmtNum(score)}
            sublabel="trust score"
            valueSize={34}
          />
        </div>
      )}
      {!!meters.length && (
        <div className="csrep-hero-meters">
          {meters.map(([k, v]) => (
            <Meter key={k} label={humanise(k)} value={v} />
          ))}
        </div>
      )}
    </div>
  );
}

/** One rank value, drawn the way the game draws it.
 *
 * The project already ships the artwork for every ladder here — the Premier
 * plate, Valve's own skill-group images, the map icons — so a rank has no
 * business rendering as a bare integer. "17" says nothing; the Legendary
 * Eagle badge is readable at a glance.
 *
 * `dim` is the peak column, drawn smaller so current stays the headline. */
function RankArt({ ladder, value, level, dim = false }) {
  if (value == null) return <span className="csrep-rank-none">—</span>;

  if (ladder === "premier") {
    return <PremierBadge rating={value} height={dim ? 22 : 30} />;
  }
  // Wingman and per-map competitive share Valve's 0-18 skill-group scale.
  if (ladder === "wingman" || ladder === "competitive") {
    return <CompRank rank={value} height={dim ? 22 : 28} />;
  }
  // FACEIT arrives from CSRep as ELO, never as the 1-10 level the icon needs,
  // so the backend derives the level from FACEIT's published ladder. The ELO
  // stays printed beside the ring: the ring is our reading of their number,
  // and their number is the one that must survive unchanged.
  return (
    <span
      className="csrep-rank-faceit"
      // FaceitLevel takes only `level` and `size`, so the explanation lives on
      // the wrapper — the ring is a derivation and should say so on hover.
      title={
        level != null
          ? `Level ${level}, derived from ${Number(value).toLocaleString()} ELO`
          : undefined
      }
    >
      {level != null && <FaceitLevel level={level} size={dim ? 22 : 30} />}
      <span className={`csrep-rank-num${dim ? " dim" : ""}`}>
        {Number(value).toLocaleString()}
      </span>
    </span>
  );
}

/** Ranks per ladder, as {current, peak}.
 *
 * The per-map competitive ranks get their own grid rather than more rows:
 * there can be a dozen of them, and in one list they bury FACEIT and Premier
 * under a wall of maps. */
function Ranks({ entries, faceitLevel }) {
  if (!entries.length) return null;

  const maps = entries.filter(([k]) => k.startsWith("competitive:"));
  const ladders = entries.filter(([k]) => !k.startsWith("competitive:"));

  return (
    <div className="csrep-ranks">
      <div className="csrep-group-head">Ranks</div>

      {!!ladders.length && (
        <div className="csrep-ladders">
          {ladders.map(([k, r]) => {
            const ladder = k.split(":")[0];
            return (
              <div className="csrep-ladder" key={k}>
                <span className="csrep-ladder-name">{rankLabel(k)}</span>
                <span className="csrep-ladder-cur">
                  <RankArt ladder={ladder} value={r.current}
                           level={faceitLevel?.current} />
                </span>
                <span className="csrep-ladder-peak">
                  {r.peak != null && (
                    <>
                      <em>peak</em>
                      <RankArt ladder={ladder} value={r.peak}
                               level={faceitLevel?.peak} dim />
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!!maps.length && (
        <>
          <div className="csrep-sub-head">Competitive per map</div>
          <div className="csrep-maps">
            {maps.map(([k, r]) => {
              const map = k.split(":")[1] || "";
              const rank = r.current ?? r.peak;
              return (
                <div className="csrep-map" key={k} title={groupName(rank)}>
                  <CompRank rank={rank} height={26} />
                  <div className="csrep-map-name">
                    <MapIcon map={map} size={14} />
                    {mapLabel(map) || map.replace(/^(de|cs)_/, "")}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** Ban history — the part of this tab worth interrupting for, so it keeps
 *  card weight while everything else is demoted to rows. */
function Bans({ bans }) {
  if (!bans || !bans.length) return null;
  return (
    <div className="csrep-bans">
      <div className="csrep-group-head">Ban history</div>
      <ul className="csrep-ban-list">
        {bans.map((b) => (
          <li className="csrep-ban" key={b.id}>
            <span className={`csrep-ban-type csrep-src-${String(b.source).toLowerCase()}`}>
              {humanise(b.type)}
            </span>
            <span className="csrep-ban-src">{b.source}</span>
            {b.reason && <span className="csrep-ban-reason">{b.reason}</span>}
            <span className="csrep-ban-date">
              {fmtDate(b.starts_at || b.created_at) || "—"}
              {/* An end date means the ban expires; without one it stands. */}
              {b.ends_at && <> → {fmtDate(b.ends_at)}</>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Outbound links as chips, matching the profile sidebar's social buttons.
 *  The platform id lives in the tooltip: it identifies the account for anyone
 *  debugging, and means nothing to a visitor reading the page. */
function Platforms({ data }) {
  const links = [
    ["FACEIT", data.faceit_url, data.faceit_id, "faceit"],
    ["Gamers Club", data.gamersclub_url, data.gamersclub_id, "gamersclub"],
    ["Steam", data.steam_vanity_url, data.id, "steam"],
  ].filter(([, url]) => url);
  if (!links.length) return null;

  return (
    <div className="csrep-chips">
      {links.map(([name, url, id, key]) => (
        <a key={name} href={url} target="_blank" rel="noopener noreferrer"
           className={`csrep-chip csrep-chip-${key}`} title={id || undefined}>
          {name}
        </a>
      ))}
    </div>
  );
}

export function CsrepView({ data }) {
  if (!data) return null;

  if (data.available === false) {
    const copy =
      {
        not_configured: "CSRep is not configured on this deployment.",
        not_found: "This account has no CSRep profile yet.",
        quota_exhausted: "The monthly CSRep request allowance has been used up.",
        ratelimited: "CSRep is rate-limiting requests right now. Try again shortly.",
        unauthorized: "The CSRep API key was rejected.",
      }[data.reason] || "CSRep data is unavailable right now.";
    return (
      <div className="csrep-empty">
        <div className="csrep-empty-title">No CSRep data</div>
        <p>{copy}</p>
        <Attribution attribution={data.attribution} />
      </div>
    );
  }

  // §4: a restricted / privacy-mode profile must not be presented as an
  // ordinary public profile. The backend already withheld the identifying
  // fields; this is the matching UI state.
  if (data.restricted) {
    return (
      <div className="csrep-empty">
        <div className="csrep-empty-title">Profile restricted</div>
        <p>
          This player&apos;s CSRep profile is in a restricted or privacy-protected
          state, so their reputation data is not shown here.
        </p>
        <Attribution attribution={data.attribution} />
      </div>
    );
  }

  const ranks = Object.entries(data.ranks || {})
    .filter(([, r]) => r && (r.current != null || r.peak != null))
    .sort((a, b) => {
      const tail = (k) => (k.startsWith("competitive:") ? 1 : 0);
      return tail(a[0]) - tail(b[0]) || a[0].localeCompare(b[0]);
    });

  const commendations = Object.entries(data.commendations || {})
    .filter(([, v]) => typeof v === "number");

  const steamStatus =
    data.steam_status == null
      ? null
      : STEAM_STATUS[data.steam_status] || `Status ${data.steam_status}`;

  return (
    <div className="csrep-block">
      <div className="csrep-head">
        <div className="csrep-ident">
          {data.avatar && (
            <img src={data.avatar} alt="" className="csrep-avatar" loading="lazy" />
          )}
          <div>
            <h3 className="csrep-title">{data.name || "CSRep reputation"}</h3>
            <div className="csrep-sub">
              {data.views != null && <>{data.views.toLocaleString()} views</>}
              {data.refreshed_at && <> · refreshed {fmtDate(data.refreshed_at)}</>}
            </div>
          </div>
        </div>
        {data.autoflag && (
          <div className="csrep-autoflag" title={data.attribution?.disclaimer}>
            Auto-flagged
          </div>
        )}
      </div>

      <Reputation reputation={data.reputation} />
      <Bans bans={data.bans} />
      <Ranks entries={ranks} faceitLevel={data.faceit_level} />

      <div className="csrep-cols">

        <Group title="Commendations">
          {commendations.map(([k, v]) => (
            <Row key={k} label={humanise(k)} value={v.toLocaleString()} />
          ))}
        </Group>

        <Group title="Account">
          <Row label="Steam Level" value={scalar(data.steam_level)} />
          <Row label="CS2 Hours" value={scalar(data.cs2_hours)} />
          <Row label="Inventory Value" value={scalar(data.inventory_value)} />
          <Row label="Created" value={fmtDate(data.steam_created_at)} />
          <Row label="Visibility" value={STEAM_PRIVACY[data.steam_privacy]} />
          <Row label="Status" value={steamStatus} detail={data.steam_active_game} />
          {/* Only the count here — the medals themselves get their own grid
              below, with Valve's artwork instead of definition indexes. */}
          <Row label="Medals" value={data.medals?.length || null} />
          <Row label="Last FACEIT Match" value={fmtDate(data.faceit_latest_match_date)} />
          <Row label="Cybershoke Since" value={fmtDate(data.cybershoke_registered_at)} />
        </Group>

        {data.user && (
          <Group title="CSRep account">
            {data.user.redacted ? (
              <Row label="Account" value="Restricted" />
            ) : (
              <>
                <Row label="Handle" value={data.user.handle} />
                <Row label="Roles"
                     value={(data.user.roles || []).map(humanise).join(", ") || null} />
                <Row label="Member Since" value={fmtDate(data.user.created_at)} />
              </>
            )}
          </Group>
        )}

        {/* Anything CSRep returns that this component has no home for. Their
            live API already ships fields their spec does not document, so
            these surface here instead of vanishing. */}
        {!!Object.keys(data.extra || {}).length && (
          <Group title="Other">
            {Object.entries(data.extra).map(([k, v]) => (
              <Row key={k} label={humanise(k)} value={scalar(v)} />
            ))}
          </Group>
        )}
      </div>

      {/* CSRep sends medals as bare definition indexes; the backend resolves
          them to Valve's names and artwork. Same component the Steam-first
          profile uses, so a medal looks the same wherever it appears. */}
      {!!data.medals_detail?.length && <Medals medals={data.medals_detail} />}

      <Platforms data={data} />

      {/* Record-keeping: real data, but nobody came to the page for it, so it
          reads as one dim line rather than three headline cards. */}
      <div className="csrep-meta">
        {fmtDate(data.created_at) && <span>First seen {fmtDate(data.created_at)}</span>}
        {fmtDate(data.updated_at) && <span>Updated {fmtDate(data.updated_at)}</span>}
        {data.id && <span className="csrep-meta-id">{data.id}</span>}
      </div>

      <Attribution attribution={data.attribution} />
    </div>
  );
}

/** Self-fetching wrapper for the FACEIT profile tab. */
export default function CsrepStats({ nickname }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!nickname) return;
    let cancelled = false;
    setLoading(true);

    fetch(`${API_BASE}/api/player/${encodeURIComponent(nickname)}/csrep/`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData({ available: false, reason: "network" }); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [nickname]);

  if (loading) return <div className="csrep-empty">Loading CSRep data…</div>;
  return <CsrepView data={data} />;
}
