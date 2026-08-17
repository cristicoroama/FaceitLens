/* Serves /player/:nick with that player's own <head>.
 *
 * Why this exists
 * ---------------
 * The SPA sets its title and canonical after React boots. A crawler reads the
 * HTML it was handed, so every player page arrived as the homepage: identical
 * title, identical description, and a canonical pointing at "/". That last one
 * is the fatal part — it explicitly tells Google the page is a duplicate of
 * the homepage, so no player profile could ever rank. Since "<nickname>
 * faceit" is the single biggest source of organic traffic in this category,
 * that was the whole channel, closed.
 *
 * The fixed tool pages are handled at build time (scripts/prerender.mjs).
 * Player pages can't be: there are millions and their stats change hourly, so
 * they're built here, per request, and cached at the edge.
 *
 * Env: BACKEND_URL = https://<your-service>.onrender.com
 */

import { injectMeta, injectBody, canonicalUrl, buildAlternates, SITE_URL } from "../lib/seo.js";
import { ALL_LOCALES, DEFAULT_LOCALE, PLAYER_META, STAT_LABELS, FACT_LABELS, localePath } from "../src/i18n.js";
import { COUNTRY_NAMES } from "../src/country-names.js";

/* How many maps to write into the body.
 *
 * A player with 40 maps played would otherwise push a wall of numbers above the
 * app's own content for the second it takes React to mount, and the tail of
 * that list is single-digit sample sizes nobody should draw a conclusion from.
 * The five most-played are the ones the page is actually about. */
const MAPS_IN_BODY = 5;

/* Percent-valued fields arrive from FACEIT as bare numbers ("62"), and a lone
 * 62 in a definition list is ambiguous to anything reading it back. */
const pct = (v) => (v === null || v === undefined || v === "" ? null : `${v}%`);

/* The backend is on Render's free tier, which sleeps after 15 minutes idle and
 * then takes ~a minute to wake. Waiting on that would hold up the page for a
 * real person to save a nicer <title>, which is a bad trade — the canonical is
 * what actually matters here and it doesn't need the backend at all. So: a
 * short leash, and generic-but-correct tags if it isn't met. */
const BACKEND_TIMEOUT_MS = 2500;

/* Reused across invocations on a warm lambda, so the shell is normally fetched
 * once per instance rather than once per request. */
let shellCache = null;

async function getShell() {
  if (shellCache) return shellCache;

  // The production domain first: it's CDN-backed and stable. VERCEL_URL is the
  // per-deployment host, which is what preview builds have to use.
  const origins = [SITE_URL];
  if (process.env.VERCEL_URL) origins.push(`https://${process.env.VERCEL_URL}`);

  for (const origin of origins) {
    try {
      const r = await fetch(`${origin}/index.html`);
      if (r.ok) {
        const html = await r.text();
        // Only trust it if it's the real shell. A CDN error page would
        // otherwise get cached here and served for every player.
        if (html.includes("<!-- SEO:START") && html.includes('id="root"')) {
          shellCache = html;
          return shellCache;
        }
      }
    } catch {
      // try the next origin
    }
  }
  return null;
}

/**
 * Look the player up, distinguishing "this nickname does not exist" from
 * "the backend didn't answer in time". They look identical if you only return
 * null, and they call for opposite decisions: the first should be kept out of
 * the index, the second must not be — a sleeping backend would otherwise
 * quietly noindex real players.
 *
 * Returns { answered, player }.
 */
