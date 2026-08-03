/**
 * Privacy Policy and Terms of Service.
 *
 * Written against what the code actually does — the data models in
 * backend/tracker/models.py and the cookieless counter in analytics.py — so
 * these stay honest rather than boilerplate. If either changes, update here.
 */

import { CONTACT_EMAIL as CONTACT, DISCORD_INVITE, GITHUB_REPO } from "../links.js";

const UPDATED = "3 August 2026";

/* Third parties whose data we surface, and what each one is used for. */
const SOURCES = [
  ["FACEIT", "https://www.faceit.com", "Player profiles, ELO, match history, hubs and bans, via the FACEIT Data API."],
  ["Steam / Valve", "https://store.steampowered.com", "Sign-in, public profile details, CS2 playtime, inventory and medals."],
  ["Leetify", "https://leetify.com", "Demo-derived aim, utility and rank statistics for players who use Leetify."],
  ["Allstar", "https://allstar.gg", "Player highlight clips."],
  ["Liquipedia", "https://liquipedia.net", "Professional roster and transfer data, used under CC BY-SA 3.0."],
  ["HLTV / ProSettings", "https://prosettings.net", "Professional player configs and gear."],
];

function Disclaimer() {
  return (
    <div className="legal-callout">
      <b>FaceitLens is an independent project.</b> It is not affiliated with,
      endorsed by, sponsored by, or in any way officially connected to FACEIT
      Ltd., Valve Corporation, Leetify, Allstar or any other service it links
      to. Counter-Strike and Steam are trademarks of Valve Corporation. FACEIT
      is a trademark of FACEIT Ltd. All trademarks are the property of their
      respective owners and are used here only to describe what this site
      reports on.
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <div className="legal">
      <div className="section-title">Privacy Policy</div>
      <div className="legal-updated">Last updated {UPDATED}</div>

      <Disclaimer />

      <h3>The short version</h3>
      <p>
        You can use almost all of FaceitLens without an account and without
        being tracked. There are no advertising cookies, no third-party
        analytics scripts, and nothing is sold or shared with advertisers.
      </p>

      <h3>Visitor statistics — no cookies</h3>
      <p>
        Page views are counted without cookies and without storing your IP
        address. Each visitor is reduced to a truncated hash of{" "}
        <code>a daily secret + your IP + your browser's user agent</code>. The
        secret is regenerated every day and never reused, so the same person on
        two different days produces two unrelated values, and nothing in that
        record can be traced back to you or to an IP address.
      </p>
      <p>
        Because this stores no identifier on your device and cannot identify
        you, it needs neither a cookie banner nor your consent.
      </p>

      <h3>If you create an account</h3>
      <p>Signing in happens through Steam. We never see your Steam password. We store:</p>
      <ul>
        <li>your Steam ID, persona name and avatar;</li>
        <li>a profile you control: handle, display name, bio, optional uploaded avatar;</li>
        <li>an optional linked FACEIT nickname, so we can show your own stats;</li>
        <li>your favourites and watchlist;</li>
        <li>any feedback, votes or comments you post.</li>
      </ul>
      <p>
        A session cookie and a CSRF cookie keep you signed in and protect forms.
        Both are strictly necessary for the site to work and are used for
        nothing else.
      </p>

      <h3>Reports</h3>
      <p>
        If you report a user profile, we store the reason, your description and
        the IP address the report came from. The IP is kept only to detect abuse
        of the reporting system and is not used to build any profile of you.
      </p>

      <h3>Public data about players</h3>
      <p>
        FaceitLens displays information that is already public on FACEIT, Steam
        and the other sources listed below. We do not obtain private data, and
        we cannot show anything those services keep private — a private Steam
        inventory stays private here too.
      </p>
      <p>
        Scores such as <b>Account Trust</b> and the <b>smurf meter</b> are
        automated estimates calculated from public statistics. They are
        heuristics, not findings, not accusations, and not proof of cheating or
        of any wrongdoing. Only demo analysis by the platform operators can
        establish that. Please do not treat these numbers as a verdict about a
        person.
      </p>

      <h3>Where the data comes from</h3>
      <ul className="legal-sources">
        {SOURCES.map(([name, url, use]) => (
          <li key={name}>
            <a href={url} target="_blank" rel="noopener noreferrer">{name}</a> — {use}
          </li>
        ))}
      </ul>

      <h3>Your rights</h3>
      <p>
        FaceitLens is operated from Romania and follows the GDPR. You may
        request access to your data, correct it, export it, or have it erased.
      </p>
      <p>
        There is no self-service delete button yet. Email{" "}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a> from the address you can be
        reached at, or message us on{" "}
        <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">Discord</a>,
        and your account, profile, favourites and linked accounts will be
        removed. Requests are handled within 30 days, as the GDPR requires, and
        in practice much sooner.
      </p>
      <p>
        You also have the right to complain to your national data protection
        authority. In Romania that is the ANSPDCP.
      </p>

      <h3>Changes</h3>
      <p>
        If this policy changes in a way that affects you, the date at the top
        will change and the update will be noted in{" "}
        <a href="/whatsnew">What's New</a>.
      </p>
    </div>
  );
}

