import { DISCORD_INVITE, GITHUB_REPO } from "../links.js";

/**
 * Site-wide footer. Carries the "not affiliated" notice that keeps our use of
 * the FACEIT / Valve marks clearly descriptive, plus the attribution
 * Liquipedia's CC BY-SA licence requires.
 */
export default function SiteFooter({ onNav }) {
  const link = (page, label) => (
    <a
      href={`/${page}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onNav(page);
      }}
    >
      {label}
    </a>
  );

  return (
    <footer className="site-foot">
      <div className="site-foot-links">
        {link("privacy", "Privacy")}
        <span className="site-foot-sep">·</span>
        {link("terms", "Terms")}
        <span className="site-foot-sep">·</span>
        {link("docs", "API")}
        <span className="site-foot-sep">·</span>
        <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">GitHub</a>
        <span className="site-foot-sep">·</span>
        <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">Discord</a>
      </div>

      <p className="site-foot-note">
        FaceitLens is an independent open-source project. It is <b>not affiliated
        with, endorsed by or sponsored by</b> FACEIT Ltd., Valve Corporation,
        Leetify or Allstar. Counter-Strike and Steam are trademarks of Valve
        Corporation; FACEIT is a trademark of FACEIT Ltd. All trademarks belong
        to their respective owners.
      </p>

      <p className="site-foot-note">
        Data from FACEIT, Steam, Leetify and Allstar. Pro roster and transfer
        data from{" "}
        <a href="https://liquipedia.net/counterstrike" target="_blank" rel="noopener noreferrer">
          Liquipedia
        </a>{" "}
        (CC BY-SA 3.0). Trust and smurf scores are automated estimates from
        public stats — not accusations.
      </p>
    </footer>
  );
}
