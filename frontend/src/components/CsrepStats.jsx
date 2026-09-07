import { useState, useEffect } from "react";
import csrepLogo from "../assets/csrep-logo.webp";

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
 * integers, and 1 means "Online" everywhere Steam is documented. Unknown
 * values fall back to the raw number rather than being hidden. */
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
  // "BAN EVASION", so words get lowered before capitalising.
  //
  // The exception is a key that is ONE short all-caps token — "VAC", "AFK" —
  // which is an acronym that "Vac" and "Afk" would quietly destroy. Scoping
  // the exception to single-word keys matters: applied per word it would
  // catch the "BAN" in "BAN_EVASION" and render "BAN Evasion".
  if (words.length === 1 && words[0].length <= 3 && words[0] === words[0].toUpperCase()) {
    return words[0];
  }
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Rank keys are namespaced: "premier:season4", "competitive:de_dust2".
 *
 * Only the namespace is humanised. The detail half is left verbatim, because
 * a map name is not prose — "de_dust2" is what a CS player reads, and
 * title-casing it into "De Dust2" would be a downgrade, not a translation. */
function rankLabel(key) {
  const [group, ...rest] = String(key).split(":");
  const detail = rest.join(":");
  return detail ? `${humanise(group)} · ${detail}` : humanise(group);
}

/** Format a number for display without rescaling it.
 *
 * CSRep returns both 0-100 scores and 0-1 ratios; the ratios arrive at full
 * float precision (0.986327706222794). Rounding for display is formatting,
 * NOT the rescaling §4 prohibits — the untouched value stays available in the
 * cell's title attribute. Anything that has been through binary floating
 * point has to be formatted before it reaches a screen; LeetifyStats carries
 * the same note for the same reason. */
