/**
 * Shared outbound links, in one place.
 *
 * These used to be duplicated between App.jsx and Feedback.jsx, which is how
 * the stale "referenced here and in Feedback.jsx only" comment drifted out of
 * date. Importing from here also keeps components out of a circular import
 * with App.jsx.
 */

// Permanent invite: never expires, unlimited uses.
export const DISCORD_INVITE = "https://discord.gg/p5GeaTEYdt";

export const GITHUB_REPO = "https://github.com/cristicoroama/FaceitLens";
export const CONTACT_EMAIL = "coroamamh@gmail.com";

// Was hardcoded in SiteFooter.jsx only; the top bar links to it too now, and
// two copies of a handle is one copy too many.
export const TELEGRAM_URL = "https://t.me/cristicor1";
