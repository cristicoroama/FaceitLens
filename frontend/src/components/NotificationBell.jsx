import { useState, useEffect, useRef, useCallback } from "react";
import { Icon } from "../icons.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

function ago(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d < 7 ? `${d}d ago` : new Date(t).toLocaleDateString();
}

/**
 * Topbar notifications.
 *
 * The first thing on this site that starts a conversation rather than waiting
 * to be asked. Signed-in only — a notification names players somebody chose to
 * follow, so there is nothing to show an anonymous visitor.
 *
 * Fetched on mount and again whenever the panel opens, not on a timer: the
 * events behind these arrive at cron pace, and a poll every thirty seconds
 * would cost every signed-in session a request a minute to tell it nothing.
 */
export default function NotificationBell({ user, onOpen }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = useCallback(() => {
    if (!user) return;
    fetch(`${API_BASE}/api/notifications/`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        setItems(j.items || []);
        setUnread(j.unread || 0);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function markRead(ids) {
    // Optimistic: the badge clears immediately and the request settles behind
    // it. A failed mark-read leaves a dot that the next load restores, which
    // is a better failure than a panel that appears frozen after a click.
    setItems((list) =>
      list.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)),
    );
    setUnread((u) => (ids ? Math.max(0, u - ids.length) : 0));
    try {
      await fetch(`${API_BASE}/api/notifications/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : {}),
      });
    } catch { /* the next load re-reads the truth */ }
  }

  if (!user) return null;

  return (
    <div className="notif" ref={ref}>
      <button
        className="tb-btn notif-trigger"
        onClick={() => { setOpen((o) => { if (!o) load(); return !o; }); }}
        title={unread ? `${unread} unread` : "Notifications"}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        {Icon.broadcastPin}
        {unread > 0 && <span className="notif-dot">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="notif-pop">
          <div className="notif-pop-head">
            <span>Notifications</span>
            {unread > 0 && (
              <button className="notif-clear" onClick={() => markRead(null)}>
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="notif-empty">
              Nothing yet. Follow a player and you&apos;ll hear from us when
              something happens to their account.
            </div>
          ) : (
            <ul className="notif-list">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    className={`notif-item${n.read ? "" : " unread"}`}
                    onClick={() => {
                      if (!n.read) markRead([n.id]);
                      setOpen(false);
                      if (n.link) onOpen?.(n.link);
                    }}
                  >
                    <span className="notif-item-title">{n.title}</span>
                    {n.body && <span className="notif-item-body">{n.body}</span>}
                    <span className="notif-item-time">{ago(n.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
