import { useState, useEffect, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

/** Official Steam logo (piston mark). */
function SteamIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" />
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
