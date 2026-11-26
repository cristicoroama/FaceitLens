import { useState, useEffect, useRef } from "react";

import { Icon } from "../icons.jsx";
import { ALL_LOCALES, DEFAULT_LOCALE, LOCALE_NAMES, localePath, makeT } from "../i18n.js";
import useFocusTrap from "../hooks/useFocusTrap.js";
import { isPlainClick, stripLocalePath } from "../shell-utils.js";

const LOCALE_SHORT = { en: "EN", ru: "RU", pl: "PL", uk: "UA" };
const LOCALE_FLAG = { en: "gb", ru: "ru", pl: "pl", uk: "ua" };

function LangFlag({ code, size = 18 }) {
  return (
    <img
      className="flag-icon"
      src={`/flags/${LOCALE_FLAG[code] || code}.svg`}
      alt=""
      style={{ width: size }}
      loading="lazy"
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  );
}

function sectionsOf(g) {
  return g.sections || [{ label: null, items: g.items || [] }];
}

function allItems(g) {
  return sectionsOf(g).flatMap((s) => s.items);
}

function Caret() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" aria-hidden="true"
         stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function TopNav({
  groups, mode, onNav, brandHref, onBrand, search, actions,
  lang = DEFAULT_LOCALE,
}) {
  const [open, setOpen] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const navRef = useRef(null);
  const langRef = useRef(null);
  const drawerRef = useRef(null);
  const triggers = useRef({});
  const menus = useRef({});
  const focusFirst = useRef(false);
  const t = makeT(lang);

  useFocusTrap(drawerRef, drawer, { onEscape: () => setDrawer(false) });

  const langLinks = ALL_LOCALES.map((l) => ({
    code: l,
    href: localePath(l, stripLocalePath(typeof window === "undefined" ? "/" : window.location.pathname)),
  }));

  useEffect(() => {
    if (open === null) return undefined;
    const onDoc = (e) => {
      const inNav = navRef.current?.contains(e.target);
      const inLang = langRef.current?.contains(e.target);
      if (!inNav && !inLang) setOpen(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open === null || !focusFirst.current) return;
    focusFirst.current = false;
    const first = menus.current[open]?.querySelector(".tn-menu-item");
    first?.focus();
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawer]);

  function pick(id) {
    setOpen(null);
    setDrawer(false);
    onNav(id);
  }

  const linkProps = (id, href) => ({
    href,
    onClick: (e) => {
      if (!isPlainClick(e)) return;
      e.preventDefault();
      pick(id);
    },
  });

  const isActive = (g) => (g.items || g.sections ? allItems(g).some((it) => it.id === mode) : g.id === mode);

  function toggle(key) {
    setOpen((o) => (o === key ? null : key));
  }

  function onTriggerKey(key, e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (open === key) {
        menus.current[key]?.querySelector(".tn-menu-item")?.focus();
      } else {
        focusFirst.current = true;
        setOpen(key);
      }
    } else if (e.key === "Escape" && open === key) {
      e.preventDefault();
      setOpen(null);
    }
  }

  function onMenuKey(key, e) {
    const items = [...(menus.current[key]?.querySelectorAll(".tn-menu-item") || [])];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(null);
      triggers.current[key]?.focus();
    } else if (e.key === "Tab") {
      setOpen(null);
    }
  }

  function renderTail(g, drawerMode) {
    if (!g.tail) return null;
    return (
      <>
        {!drawerMode && <div className="tn-menu-sep" role="separator" />}
        {g.tail.map((tl) => (
          <a
            key={tl.label}
            className={`${drawerMode ? "tn-drawer-item" : "tn-menu-item"} ${tl.cls || ""}`}
            href={tl.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { setOpen(null); setDrawer(false); }}
          >
            <span className="tn-menu-ic">{tl.icon}</span>
            <span className="tn-menu-text">{tl.label}</span>
          </a>
        ))}
      </>
    );
  }

  return (
    <>
      <header className="topnav">
        <a
          className="tn-brand"
          href={brandHref}
          onClick={(e) => {
            if (!isPlainClick(e)) return;
            e.preventDefault();
            setOpen(null);
            setDrawer(false);
            onBrand();
          }}
        >
          <img src="/logo.png" alt="" width="30" height="30" />
          <span className="tn-word">Faceit-<span>Lens</span></span>
        </a>

        <nav className="tn-nav" ref={navRef} aria-label={t("chrome.menu")}>
          {groups.map((g) =>
            g.items || g.sections ? (
              <div className="tn-item" key={g.label}>
                <button
                  ref={(el) => { triggers.current[g.label] = el; }}
                  className={`tn-trigger ${isActive(g) ? "active" : ""} ${open === g.label ? "open" : ""}`}
                  aria-expanded={open === g.label}
                  aria-haspopup="true"
                  onClick={() => toggle(g.label)}
                  onKeyDown={(e) => onTriggerKey(g.label, e)}
                >
                  {g.label}
                  {allItems(g).some((it) => it.badge) && <span className="tn-new-dot" aria-hidden="true" />}
                  <Caret />
                </button>

                {open === g.label && (
                  <div
                    className={`tn-menu ${g.sections ? "tn-menu-sections" : ""}`}
                    ref={(el) => { menus.current[g.label] = el; }}
                    onKeyDown={(e) => onMenuKey(g.label, e)}
                  >
                    {sectionsOf(g).map((sec, si) => (
                      <div className="sh-menu-sec" key={sec.label || si} role="group" aria-label={sec.label || undefined}>
                        {sec.label && <div className="sh-menu-sec-label" aria-hidden="true">{sec.label}</div>}
                        {sec.items.map((it) => (
                          <a
                            key={it.id}
                            className={`tn-menu-item ${mode === it.id ? "active" : ""}`}
                            aria-current={mode === it.id ? "page" : undefined}
                            {...linkProps(it.id, it.href)}
                          >
                            <span className="tn-menu-ic">{it.icon}</span>
                            <span className="tn-menu-text">
                              <span className="tn-menu-label">
                                {it.label}
                                {it.badge && <span className="badge rounded-pill">{it.badge}</span>}
                              </span>
                              {it.hint && <small>{it.hint}</small>}
                            </span>
                          </a>
                        ))}
                      </div>
                    ))}
                    {renderTail(g, false)}
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

        {search ? <div className="tn-search">{search}</div> : <div className="tn-search sh-search-empty" />}

        <div className="tn-item tn-lang" ref={langRef}>
          <button
            ref={(el) => { triggers.current.__lang = el; }}
            className={`tn-trigger ${open === "__lang" ? "open" : ""}`}
            aria-expanded={open === "__lang"}
            aria-haspopup="true"
            aria-label={t("chrome.language")}
            onClick={() => toggle("__lang")}
            onKeyDown={(e) => onTriggerKey("__lang", e)}
          >
            <LangFlag code={lang} size={17} />
            <span className="tn-lang-code">{LOCALE_SHORT[lang] || lang.toUpperCase()}</span>
            <Caret />
          </button>

          {open === "__lang" && (
            <div
              className="tn-menu tn-menu-right"
              ref={(el) => { menus.current.__lang = el; }}
              onKeyDown={(e) => onMenuKey("__lang", e)}
            >
              {langLinks.map((l) => (
                <a
                  key={l.code}
                  className={`tn-menu-item ${l.code === lang ? "active" : ""}`}
                  href={l.href}
                  hrefLang={l.code}
                  lang={l.code}
                  aria-current={l.code === lang ? "true" : undefined}
                >
                  <span className="tn-menu-ic"><LangFlag code={l.code} size={20} /></span>
                  <span className="tn-menu-text">{LOCALE_NAMES[l.code]}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="tn-actions">{actions}</div>

        <button
          className="tn-burger"
          onClick={() => setDrawer(true)}
          aria-label={t("chrome.openMenu")}
          aria-expanded={drawer}
          aria-haspopup="dialog"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>

      {drawer && (
        <>
          <div className="tn-scrim" onClick={() => setDrawer(false)} />
          <div className="tn-drawer" role="dialog" aria-modal="true" aria-label={t("chrome.menu")} ref={drawerRef}>
            <div className="tn-drawer-head">
              <span>{t("chrome.menu")}</span>
              <button onClick={() => setDrawer(false)} aria-label={t("chrome.closeMenu")}>{Icon.xLg}</button>
            </div>

            {groups.map((g) => (
              <div key={g.label || g.id}>
                {g.items || g.sections ? (
                  <>
                    <div className="tn-drawer-group">{g.label}</div>
                    {sectionsOf(g).map((sec, si) => (
                      <div key={sec.label || si} role="group" aria-label={sec.label || undefined}>
                        {sec.label && <div className="sh-drawer-sub">{sec.label}</div>}
                        {sec.items.map((it) => (
                          <a
                            key={it.id}
                            className={`tn-drawer-item ${mode === it.id ? "active" : ""}`}
                            aria-current={mode === it.id ? "page" : undefined}
                            {...linkProps(it.id, it.href)}
                          >
                            <span className="tn-menu-ic">{it.icon}</span>
                            {it.label}
                            {it.badge && <span className="badge rounded-pill">{it.badge}</span>}
                          </a>
                        ))}
                      </div>
                    ))}
                    {renderTail(g, true)}
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

            <div className="tn-drawer-group">{t("chrome.language")}</div>
            <div className="tn-drawer-langs">
              {langLinks.map((l) => (
                <a
                  key={l.code}
                  className={`tn-drawer-lang ${l.code === lang ? "active" : ""}`}
                  href={l.href}
                  hrefLang={l.code}
                  lang={l.code}
                >
                  <LangFlag code={l.code} size={16} />
                  {LOCALE_NAMES[l.code]}
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
