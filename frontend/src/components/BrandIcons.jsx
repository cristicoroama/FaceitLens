/**
 * Third-party brand marks, inline so they inherit currentColor and cost no
 * extra request. Used to label links that point AT those services — which is
 * what keeps the use descriptive rather than suggesting any affiliation.
 * See the notice in SiteFooter.jsx.
 *
 * SteamIcon used to live inside AccountMenu; PlayerHeader needs it too, so it
 * moved here rather than getting copy-pasted.
 */

export function SteamIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" />
    </svg>
  );
}

/** FACEIT's arrow mark, drawn as a single filled path so it takes the colour
    of whatever button it sits in instead of carrying a black outline. */
/* Twitch's own glyph, from their brand guidelines. Kept monochrome and driven
   by currentColor so the link colours it like the others rather than dropping
   the brand purple into a page that reserves colour for meaning. */
export function TwitchIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M4.265 0 1.5 3.687v16.591h5.53V24h3.032l3.687-3.722h4.607L23.5 15.13V0H4.265Zm2.765 2.765h13.706v11.06l-3.687 3.688h-4.607l-3.687 3.687v-3.687H7.03V2.765Zm4.607 3.687v5.53h2.765v-5.53h-2.765Zm5.53 0v5.53h2.765v-5.53h-2.765Z" />
    </svg>
  );
}

export function FaceitIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M22.6 2.4v18.9L1.4 12.9a.9.9 0 0 1 .3-1.7h14.4L22.6 2.4Z" />
    </svg>
  );
}

/* Gamers Club's mark. Their own SVG uses <defs> + <use> and two brand colours;
   inlined here as plain paths under the same transform, monochrome and driven
   by currentColor for the reason TwitchIcon gives above — a link colours it
   like every other platform instead of dropping a second blue into a page
   that reserves colour for meaning. Unique-id collisions from <defs> go away
   with it. */
export function GamersClubIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 37 37" width={size} height={size} fill="currentColor" aria-hidden="true">
      <g transform="translate(-393 -425)">
        <path d="M427 432.88l-6.16 4.24a11.2 11.2 0 0 0-9.15-4.7 11.13 11.13 0 0 0-11.19 11.07c0 2.33.73 4.49 1.98 6.27l-6.16 4.24a18.24 18.24 0 0 1-3.32-10.51A18.6 18.6 0 0 1 411.7 425c6.32 0 11.92 3.11 15.3 7.88" />
        <path d="M428.6 436l-16.78 11.9h9.77a11.03 11.03 0 0 1-10.04 6.55c-2.3 0-4.45-.72-6.22-1.95l-6.33 4.48a18.2 18.2 0 0 0 12.55 5.02c10.19 0 18.45-8.42 18.45-18.8 0-2.55-.5-4.98-1.4-7.2" />
      </g>
    </svg>
  );
}

/* Cybershoke's mark, same monochrome treatment. Their original splits the
   glyph across white and a brand-variable fill; both become currentColor. */
export function CybershokeIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M46.1699 69.6772V78.586L38.4195 74.106V74.0996L30.7651 69.6644L26.9379 67.4436L22.9635 65.146L20.6851 63.8212V32.1924L26.9635 28.5572L46.1507 17.4404V26.426L34.7523 33.0628L28.4099 36.7556V59.386L30.7651 60.7556L46.1699 69.6772Z" />
      <path d="M87.1106 25.5169L87.085 70.5409L48.5378 92.7937L48.0898 93.0497L38.4258 87.4753L38.4194 78.5409L47.9234 84.0257L48.1026 84.1281L51.9298 81.9137L52.5186 81.5745L79.3794 66.0545L79.3986 29.9969L71.6994 25.5489L61.6066 19.7185L61.5938 11.4113V11.2961V10.7969L75.2962 18.7009L87.1106 25.5169Z" />
      <path d="M57.7731 8.57006V17.5109L54.2979 15.5077L48.0899 11.9301L16.8451 30.0229L16.8387 66.0549L22.9635 69.6069L30.7587 74.1253L34.5987 76.3461L34.6115 85.3253L22.9571 78.5797L9.03076 70.5285L9.06276 25.5237L48.0835 2.98926L57.7731 8.57006Z" />
      <path d="M57.7732 30.9505V44.1537L75.5076 44.1921V63.8657L50.0164 78.5793L50.0356 69.6449L67.7892 59.3793L67.7572 51.8849L50.0164 51.8977V17.4209L75.5076 32.2241V41.2353L57.7732 30.9505Z" />
    </svg>
  );
}

export function DiscordIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.6 1.25a18.3 18.3 0 0 0-5.5 0 12.6 12.6 0 0 0-.61-1.25.08.08 0 0 0-.08-.04c-1.7.3-3.33.81-4.89 1.52a.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.05 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.29 1.23-1.99a.08.08 0 0 0-.04-.11c-.65-.25-1.27-.55-1.87-.89a.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01 14.2 14.2 0 0 0 12.06 0 .07.07 0 0 1 .08 0l.37.3a.08.08 0 0 1-.01.13c-.6.35-1.22.64-1.87.89a.08.08 0 0 0-.04.11c.36.7.78 1.36 1.23 1.99a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6.01-3.03.08.08 0 0 0 .03-.05c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.21 0 2.18 1.09 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.22 0 2.18 1.09 2.16 2.42 0 1.34-.94 2.42-2.16 2.42Z" />
    </svg>
  );
}

export function TelegramIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm4.91 7.22c.1 0 .32.02.47.14a.51.51 0 0 1 .17.33c.02.09.04.3.02.47-.18 1.9-.96 6.5-1.36 8.62-.17.9-.5 1.2-.82 1.23-.7.07-1.23-.46-1.9-.9-1.06-.69-1.66-1.12-2.68-1.8-1.19-.78-.42-1.21.26-1.91.17-.18 3.24-2.98 3.3-3.23.01-.03.02-.15-.05-.21-.07-.06-.18-.04-.25-.02-.11.02-1.8 1.14-5.06 3.34-.48.33-.92.5-1.3.49-.43-.01-1.26-.24-1.87-.44-.75-.25-1.35-.38-1.3-.79.03-.22.33-.44.9-.66 3.5-1.53 5.83-2.53 7-3.02 3.33-1.38 4.02-1.62 4.47-1.63Z" />
    </svg>
  );
}

export function GitHubIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12 .3a12 12 0 0 0-3.79 23.4c.6.1.82-.26.82-.58l-.01-2.04c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.41-1.31.75-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.28-1.23 3.28-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.47 5.92.42.36.8 1.1.8 2.22l-.01 3.29c0 .31.21.69.82.57A12 12 0 0 0 12 .3Z" />
    </svg>
  );
}

/* Not a brand mark — a plain envelope. It lives here because it sits in the
   same row as the three above and has to match their weight and box, which a
   generic icon set glyph would not. */
export function MailIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}

/** Opens-in-a-new-tab marker, so the buttons read as leaving the site. */
