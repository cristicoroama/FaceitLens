import { DISCORD_INVITE, GITHUB_REPO, TELEGRAM_URL, CONTACT_EMAIL, COFFEE_URL } from "../links.js";
import { DiscordIcon, TelegramIcon, GitHubIcon, MailIcon } from "./BrandIcons.jsx";

/**
 * Floating brand links, pinned bottom-right on every page.
 *
 * Four of these five also live in the top bar. Rather than show both — two
 * copies of one row on every page is noise, not emphasis — the CSS shows
 * exactly one at a time: this dock from 900px up, the top-bar row below it. A
 * fixed dock on a phone would sit on top of the content it should sit beside.
 */
const LINKS = [
  { key: "discord", label: "Discord", href: DISCORD_INVITE, icon: <DiscordIcon size={19} /> },
  { key: "telegram", label: "Telegram", href: TELEGRAM_URL, icon: <TelegramIcon size={19} /> },
  { key: "github", label: "Source on GitHub", href: GITHUB_REPO, icon: <GitHubIcon size={19} /> },
  { key: "mail", label: `Email — ${CONTACT_EMAIL}`, href: `mailto:${CONTACT_EMAIL}`, icon: <MailIcon size={19} /> },
  { key: "coffee", label: "Buy me a coffee", href: COFFEE_URL, icon: <CoffeeIcon size={19} /> },
];

function CoffeeIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
         strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z" />
      <path d="M17 10h1.6a2.4 2.4 0 0 1 0 4.8H17" />
      <path d="M7 2.5v2.2M11 2.5v2.2M15 2.5v2.2" />
    </svg>
  );
}

export default function SocialDock() {
  return (
    <div className="sdock" aria-label="Contact and community links">
      {LINKS.map((l) => (
        <a
          key={l.key}
          className={`sdock-btn sdock-${l.key}`}
          href={l.href}
          /* mailto: hands off to a mail client, so a new tab would be left
             behind empty. The other three are real destinations. */
          {...(l.href.startsWith("mailto:")
            ? {}
            : { target: "_blank", rel: "noopener noreferrer" })}
          title={l.label}
          aria-label={l.label}
        >
          {l.icon}
        </a>
      ))}
    </div>
  );
}
