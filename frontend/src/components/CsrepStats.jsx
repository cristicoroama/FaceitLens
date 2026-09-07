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

/** Humanise a raw API field name without reinterpreting it.
 *
 * CSRep's terms forbid renaming or rescaling their signals, and their spec
 * publishes no display names, so the only honest label is the field's own
 * name made readable: "trust_score" -> "Trust Score". No semantic mapping
 * table, because a mapping table is where a rename sneaks in. */
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
  if (Number.isInteger(n)) return String(n);
  const r = Math.round(n * 1000) / 1000;
  return String(r);
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
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
  const restRows = Object.entries(rest)
    .map(([k, v]) => [k, scalar(v), v])
    .filter(([, v]) => v !== null);
  const breakdownRows =
    breakdown && typeof breakdown === "object"
      ? Object.entries(breakdown)
          .map(([k, v]) => [k, scalar(v), v])
          .filter(([, v]) => v !== null)
      : [];

  if (trustScore == null && !restRows.length && !breakdownRows.length) return null;

  return (
    <>
      {trustScore != null && (
        <div className="csrep-hero">
          <div className="csrep-hero-value">{scalar(trustScore)}</div>
          <div className="csrep-hero-label">Trust Score</div>
        </div>
      )}

      {!!restRows.length && (
        <div className="csrep-grid">
          {restRows.map(([k, v, raw]) => (
            <Cell key={k} label={humanise(k)} value={v} title={String(raw)} />
          ))}
        </div>
      )}

      {!!breakdownRows.length && (
        <>
          <h4 className="csrep-h4">Breakdown</h4>
          <div className="csrep-grid">
            {breakdownRows.map(([k, v, raw]) => (
              <Cell key={k} label={humanise(k)} value={v} title={String(raw)} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Commendations({ commendations }) {
  const rows = Object.entries(commendations || {}).filter(
    ([, v]) => typeof v === "number",
  );
  if (!rows.length) return null;
  return (
    <>
      <h4 className="csrep-h4">Commendations</h4>
      <div className="csrep-grid">
        {rows.map(([k, v]) => (
          <Cell key={k} label={humanise(k)} value={v.toLocaleString()} />
        ))}
      </div>
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
            <span className="csrep-ban-date">{fmtDate(b.starts_at || b.created_at)}</span>
          </li>
        ))}
      </ul>
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

  return (
    <div className="csrep-block">
      <div className="csrep-head">
        <div>
          <h3 className="csrep-title">CSRep reputation</h3>
          {data.refreshed_at && (
            <div className="csrep-sub">Refreshed {fmtDate(data.refreshed_at)}</div>
          )}
        </div>
        {data.autoflag && (
          <div className="csrep-autoflag" title={data.attribution?.disclaimer}>
            Auto-flagged
          </div>
        )}
      </div>

      <Reputation reputation={data.reputation} />
      <Ranks ranks={data.ranks} />
      <Commendations commendations={data.commendations} />
      <Bans bans={data.bans} />

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