function fmtNum(n) {
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
 *  Both the link target and the disclaimer text come from the backend
 *  (`data.attribution`) rather than being hardcoded here, so the compliance
 *  surface has a single owner. */
function Attribution({ attribution }) {
  if (!attribution) return null;
  return (
    <div className="csrep-attrib">
      <a
        href={attribution.href}
        target="_blank"
        rel="noopener noreferrer"
        className="csrep-credit"
      >
        <img src={csrepLogo} alt="Data provided by CSRep" className="csrep-badge" />
      </a>
      <p className="csrep-disclaimer">{attribution.disclaimer}</p>
    </div>
  );
}

function Cell({ label, value, title }) {
  return (
    <div className="csrep-cell" title={title}>
      <div className="csrep-cell-value">{value}</div>
      <div className="csrep-cell-label">{label}</div>
    </div>
  );
}

/** A grid of [label, value] pairs. Entries whose value is null are dropped —
 *  the API returns null for anything it has no data on, and a wall of "—"
 *  cells communicates nothing. Renders nothing at all if none survive. */
function Section({ title, rows }) {
  const kept = rows.filter(([, v]) => v != null && v !== "");
  if (!kept.length) return null;
  return (
    <>
      {title && <h4 className="csrep-h4">{title}</h4>}
      <div className="csrep-grid">
        {kept.map(([label, value, hint]) => (
          <Cell key={label} label={label} value={value} title={hint} />
        ))}
      </div>
    </>
  );
}

/** Reputation, rendered verbatim.
 *
 * `trust_score` leads because it is the headline signal; the remaining
 * top-level fields and the nested `breakdown` components follow. Deliberately
 * NOT colour-coded by threshold: assigning "100 = green = trustworthy" would
 * be layering our own verdict onto a probabilistic assessment, which is
 * exactly what §4 forbids. The numbers speak for themselves. */
function Reputation({ reputation }) {
  if (!reputation || typeof reputation !== "object") return null;
  const { trust_score: trustScore, breakdown, ...rest } = reputation;

  const pairs = (obj) =>
    Object.entries(obj || {})
      .map(([k, v]) => [humanise(k), scalar(v), String(v)])
      .filter(([, v]) => v !== null);

  return (
    <>
      {trustScore != null && (
        <div className="csrep-hero">
          <div className="csrep-hero-value">{scalar(trustScore)}</div>
          <div className="csrep-hero-label">Trust Score</div>
        </div>
      )}
      <Section rows={pairs(rest)} />
      <Section title="Breakdown" rows={pairs(breakdown)} />
    </>
  );
}

/** Ranks per ladder, as {current, peak}.
 *
 * CSRep returns an entry for every ladder it knows including one per
 * competitive map, so most come back all-null for any given player and are
 * dropped. Per-map competitive ranks sort last: they are the long tail, and
 * FACEIT / Premier / Wingman are what a visitor came to see. */
function Ranks({ ranks }) {
  const entries = Object.entries(ranks || {})
    .filter(([, r]) => r && (r.current != null || r.peak != null))
    .sort((a, b) => {
      const tail = (k) => (k.startsWith("competitive:") ? 1 : 0);
      return tail(a[0]) - tail(b[0]) || a[0].localeCompare(b[0]);
    });
  if (!entries.length) return null;

  return (
    <>
      <h4 className="csrep-h4">Ranks</h4>
      <div className="csrep-grid">
        {entries.map(([k, r]) => (
          <div className="csrep-cell" key={k}>
            <div className="csrep-cell-value">
              {r.current != null ? r.current.toLocaleString() : "—"}
            </div>
            <div className="csrep-cell-label">
              {rankLabel(k)}
              {r.peak != null && (
                <span className="csrep-peak"> · peak {r.peak.toLocaleString()}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Bans({ bans }) {
  if (!bans || !bans.length) return null;
  return (
    <>
      <h4 className="csrep-h4">Ban history</h4>
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
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Linked platform profiles. Each is a link out, so it is a list rather than
 *  a stat grid — the id beside it is what CSRep matched on. */
function Platforms({ data }) {
  const links = [
    ["FACEIT", data.faceit_url, data.faceit_id],
    ["Gamers Club", data.gamersclub_url, data.gamersclub_id],
    ["Steam", data.steam_vanity_url, null],
  ].filter(([, url]) => url);
  if (!links.length) return null;

  return (
    <>
      <h4 className="csrep-h4">Linked profiles</h4>
      <ul className="csrep-links">
        {links.map(([name, url, id]) => (
          <li key={name}>
            <a href={url} target="_blank" rel="noopener noreferrer" className="csrep-link">
              {name}
            </a>
            {id && <span className="csrep-link-id">{id}</span>}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Steam collectibles, returned as bare numeric ids.
 *
 * CSRep publishes no lookup table for them, so there is nothing to translate
 * these into — the count is the readable signal, and the raw ids are shown
 * beneath it rather than dropped, since they are data the API did return. */
function Medals({ medals }) {
  if (!medals || !medals.length) return null;
  return (
    <>
      <h4 className="csrep-h4">Medals ({medals.length})</h4>
      <div className="csrep-medals">{medals.join(" · ")}</div>
    </>
  );
}

function LinkedAccount({ user }) {
  if (!user) return null;
  if (user.redacted) {
    return (
      <>
        <h4 className="csrep-h4">CSRep account</h4>
        <p className="csrep-note">This player&apos;s linked CSRep account is restricted.</p>
      </>
    );
  }
  return (
    <>
      <h4 className="csrep-h4">CSRep account</h4>
      <Section
        rows={[
          ["Handle", user.handle],
          ["Name", user.name],
          ["Roles", (user.roles || []).map(humanise).join(", ")],
          ["Member Since", fmtDate(user.created_at)],
        ]}
      />
    </>
  );
}

/** Presentational CSRep block. `data` is the /csrep/ endpoint payload. */
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
              {data.views != null && <>{data.views.toLocaleString()} profile views</>}
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
      <Ranks ranks={data.ranks} />
      <Section title="Commendations" rows={Object.entries(data.commendations || {})
        .map(([k, v]) => [humanise(k), scalar(v)])} />
      <Bans bans={data.bans} />

      <Section
        title="Steam account"
        rows={[
          ["Steam Level", scalar(data.steam_level)],
          ["CS2 Hours", scalar(data.cs2_hours)],
          ["Inventory Value", scalar(data.inventory_value)],
          ["Account Created", fmtDate(data.steam_created_at)],
          ["Profile Visibility", STEAM_PRIVACY[data.steam_privacy] || null],
          ["Status", steamStatus],
          ["In Game", data.steam_active_game],
        ]}
      />

      <Platforms data={data} />
      <Section
        title="Platform activity"
        rows={[
          ["Last FACEIT Match", fmtDate(data.faceit_latest_match_date)],
          ["Cybershoke Since", fmtDate(data.cybershoke_registered_at)],
        ]}
      />

      <Medals medals={data.medals} />
      <LinkedAccount user={data.user} />

      <Section
        title="Record"
        rows={[
          ["First Seen", fmtDate(data.created_at)],
          ["Last Updated", fmtDate(data.updated_at)],
          ["Steam ID", data.id],
        ]}
      />

      {/* Fields the API returned that this component has no layout for. Shown
          rather than dropped: CSRep ships new fields ahead of their spec. */}
      <Section
        title="Other"
        rows={Object.entries(data.extra || {}).map(([k, v]) => [humanise(k), scalar(v)])}
      />

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
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData({ available: false, reason: "network" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nickname]);

  if (loading) return <div className="csrep-empty">Loading CSRep data…</div>;
  return <CsrepView data={data} />;
}
