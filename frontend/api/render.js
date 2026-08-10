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

import { injectMeta, canonicalUrl, SITE_URL } from "../lib/seo.js";

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
  const path = `/player/${encodeURIComponent(nick)}`;

  const shell = await getShell();
  if (!shell) {
    // Never show a person an error over a meta tag. Bounce to the same URL
    // with a flag that vercel.json routes straight to the static SPA.
    res.setHeader("Cache-Control", "no-store");
    res.redirect(307, `${path}?__spa=1`);
    return;
  }

  const { answered, player } = await getPlayer(nick);

  let title = `${nick} — FACEIT CS2 Stats, ELO & Trust Score | Faceit-Lens`;
  let description =
    `FACEIT CS2 stats for ${nick}: ELO, level, win rate, K/D, map performance, ` +
    `match history and an account trust score to spot smurfing.`;
  let image = `${SITE_URL}/og.png`;
  let imageWidth = 1200;
  let imageHeight = 630;
  let twitterCard = "summary_large_image";
  let found = Boolean(player);

  if (player) {
    const name = player.nickname || nick;
    const lvl = player.skill_level ? ` Level ${player.skill_level},` : "";
    const elo = player.elo ? ` ${player.elo} ELO` : "";
    title = `${name} — FACEIT CS2 Stats, ELO & Trust Score | Faceit-Lens`;

    const s = player.stats || {};
    const bits = [
      s.win_rate ? `${s.win_rate}% win rate` : "",
      s.avg_kd ? `${s.avg_kd} K/D` : "",
      s.avg_hs ? `${s.avg_hs}% HS` : "",
      s.matches ? `${s.matches} matches` : "",
    ].filter(Boolean);

    description = bits.length
      ? `FACEIT CS2 stats for ${name}:${lvl}${elo}, ${bits.join(", ")}, map performance and an account trust score.`
      : `FACEIT CS2 stats for ${name}:${lvl}${elo} win rate, K/D, map performance, match history and an account trust score to spot smurfing.`;

    if (player.avatar) {
      image = player.avatar;
      // A square avatar isn't 1200x630; declaring those dimensions makes
      // Discord letterbox it.
      imageWidth = null;
      imageHeight = null;
      twitterCard = "summary";
    }
  }

  /* A nickname that doesn't exist still answers 200 from a static host, so
   * without this every typo'd or deleted profile becomes an indexable empty
   * page. Only act on a definite answer: if the backend was asleep we say
   * nothing, because noindexing a real player is far more expensive than
   * letting one dead URL through. */
  const robots = answered && !found ? "noindex, follow" : "index, follow";

  let html;
  try {
    html = injectMeta(shell, {
      title,
      description,
      canonical: canonicalUrl(path),
      robots,
      ogType: "profile",
      image,
      imageWidth,
      imageHeight,
      twitterCard,
    });
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
