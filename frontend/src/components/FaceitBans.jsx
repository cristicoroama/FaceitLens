import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}
function ago(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function FaceitBans({ onPick }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/bans/`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => alive && setItems(j.items || []))
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-title">
          <div className="panel-ic" style={{ width: 38, height: 38 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 18, height: 18 }}>
              <circle cx="12" cy="12" r="9" /><path d="m5.5 5.5 13 13" />
            </svg>
          </div>
          FACEIT <em>Bans</em>
        </div>
        <div className="page-hero-sub">
          Recently spotted bans among players looked up on FaceitLens. The feed
          grows as banned accounts get searched — search someone banned and they
          show up here.
        </div>
      </div>

      {loading && <div className="state">Loading bans…</div>}

      {!loading && items && items.length === 0 && (
        <div className="state">
          No bans recorded yet. This feed fills up as banned players get searched —
          look one up and it'll appear here.
        </div>
      )}

      {!loading && items && items.length > 0 && (
        <div className="lrows stagger">
          {items.map((b, i) => (
            <div
              className={`lrow ${onPick ? "lrow-click" : ""} ban-row`}
              key={`${b.player_id}-${i}`}
              onClick={onPick ? () => onPick(b.nickname) : undefined}
            >
              {b.avatar ? (
                <img className="lrow-ava img" src={b.avatar} alt="" loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
              ) : (
                <div className="lrow-ava">{initials(b.nickname)}</div>
              )}
              <div className="lrow-main">
                <div className="lrow-name">{b.nickname}</div>
                <div className="lrow-dim">{ago(b.detected_at)}</div>
              </div>
              <span className="ban-tag">{b.ban_type || "banned"}</span>
            </div>
          ))}
        </div>
      )}

      <div className="hltv-note" style={{ textAlign: "left", padding: "12px 2px 0" }}>
        Bans come straight from FACEIT's own records for each account. This is a feed
        of accounts <b>you and others searched</b> that turned out banned — not every
        ban on the platform.
      </div>
    </>
  );
}