async function getPlayer(nick) {
  const backend = process.env.BACKEND_URL;
  if (!backend || !nick) return { answered: false, player: null };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), BACKEND_TIMEOUT_MS);
  try {
    const r = await fetch(
      `${backend}/api/player/${encodeURIComponent(nick)}/`,
      { signal: ctrl.signal },
    );
    if (r.ok) return { answered: true, player: await r.json() };
    // A clear "no such player" is an answer. A 5xx is the backend struggling,
    // which tells us nothing about whether the player exists.
    if (r.status === 404) return { answered: true, player: null };
    return { answered: false, player: null };
  } catch {
    return { answered: false, player: null }; // asleep, slow or down
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  const nick = (req.query.nick || "").toString();
  const raw = (req.query.lang || "").toString();
  const lang = ALL_LOCALES.includes(raw) ? raw : DEFAULT_LOCALE;

  const path = `/player/${encodeURIComponent(nick)}`;
  const localised = localePath(lang, path);

  const shell = await getShell();
  if (!shell) {
    // Never show a person an error over a meta tag. Bounce to the same URL
    // with a flag that vercel.json routes straight to the static SPA.
    res.setHeader("Cache-Control", "no-store");
    res.redirect(307, `${localised}?__spa=1`);
    return;
  }

  const { answered, player } = await getPlayer(nick);
  const found = Boolean(player);

  const name = player?.nickname || nick;
  const L = STAT_LABELS[lang] || STAT_LABELS[DEFAULT_LOCALE];
  const s = player?.stats || {};
  const stats = [
    s.win_rate ? L.wr(s.win_rate) : "",
    s.avg_kd ? L.kd(s.avg_kd) : "",
    s.avg_hs ? L.hs(s.avg_hs) : "",
    s.matches ? L.m(s.matches) : "",
  ].filter(Boolean).join(", ");

  const template = PLAYER_META[lang] || PLAYER_META[DEFAULT_LOCALE];
  const [bareTitle, description] = template(name, stats);
  const title = `${bareTitle} | Faceit-Lens`;

  let image = `${SITE_URL}/og.png`;
  let imageWidth = 1200;
  let imageHeight = 630;
  let twitterCard = "summary_large_image";

  if (player?.avatar) {
    image = player.avatar;
    // A square avatar isn't 1200x630; declaring those dimensions makes
    // Discord letterbox it.
    imageWidth = null;
    imageHeight = null;
    twitterCard = "summary";
  }

  /* A nickname that doesn't exist still answers 200 from a static host, so
   * without this every typo'd or deleted profile becomes an indexable empty
   * page. Only act on a definite answer: if the backend was asleep we say
   * nothing, because noindexing a real player is far more expensive than
   * letting one dead URL through. */
  const robots = answered && !found ? "noindex, follow" : "index, follow";

  /* The body content.
   *
   * `player` is already in hand — it was fetched above to build the description
   * — so everything here is free apart from the string building. Before this,
   * all of it was discarded after four numbers were formatted into a sentence,
   * and the HTML a crawler received was a heading and one line of prose. A
   * search engine cannot rank a page for "<nick> elo" when the ELO is not in
   * the document, and anything else parsing the page has nothing to quote.
   *
   * Every field below is one the React page renders too, so the pre-hydration
   * HTML and the hydrated page say the same thing. That equivalence is not
   * optional: different content for crawlers is cloaking. */
  const F = FACT_LABELS[lang] || FACT_LABELS[DEFAULT_LOCALE];
  let facts = null;
  let sections = null;
  let jsonLd = null;

  if (found) {
    facts = [
      { label: F.elo, value: player.elo },
      { label: F.level, value: player.skill_level },
      { label: F.winRate, value: pct(s.win_rate) },
      { label: F.kd, value: s.avg_kd },
      { label: F.hs, value: pct(s.avg_hs) },
      { label: F.adr, value: s.adr },
      { label: F.matches, value: s.matches },
      { label: F.form, value: player.form },
      { label: F.peakElo, value: player.elo_extremes?.high },
      { label: F.ranking, value: player.ranking },
      { label: F.region, value: player.region },
      {
        label: F.country,
        value: player.country
          ? COUNTRY_NAMES[player.country.toLowerCase()] || player.country.toUpperCase()
          : null,
      },
    ];

    const maps = (player.map_stats || []).slice(0, MAPS_IN_BODY);
    if (maps.length) {
      sections = [{
        heading: F.mapsHeading,
        items: maps.map((m) => {
          const bits = [
            m.win_rate ? `${m.win_rate}% ${F.winRate.toLowerCase()}` : null,
            m.avg_kd ? `${m.avg_kd} ${F.kd}` : null,
            `${m.matches} ${F.matches.toLowerCase()}`,
          ].filter(Boolean);
          return `${m.map} — ${bits.join(", ")}`;
        }),
      }];
    }

    /* schema.org has no vocabulary for a Counter-Strike ELO, so the stats go in
     * as PropertyValue pairs. That is the documented way to express attributes
     * the vocabulary doesn't name, and it survives being read by something that
     * knows nothing about this site's HTML. */
    jsonLd = {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      dateModified: new Date().toISOString(),
      mainEntity: {
        "@type": "Person",
        name: player.nickname || nick,
        alternateName: nick,
        url: canonicalUrl(localised),
        ...(player.avatar ? { image: player.avatar } : {}),
        ...(player.country
          ? { nationality: COUNTRY_NAMES[player.country.toLowerCase()] || player.country.toUpperCase() }
          : {}),
        ...(player.faceit_url ? { sameAs: [player.faceit_url] } : {}),
        additionalProperty: facts
          .filter((f) => f.value !== null && f.value !== undefined && f.value !== "")
          .map((f) => ({
            "@type": "PropertyValue",
            name: f.label,
            value: String(f.value),
          })),
      },
    };
  }

  let html;
  try {
    html = injectMeta(shell, {
      title,
      description,
      jsonLd,
      canonical: canonicalUrl(localised),
      // The same player exists in all four languages, so the cluster is
      // complete by construction — no page here is ever missing a sibling.
      alternates: buildAlternates(path, ALL_LOCALES),
      locale: lang,
      robots,
      ogType: "profile",
      image,
      imageWidth,
      imageHeight,
      twitterCard,
    });
    html = injectBody(html, { heading: bareTitle, body: description, facts, sections });
  } catch {
    html = shell; // markers missing: still serve a working page
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Cached at the edge, so the function runs once per player per 10 minutes
  // and everyone else is served from the CDN.
  res.setHeader(
    "Cache-Control",
    found
      ? "public, s-maxage=600, stale-while-revalidate=86400"
      : "public, s-maxage=60, stale-while-revalidate=600",
  );
  res.status(200).send(html);
}
