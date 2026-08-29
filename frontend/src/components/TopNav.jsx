import { useState, useEffect, useRef } from "react";

import { DISCORD_INVITE, TELEGRAM_URL, GITHUB_REPO, CONTACT_EMAIL } from "../links.js";
import { Icon } from "../icons.jsx";
import { DiscordIcon, TelegramIcon, GitHubIcon, MailIcon } from "./BrandIcons.jsx";
import { ALL_LOCALES, DEFAULT_LOCALE, LOCALE_NAMES, localePath, makeT } from "../i18n.js";

/* Short codes for the bar — the full names would push the nav off a laptop
   screen, and every one of these is recognisable to the people who need it.

   The flag is the country whose flag people actually associate with the
   language, which is not always the language code: Ukrainian is `uk` but flies
   `ua`, and English gets the Union Jack. */
const LOCALE_SHORT = { en: "EN", ru: "RU", pl: "PL", uk: "UA" };
const LOCALE_FLAG = { en: "gb", ru: "ru", pl: "pl", uk: "ua" };

/* The outbound row in the bar. Order is deliberate: the two places you can
   talk to someone, then the two where you look something up or write in.
   Labels double as the tooltip and the screen-reader name, so each says where
   it goes rather than just naming the service. */
const SOCIALS = [
  { label: "Discord", href: DISCORD_INVITE, icon: <DiscordIcon size={18} /> },
  { label: "Telegram", href: TELEGRAM_URL, icon: <TelegramIcon size={18} /> },
  { label: "Source on GitHub", href: GITHUB_REPO, icon: <GitHubIcon size={18} /> },
  { label: `Email — ${CONTACT_EMAIL}`, href: `mailto:${CONTACT_EMAIL}`, icon: <MailIcon size={18} /> },
];

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

/** The current path with any locale prefix removed, so switching language
    keeps you on the page you were reading instead of dumping you home. */
function stripLocale(pathname) {
  return pathname.replace(/^\/(ru|pl|uk)(?=\/|$)/, "") || "/";
}

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
  lang = DEFAULT_LOCALE,
}) {
  const [open, setOpen] = useState(null);      // id of the open dropdown
  const [drawer, setDrawer] = useState(false); // mobile
  const navRef = useRef(null);
  const langRef = useRef(null);
  const t = makeT(lang);

  /* Real <a href> links rather than a JS-driven select. Two reasons: a crawler
     walks them, which is how the translated pages get discovered from each
     other; and switching language reloads the document, which is what makes
     the server hand back the prerendered page in the new language instead of
     re-rendering the old one client-side. */
  const langLinks = ALL_LOCALES.map((l) => ({
    code: l,
    href: localePath(l, stripLocale(
      typeof window === "undefined" ? "/" : window.location.pathname,
    )),
  }));

  /* Close on outside click and on Escape.
   *
   * Both containers have to be consulted. The language picker lives outside
   * <nav> — it sits after the search box — so a handler that only knew about
   * navRef treated every click inside the language menu as an outside click.
   * It closed the menu on mousedown, the <a> unmounted before mouseup, and the
   * link never fired: the picker looked completely dead. */
  useEffect(() => {
    if (open === null) return;
    const onDoc = (e) => {
      const inNav = navRef.current?.contains(e.target);
      const inLang = langRef.current?.contains(e.target);
      if (!inNav && !inLang) setOpen(null);
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
                  {/* Derived from the items rather than set on the group, so
                      the dot disappears by itself when the badge comes off the
                      last new entry. */}
                  {g.items.some((it) => it.badge) && <span className="tn-new-dot" aria-hidden="true" />}
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
                          {/* Label and badge share a row of their own. Dropping
                              the badge straight into .tn-menu-text made it a
                              flex-column child, which stretches — it rendered as
                              a full-width orange bar under the label. */}
                          <span className="tn-menu-label">
                            {it.label}
                            {it.badge && <span className="badge rounded-pill">{it.badge}</span>}
                          </span>
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

        {/* Icons only, between the nav and the search box — the last thing on
            the left-hand side rather than four more items competing with the
            account controls on the right.

            Discord used to be a full-width banner at the foot of the home
            page, which meant it was missing from every other page and, on the
            one page it did appear, was the largest thing on it. */}
        <div className="tn-socials">
          {SOCIALS.map((s) => (
            <a
              key={s.label}
              className="tn-social"
              href={s.href}
              /* mailto: opens a mail client, so a new tab would leave a blank
                 one behind. The other three are real destinations. */
              {...(s.href.startsWith("mailto:")
                ? {}
                : { target: "_blank", rel: "noopener noreferrer" })}
              title={s.label}
              aria-label={s.label}
            >
              {s.icon}
            </a>
          ))}
        </div>

        <div className="tn-search">{search}</div>

        <div className="tn-item tn-lang" ref={langRef}>
          <button
            className={`tn-trigger ${open === "__lang" ? "open" : ""}`}
            aria-expanded={open === "__lang"}
            aria-haspopup="true"
            aria-label={t("chrome.language")}
            onClick={() => setOpen((o) => (o === "__lang" ? null : "__lang"))}
          >
            <LangFlag code={lang} size={17} />
            <span className="tn-lang-code">{LOCALE_SHORT[lang] || lang.toUpperCase()}</span>
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none"
                 stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {open === "__lang" && (
            <div className="tn-menu tn-menu-right">
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
              <span>{t("chrome.menu")}</span>
              <button onClick={() => setDrawer(false)} aria-label={t("chrome.closeMenu")}>{Icon.xLg}</button>
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

            <div className="tn-drawer-group">{t("chrome.community")}</div>
            <a className="tn-drawer-item tn-discord" href={DISCORD_INVITE}
               target="_blank" rel="noopener noreferrer">{t("chrome.joinDiscord")}</a>
            {extras}
          </div>
        </>
      )}
    </>
  );
}
