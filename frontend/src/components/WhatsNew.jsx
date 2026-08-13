import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";
const SEEN_KEY = "faceitlens_news_seen";

const KIND_META = {
  feature: { label: "New", cls: "feature", icon: "✦" },
  improvement: { label: "Improved", cls: "improvement", icon: "↑" },
  fix: { label: "Fixed", cls: "fix", icon: "✓" },
  note: { label: "Note", cls: "note", icon: "•" },
};

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function readSeen() {
  try {
    return parseInt(localStorage.getItem(SEEN_KEY) || "0", 10) || 0;
  } catch {
    return 0;   // private mode / storage disabled
  }
}

function writeSeen(id) {
  try {
    localStorage.setItem(SEEN_KEY, String(id));
  } catch { /* nothing we can do, and nothing worth breaking over */ }
}

/**
 * Shared data hook: fetches the changelog once and works out how many entries
 * this visitor hasn't seen. Used by the page, the popup and the bell so all
 * three agree without fetching three times.
 */
export function useChangelog() {
  const [data, setData] = useState(null);
  const [seen, setSeen] = useState(readSeen);

  useEffect(() => {
    fetch(`${API_BASE}/api/changelog/`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setData({ entries: [], latest_id: 0 }));
  }, []);

  const entries = data?.entries || [];
  const unread = entries.filter((e) => e.id > seen).length;

  function markSeen() {
    const latest = data?.latest_id || 0;
    writeSeen(latest);
    setSeen(latest);
  }

  return { data, entries, unread, markSeen, loaded: !!data };
}

function Entry({ e, compact }) {
  const meta = KIND_META[e.kind] || KIND_META.note;
  return (
    <article className={`wn-entry ${compact ? "compact" : ""} ${e.highlight ? "hi" : ""}`}>
      <div className="wn-entry-head">
        <span className={`wn-kind ${meta.cls}`}>
          <span className="wn-kind-ic">{meta.icon}</span>
          {meta.label}
        </span>
        <h3 className="wn-title">{e.title}</h3>
        <time className="wn-date">{fmtDate(e.date)}</time>
      </div>
      {e.lines?.length > 0 && (
        <ul className="wn-lines">
          {e.lines.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      )}
    </article>
  );
}

/** The full /whatsnew page. */
export default function WhatsNew() {
  const { entries, loaded, markSeen } = useChangelog();

  // Opening the page counts as reading it.
  useEffect(() => { if (loaded) markSeen(); }, [loaded]);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="page-hero">
        <h1 className="page-title">What's New</h1>
        <p className="page-sub">
          Everything that's been added to FaceitLens, newest first.
        </p>
      </div>

      {!loaded ? (
        <div className="panel"><div className="skeleton tall" /></div>
      ) : entries.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-ico">✦</div>
            <h3>Nothing here yet</h3>
            <p>New features will show up on this page as they land.</p>
          </div>
        </div>
      ) : (
        <div className="panel wn-list">
          {entries.map((e) => <Entry key={e.id} e={e} />)}
        </div>
      )}
    </>
  );
}

/**
 * First-visit popup.
 *
 * Shows once when there's something the visitor hasn't seen, then stays out of
 * the way until the next post. Deliberately not shown to someone landing
 * straight on a player profile from a shared link — they came for that page,
 * not for our announcements.
 */
export function WhatsNewPopup({ unread, entries, markSeen, onOpenPage, suppressed }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (suppressed || unread === 0) return;
    // A short delay so it doesn't fight the page's own entrance animation.
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [unread, suppressed]);

  // Escape closes it, like any other dialog.
  useEffect(() => {
    if (!open) return;
    function onKey(ev) { if (ev.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);   // eslint-disable-line react-hooks/exhaustive-deps

  function close() {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); markSeen(); }, 200);
  }

  if (!open) return null;

  // Newest first, highlighted entry pinned to the top, at most three.
  const shown = [...entries]
    .filter((e) => e.id > 0)
    .sort((a, b) => (b.highlight ? 1 : 0) - (a.highlight ? 1 : 0))
    .slice(0, 3);

  return (
    <div className={`wn-pop-back ${closing ? "out" : ""}`} onClick={close}>
      <div className="panel wn-pop" onClick={(ev) => ev.stopPropagation()}>
        <button className="wn-pop-x" onClick={close} aria-label="Close">×</button>

        <div className="wn-pop-head">
          <div className="wn-pop-badge">✦</div>
          <div>
            <h2 className="wn-pop-title">What's new on FaceitLens</h2>
            <p className="wn-pop-sub">
              {unread === 1 ? "One new update" : `${unread} new updates`} since your last visit
            </p>
          </div>
        </div>

        <div className="wn-pop-body">
          {shown.map((e) => <Entry key={e.id} e={e} compact />)}
        </div>

        <div className="wn-pop-actions">
          <button className="btn ghost" onClick={close}>Dismiss</button>
          <button
            className="btn primary"
            onClick={() => { close(); onOpenPage?.(); }}
          >
            See everything
          </button>
        </div>
      </div>
    </div>
  );
}

/** Topbar bell with an unread count. */
export function WhatsNewButton({ unread, onClick, label = "News" }) {
  return (
    <button
      className="tb-btn wn-bell"
      onClick={onClick}
      title={unread ? `${unread} new update${unread === 1 ? "" : "s"}` : "What's new"}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <span className="wn-bell-label">{label}</span>
      {unread > 0 && <span className="wn-bell-dot">{unread > 9 ? "9+" : unread}</span>}
    </button>
  );
}
