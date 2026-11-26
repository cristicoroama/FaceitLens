import { useState, useEffect, useRef } from "react";

import { SteamIcon, FaceitIcon } from "./BrandIcons.jsx";
import { Icon } from "../icons.jsx";
import { useFaceitLogin, FACEIT_LOGIN_URL, STEAM_LOGIN_URL } from "../lib/account-api.js";

/**
 * Topbar account widget.
 * Signed out: "Sign in with Steam" button (redirects to the backend OpenID flow).
 * Signed in: avatar + name with a small dropdown (sign out).
 */
export default function AccountMenu({ user, onLogout, onSettings, onMyProfile, onMyGameProfile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const faceitEnabled = useFaceitLogin();

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") {
        setOpen((o) => {
          if (o) triggerRef.current?.focus();
          return false;
        });
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!user) {
    return (
      <div className="acc-signin">
        <a className="tb-btn steam-login" href={STEAM_LOGIN_URL} aria-label="Sign in with Steam">
          <SteamIcon />
          <span className="steam-login-label">Sign in with Steam</span>
        </a>
        {faceitEnabled && (
          <a
            className="tb-btn faceit-login-sm"
            href={FACEIT_LOGIN_URL}
            aria-label="Sign in with FACEIT"
            title="Sign in with FACEIT"
          >
            <FaceitIcon size={14} />
            <span className="steam-login-label">FACEIT</span>
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="acc-menu" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className="tb-btn acc-trigger"
        onClick={() => setOpen((o) => !o)}
        title={user.name}
        aria-expanded={open}
        aria-controls="acc-pop"
        aria-label={`Account menu for ${user.name}`}
      >
        {user.avatar ? (
          <img className="acc-avatar" src={user.avatar} alt={user.name} />
        ) : (
          <span className="acc-avatar ph">{(user.name || "?").slice(0, 2).toUpperCase()}</span>
        )}
        <span className="acc-name">{user.name}</span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="acc-pop" id="acc-pop" aria-label="Account">
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
              {Icon.personCheck}
              My profile
              {user.profile.faceit_verified && <span className="acc-verified" title="FACEIT linked">✓</span>}
            </button>
          )}
          <button className="theme-opt" onClick={() => { setOpen(false); onSettings?.(); }}>
            {Icon.sliders}
            Settings
          </button>

          {/* Your own tracked profile.
              Signing in needs Steam only, so a player with no FACEIT account
              had no way to reach their own page from here — the FACEIT entry
              simply did not render for them. This one adapts: the FACEIT
              profile when an account is linked, the Steam-first profile
              otherwise, which is the same page a visitor would land on. */}
          {(user.profile?.faceit_nickname || user.steamid) && (
            <button
              className="theme-opt"
              onClick={() => { setOpen(false); onMyGameProfile?.(); }}
            >
              {user.profile?.faceit_nickname
                ? <FaceitIcon size={14} />
                : <SteamIcon size={14} />}
              {user.profile?.faceit_nickname ? "My FACEIT stats →" : "My CS2 profile →"}
            </button>
          )}

          {faceitEnabled && !user.profile?.faceit_verified && (
            <a className="theme-opt" href={FACEIT_LOGIN_URL}>
              <FaceitIcon size={14} />
              Link FACEIT account
            </a>
          )}

          {user.steamid && (
            <a
              className="theme-opt"
              href={`https://steamcommunity.com/profiles/${user.steamid}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <SteamIcon size={14} />
              Steam profile →
            </a>
          )}
          <button
            className="theme-opt acc-logout"
            onClick={() => { setOpen(false); onLogout(); }}
          >
            {Icon.boxArrowUpRight}
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
