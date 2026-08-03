import { useState, useEffect, useRef } from "react";

import { DISCORD_INVITE } from "../links.js";
import { Icon } from "../icons.jsx";

/**
 * Top navigation bar. Replaces the old left sidebar, which had outgrown
 * itself: sixteen entries plus a contact block needed ~850px of column on a
 * viewport that offered ~600px, so half the nav sat below a scrollbar where
 * nobody found it. Dropdowns give that space back on demand.
 *
 * Menus open on click, never on hover — hover menus fire by accident when the
 * pointer crosses them, and they're unusable on touch.
 */
export default function TopNav({
  groups, mode, onNav, brandHref, onBrand, search, actions, extras,
}) {
  const [open, setOpen] = useState(null);      // id of the open dropdown
  const [drawer, setDrawer] = useState(false); // mobile
  const navRef = useRef(null);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (open === null) return;
    const onDoc = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpen(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Lock body scroll while the mobile drawer is up.
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawer]);

  function pick(id) {
    setOpen(null);
    setDrawer(false);
    onNav(id);
  }

  /* Plain left-click is ours; anything else is the browser's, so ctrl-click
     and middle-click still open a real tab. */
  const linkProps = (id, href) => ({
    href,
    onClick: (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      pick(id);
    },
  });

  const isActive = (g) =>
    g.items ? g.items.some((it) => it.id === mode) : g.id === mode;

  return (
    <>
      <header className="topnav">
        <a
          className="tn-brand"
          href={brandHref}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            setOpen(null);
            setDrawer(false);
            onBrand();
          }}
        >
          <img src="/logo.png" alt="" width="30" height="30" />
          {/* One flex child, or the brand's gap opens up inside the wordmark */}
          <span className="tn-word">Faceit-<span>Lens</span></span>
        </a>

        <nav className="tn-nav" ref={navRef}>
          {groups.map((g) =>
            g.items ? (
              <div className="tn-item" key={g.label}>
                <button
                  className={`tn-trigger ${isActive(g) ? "active" : ""} ${open === g.label ? "open" : ""}`}
                  aria-expanded={open === g.label}
                  aria-haspopup="true"
                  onClick={() => setOpen((o) => (o === g.label ? null : g.label))}
                >
                  {g.label}
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none"
                       stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {open === g.label && (
                  <div className="tn-menu">
                    {g.items.map((it) => (
                      <a
                        key={it.id}
                        className={`tn-menu-item ${mode === it.id ? "active" : ""}`}
                        aria-current={mode === it.id ? "page" : undefined}
                        {...linkProps(it.id, it.href)}
                      >
                        <span className="tn-menu-ic">{it.icon}</span>
                        <span className="tn-menu-text">
                          {it.label}
                          {it.hint && <small>{it.hint}</small>}
                        </span>
                      </a>
                    ))}

                    {/* Discord and Buy-me-a-coffee are actions, not reference
                        links — the footer would bury them. */}
                    {g.tail && (
                      <>
                        <div className="tn-menu-sep" />
                        {g.tail.map((t) => (
                          <a
                            key={t.label}
                            className={`tn-menu-item ${t.cls || ""}`}
                            href={t.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setOpen(null)}
                          >
                            <span className="tn-menu-ic">{t.icon}</span>
                            <span className="tn-menu-text">{t.label}</span>
                          </a>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <a
                key={g.id}
                className={`tn-link ${mode === g.id ? "active" : ""}`}
                aria-current={mode === g.id ? "page" : undefined}
                {...linkProps(g.id, g.href)}
              >
                {g.label}
              </a>
            ),
          )}
        </nav>

        <div className="tn-search">{search}</div>
        <div className="tn-actions">{actions}</div>

        <button
          className="tn-burger"
          onClick={() => setDrawer(true)}
          aria-label="Open menu"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>

      {/* ---- mobile drawer: the same groups, expanded, no dropdowns ---- */}
      {drawer && (
        <>
          <div className="tn-scrim" onClick={() => setDrawer(false)} />
          <div className="tn-drawer" role="dialog" aria-label="Menu">
            <div className="tn-drawer-head">
              <span>Menu</span>
              <button onClick={() => setDrawer(false)} aria-label="Close menu">{Icon.xLg}</button>
            </div>

            {groups.map((g) => (
              <div key={g.label || g.id}>
                {g.items ? (
                  <>
                    <div className="tn-drawer-group">{g.label}</div>
                    {g.items.map((it) => (
                      <a
                        key={it.id}
                        className={`tn-drawer-item ${mode === it.id ? "active" : ""}`}
                        {...linkProps(it.id, it.href)}
                      >
                        <span className="tn-menu-ic">{it.icon}</span>
                        {it.label}
                      </a>
                    ))}
                  </>
                ) : (
                  <a
                    className={`tn-drawer-item solo ${mode === g.id ? "active" : ""}`}
                    {...linkProps(g.id, g.href)}
                  >
                    {g.icon && <span className="tn-menu-ic">{g.icon}</span>}
                    {g.label}
                  </a>
                )}
              </div>
            ))}

            <div className="tn-drawer-group">Community</div>
            <a className="tn-drawer-item tn-discord" href={DISCORD_INVITE}
               target="_blank" rel="noopener noreferrer">Join our Discord</a>
            {extras}
          </div>
        </>
      )}
    </>
  );
}