export function Terms() {
  return (
    <div className="legal">
      <div className="section-title">Terms of Service</div>
      <div className="legal-updated">Last updated {UPDATED}</div>

      <Disclaimer />

      <h3>What this is</h3>
      <p>
        FaceitLens is a free, open-source statistics tracker for Counter-Strike
        2, provided as-is by an individual. The source is available on{" "}
        <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">GitHub</a>{" "}
        under the MIT licence.
      </p>

      <h3>No guarantees</h3>
      <p>
        The site depends entirely on third-party services. Data may be delayed,
        incomplete, cached or simply wrong, and the site may be unavailable at
        any time without notice. Nothing here is offered with any warranty, and
        it should not be relied on for betting, recruitment, or any decision
        that matters to someone.
      </p>

      <h3>Scores are estimates, not accusations</h3>
      <p>
        The trust score, smurf meter and similar indicators are automated
        heuristics computed from public statistics. A high score is not evidence
        that anyone cheated, smurfed, or broke any rule. Do not use FaceitLens
        to harass, defame, brigade or publicly accuse anyone. Reports of
        cheating belong with FACEIT or Valve, who have the demos and the
        authority to judge them.
      </p>

      <h3>Fair use</h3>
      <p>Please don't:</p>
      <ul>
        <li>hammer the site or its API to the point where it degrades for others;</li>
        <li>re-publish bulk data in a way that breaks the source services' own terms;</li>
        <li>use the site to harass, stalk or target anyone;</li>
        <li>attempt to bypass rate limits, or access accounts that are not yours.</li>
      </ul>
      <p>
        The public API is documented at <a href="/docs">/docs</a> and is offered
        free for reasonable, non-abusive use. Rate limits apply and may change.
        Access may be withdrawn from anyone who abuses it.
      </p>

      <h3>Your content</h3>
      <p>
        You keep ownership of anything you post — feedback, comments, your bio
        and avatar — and you grant permission to display it on the site.
        Anything unlawful, abusive or infringing may be removed, and accounts
        that post it may be closed.
      </p>

      <h3>Takedowns and complaints</h3>
      <p>
        If you are a rights holder and believe something here infringes your
        rights, or you are a player who wants information about you reviewed,
        email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Genuine requests are
        acted on promptly — this is a hobby project and there is no interest in
        fighting anyone over it.
      </p>

      <h3>Liability</h3>
      <p>
        To the fullest extent the law allows, no liability is accepted for any
        loss arising from use of this site or reliance on anything it displays.
        These terms are governed by Romanian law.
      </p>
    </div>
  );
}
