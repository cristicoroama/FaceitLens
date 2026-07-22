import { useState, useEffect, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

/** Steam logo (simplified mark). */
function SteamIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="15.5" cy="8.5" r="2.6" />
      <path d="M3.4 14.2 9.2 16.7a2.7 2.7 0 1 0 3.2-3.7l3-2.6" />
    </svg>
  );
}

/**
 * Topbar account widget.
 * Signed out: "Sign in with Steam" button (redirects to the backend OpenID flow).
 * Signed in: avatar + name with a small dropdown (sign out).
 */
export default function AccountMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!user) {
    return (
      <a className="tb-btn steam-login" href={`${API_BASE}/api/auth/steam/login/`}>
        <SteamIcon />
        <span className="steam-login-label">Sign in with Steam</span>
      </a>
    );
  }

  return (
    <div className="acc-menu" ref={ref}>
      <button className="tb-btn acc-trigger" onClick={() => setOpen((o) => !o)} title={user.name}>
        {user.avatar ? (
          <img className="acc-avatar" src={user.avatar} alt={user.name} />
        ) : (
          <span className="acc-avatar ph">{(user.name || "?").slice(0, 2).toUpperCase()}</span>
        )}
        <span className="acc-name">{user.name}</span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="theme-pop acc-pop">
          <div className="acc-pop-head">
            {user.avatar && <img className="acc-avatar lg" src={user.avatar} alt="" />}
            <div>
              <div className="acc-pop-name">{user.name}</div>
              <div className="acc-pop-sub">Signed in with Steam</div>
            </div>
          </div>
          {user.steamid && (
            <a
              className="theme-opt"
              href={`https://steamcommunity.com/profiles/${user.steamid}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Steam profile →
            </a>
          )}
          <button
            className="theme-opt acc-logout"
            onClick={() => { setOpen(false); onLogout(); }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
