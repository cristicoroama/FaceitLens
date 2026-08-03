import { useState, useEffect, useRef } from "react";

import { SteamIcon } from "./BrandIcons.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * Topbar account widget.
 * Signed out: "Sign in with Steam" button (redirects to the backend OpenID flow).
 * Signed in: avatar + name with a small dropdown (sign out).
 */
export default function AccountMenu({ user, onLogout, onSettings, onMyProfile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Steam only up here — one clean button. Linking a FACEIT account lives in
  // Settings, where there's room to explain what it does.
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
        <div className="acc-pop">
          <div className="acc-pop-head">
            {user.avatar && <img className="acc-avatar lg" src={user.avatar} alt="" />}
            <div>
              <div className="acc-pop-name">{user.name}</div>
              <div className="acc-pop-sub">
                {user.profile?.handle ? `@${user.profile.handle}` : "Signed in with Steam"}
              </div>
            </div>
          </div>

          {user.profile?.handle && (
            <button
              className="theme-opt"
              onClick={() => { setOpen(false); onMyProfile?.(user.profile.handle); }}
            >
              My profile
              {user.profile.faceit_verified && <span className="acc-verified" title="FACEIT linked">✓</span>}
            </button>
          )}
          <button className="theme-opt" onClick={() => { setOpen(false); onSettings?.(); }}>
            Settings
          </button>

          {user.profile?.faceit_nickname && (
            <button
              className="theme-opt"
              onClick={() => { setOpen(false); onMyProfile?.(user.profile.handle, true); }}
            >
              My FACEIT stats →
            </button>
          )}

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
