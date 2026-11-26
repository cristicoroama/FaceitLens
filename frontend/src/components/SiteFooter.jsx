import { DISCORD_INVITE, GITHUB_REPO, CONTACT_EMAIL, TELEGRAM_URL } from "../links.js";
import { ALL_LOCALES, DEFAULT_LOCALE, LOCALE_NAMES, localePath, makeT } from "../i18n.js";
import { CRAWL_LINKS } from "../page-meta.js";

/* Flag by association, not by language code — Ukrainian is `uk` but flies
   `ua`, and English gets the Union Jack. */
const FOOT_FLAG = { en: "gb", ru: "ru", pl: "pl", uk: "ua" };

/**
 * Site-wide footer. Carries the "not affiliated" notice that keeps our use of
 * the FACEIT / Valve marks clearly descriptive, plus the attribution
 * Liquipedia's CC BY-SA licence requires.
 */
export default function SiteFooter({ onNav, lang = DEFAULT_LOCALE }) {
  const t = makeT(lang);
  const link = (page, label) => (
    <a
      href={localePath(lang, `/${page}`)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onNav(page);
      }}
    >
      {label}
    </a>
  );

  /* Real <a href> links, not a JS dropdown: the language switcher is how a
     crawler walks from one translation to the next, and how a person lands on
     the version they want from a shared link. A select element would be
     invisible to both.
     Deliberately not auto-switching on browser language — a visitor who
     arrived on a Russian search result should stay there, and guessing
     overrides the choice Google already made. */
  const langSwitch = ALL_LOCALES.filter((l) => l !== lang).map((l) => (
    <span key={l}>
      <span className="site-foot-sep">·</span>
      <a className="site-foot-lang"
         href={localePath(l, window.location.pathname.replace(/^\/(ru|pl|uk)(?=\/|$)/, "") || "/")}
         hrefLang={l} lang={l}>
        <img className="flag-icon" src={`/flags/${FOOT_FLAG[l]}.svg`} alt="" width="15"
             loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        {LOCALE_NAMES[l]}
      </a>
    </span>
  ));

  return (
    <footer className="site-foot">
      {/* The sidebar's contact block landed here when the nav moved up top.
          Reference links belong in a footer — it's where people look for them.
          Discord and Buy-me-a-coffee stay in the nav's More menu instead,
          because those are actions and down here nobody would press them. */}
      <div className="site-foot-links">
        {link("faq", t("foot.faq"))}
        <span className="site-foot-sep">·</span>
        {link("privacy", t("foot.privacy"))}
        <span className="site-foot-sep">·</span>
        {link("terms", t("foot.terms"))}
        <span className="site-foot-sep">·</span>
        {link("docs", t("foot.api"))}
        <span className="site-foot-sep">·</span>
        {link("feedback", t("foot.feedback"))}
        <span className="site-foot-sep">·</span>
        <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">GitHub</a>
        <span className="site-foot-sep">·</span>
        <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">Discord</a>
        <span className="site-foot-sep">·</span>
        <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">Telegram</a>
        <span className="site-foot-sep">·</span>
        <a href={`mailto:${CONTACT_EMAIL}`}>{t("foot.email")}</a>
        {langSwitch}
      </div>

      <nav className="site-foot-tools" aria-label={t("foot.tools")}>
        {CRAWL_LINKS.map(([href, label]) => (
          <a key={href} href={localePath(lang, href)}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              onNav(href.replace(/^\//, ""));
            }}>
            {label}
          </a>
        ))}
      </nav>

      <p className="site-foot-note">{t("foot.indep")}</p>

      <p className="site-foot-note">
        {t("foot.dataA")}{" "}
        <a href="https://liquipedia.net/counterstrike" target="_blank" rel="noopener noreferrer">Liquipedia</a>{" "}
        {t("foot.dataB")}
      </p>

      <p className="site-foot-note">
        {t("foot.iconsA")}{" "}
        <a href="https://solar-icons.vercel.app" target="_blank" rel="noopener noreferrer">Solar Icons</a>{" "}
        {t("foot.by")}{" "}
        <a href="https://www.figma.com/community/file/1166831539721848736" target="_blank" rel="noopener noreferrer">480 Design</a>{" "}
        {t("foot.and")}{" "}
        <a href="https://icons.getbootstrap.com" target="_blank" rel="noopener noreferrer">Bootstrap Icons</a>{" "}
        {t("foot.iconsB")}
      </p>
    </footer>
  );
}
