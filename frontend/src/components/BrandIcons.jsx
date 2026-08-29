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

/** Opens-in-a-new-tab marker, so the buttons read as leaving the site. */
