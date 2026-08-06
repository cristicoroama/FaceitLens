import { useEffect } from "react";

import { DISCORD_INVITE, GITHUB_REPO, CONTACT_EMAIL } from "../links.js";

/**
 * Frequently asked questions.
 *
 * Every number in here is read off the code rather than guessed — cache
 * windows from faceit.py/leetify.py/steam.py, the trust pillars from
 * trust.py, the ELO approximation from build_elo_history. If those change,
 * these answers have to change with them or the page starts lying.
 *
 * Rendered with <details>/<summary>: native keyboard support, and the answers
 * stay in the DOM so search engines index them even while collapsed.
 */

const FAQ = [
  {
    group: "The basics",
    items: [
      {
        q: "Do I need an account?",
        a: `No. Searching players, the leaderboard, match rooms, pro settings and
            every other tool work signed out. An account only adds things that
            are yours: a watchlist that follows you between devices, a public
            profile page, and your ELO recorded daily so your history keeps
            growing.`,
      },
      {
        q: "How do I link my FACEIT account?",
        a: `Sign in with Steam and it links itself. FACEIT exposes the Steam ID
            behind each account, so we match it automatically — there are no
            codes to paste anywhere and you never give us a password.`,
      },
      {
        q: "Is this free?",
        a: `Yes, all of it, and there are no adverts. The project is open source
            and paid for out of pocket.`,
      },
      {
        q: "Why can't it find a player?",
        a: `Search expects the exact FACEIT nickname, which is often not the same
            as the Steam name and is case-sensitive in places. A Steam ID64 or a
            steamcommunity.com link works too and is usually the surer route. If
            the player has never played CS2 on FACEIT there is simply nothing to
            show.`,
      },
    ],
  },
  {
    group: "The data",
    items: [
      {
        q: "How fresh are the numbers?",
        a: `A player profile is cached for 3 minutes, the leaderboard for 5, and
            Steam details for 6 hours because they barely move. Finished matches
            never change, so those are held for 6 hours too. If a number looks
            stale right after a match, it is almost always this rather than an
            error.`,
      },
      {
        q: "Why is my ELO graph not exactly right?",
        a: `Because FACEIT does not publish how much ELO each match was worth.
            The graph is reconstructed by walking back from your current ELO and
            assuming about 25 points a match, so the shape is honest but any
            single point can be off. If you have an account, your ELO is also
            recorded once a day from that point on — that part is exact, and it
            gets better the longer you stay signed up.`,
      },
      {
        q: "Why does my match history stop where it does?",
        a: `Up to 250 recent matches are pulled per player. Everything derived
            from history — recent form, sessions, teammates, nemeses — is
            calculated over that window rather than your whole career.`,
      },
      {
        q: "Where does all of this come from?",
        a: `FACEIT's official Data API for profiles, ELO, matches and bans. Steam
            for playtime, inventory, level and account age. Leetify for
            demo-derived stats, Allstar for clips, and Liquipedia for the
            professional scene. Nothing is scraped from behind a login and
            nothing private is accessible.`,
      },
      {
        q: "Why is a player's inventory or Leetify tab empty?",
        a: `A private Steam inventory stays private here — we can only ever see
            what Steam shows to the public. Leetify stats only exist for players
            who actually use Leetify, which most people don't.`,
      },
    ],
  },
  {
    group: "Trust Score",
    items: [
      {
        q: "How is the Trust Score calculated?",
        a: `From five account signals: how old the Steam account is, CS2 hours
            played, Steam level, inventory size, and FACEIT match count. Each is
            scored and the total is normalised to 0-100 using only the pillars we
            actually have data for. VAC bans, FACEIT bans, a very new account and
            a hidden inventory are flagged separately.`,
      },
      {
        q: "Does a low score mean someone is cheating?",
        a: `No, and this matters. The trust score measures how established an
            account looks — nothing more. A brand new account with no hours and
            no inventory scores low whether it belongs to a cheater, a smurf, or
            somebody who just started playing. It is not cheat detection and it
            is not evidence of anything.`,
      },
      {
        q: "Someone's score is unfair. Can it be removed?",
        a: `Yes. Email ${CONTACT_EMAIL} and it will be looked at. These scores are
            automated, and automated things get people wrong.`,
      },
    ],
  },
  {
    group: "Levels and ranks",
    items: [
      {
        q: "What does Challenger mean?",
        a: `It's the badge for the top 1,000 players of a region's level 10 pool.
            It is positional rather than an ELO threshold, so it is held only
            while you stay inside that top 1,000 — climbing to a given ELO does
            not earn it. Where a player qualifies, their exact position is shown.`,
      },
      {
        q: "What ELO do I need for each level?",
        a: `Level 1 starts at 100, then 501, 751, 901, 1051, 1201, 1351, 1531 and
            1751, with level 10 beginning at 2001. The bar on a player's profile
            shows how far into the current level they are and how much is left.`,
      },
    ],
  },
  {
    group: "Your account and privacy",
    items: [
      {
        q: "Do you track me?",
        a: `Not in any way that identifies you. Page views are counted without
            cookies and without storing IP addresses: each visitor becomes a
            truncated hash of a secret that is regenerated daily and never
            reused, so the same person on two days is two unrelated values.
            There are no advertising cookies and no third-party analytics.`,
      },
      {
        q: "What do you store if I sign in?",
        a: `Your Steam ID, name and avatar; the profile you control; an optional
            linked FACEIT nickname; your favourites; and anything you post to
            feedback. A session cookie keeps you signed in. That's the lot.`,
      },
      {
        q: "How do I delete my account?",
        a: `Email ${CONTACT_EMAIL} or message us on Discord and everything tied
            to you is removed. There is no self-service button yet — this is
            handled by hand, within 30 days as the GDPR requires and in practice
            far sooner.`,
      },
    ],
  },
  {
    group: "The project",
    items: [
      {
        q: "Is this affiliated with FACEIT or Valve?",
        a: `No. Faceit-Lens is an independent open-source project with no
            connection to FACEIT Ltd., Valve, Leetify or Allstar. All trademarks
            belong to their owners.`,
      },
      {
        q: "Is there an API?",
        a: `Yes, free and documented, with endpoints for player stats, ELO history
            and trust scores. Rate limits apply. See the API docs.`,
      },
      {
        q: "Can I see the source?",
        a: `All of it, on GitHub under the MIT licence. Bug reports and pull
            requests are welcome.`,
      },
      {
        q: "Something is broken. Where do I say so?",
        a: `The feedback board, the Discord, or ${CONTACT_EMAIL}. Bugs with a
            screenshot and the player you were looking at get fixed fastest.`,
      },
    ],
  },
];

/* Strip the JSX source indentation out of an answer before it's shown or fed
   to search engines. */
const clean = (s) => s.replace(/\s+/g, " ").trim();

export default function Faq() {
  // FAQPage structured data — this is what lets Google show the questions
  // directly in results. Generated from the same array as the page so the two
  // can never drift apart.
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = "faq-jsonld";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.flatMap((g) =>
        g.items.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: clean(a) },
        })),
      ),
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  return (
    <div className="legal faq">
      <div className="section-title">Frequently asked questions</div>
      <p className="faq-intro">
        How the numbers are worked out, what they do and don't mean, and what
        happens to your data. Anything missing?{" "}
        <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">Ask on Discord</a>.
      </p>

      {FAQ.map((g) => (
        <section key={g.group}>
          <h3>{g.group}</h3>
          {g.items.map(({ q, a }) => (
            <details className="faq-item" key={q}>
              <summary>
                {q}
                <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708" />
                </svg>
              </summary>
              <p>{clean(a)}</p>
            </details>
          ))}
        </section>
      ))}

      <p className="faq-foot">
        Still stuck? <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">Discord</a>
        {" · "}
        <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">GitHub</a>
        {" · "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </div>
  );
}
