/* Shared HTML <head> rewriting, used by two callers that must agree:
 *
 *   scripts/prerender.mjs  — build time, for the fixed tool pages
 *   api/render.js          — request time, for /player/:nick
 *
 * Both take the built index.html and swap the block between the SEO markers.
 * Neither invents markup of its own, so a page can never end up with two
 * canonicals or a title that disagrees with its og:title.
 *
 * Deliberately dependency-free and plain ESM: it has to run inside a Vercel
 * serverless function and inside a build script, with no bundler in between.
 */

export const SITE_URL = "https://faceit-lens.com";

const START = "<!-- SEO:START";
const END = "<!-- SEO:END -->";

/* og:locale wants the underscored territory form, not the bare ISO code. */
const OG_LOCALE = { en: "en_US", ru: "ru_RU", pl: "pl_PL", uk: "uk_UA" };

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

/**
 * Absolute, canonical form of a path: no query, no hash, no trailing slash
 * (except the root). "/player/s1mple/?tab=x" -> "https://faceit-lens.com/player/s1mple".
 *
 * Trailing-slash and query variants of the same page are separate URLs to a
 * crawler; collapsing them here is what stops one page competing with itself.
 */
export function canonicalUrl(pathname) {
  const clean = String(pathname).split("?")[0].split("#")[0].replace(/\/+$/, "");
  return SITE_URL + (clean || "/");
}

/**
 * Build the replacement <head> block.
 *
 * `robots` carrying "noindex" suppresses the canonical entirely: a page that
 * asks not to be indexed has no canonical to give, and pointing it elsewhere
 * would donate its signals to a page that didn't earn them.
 */
export function buildMetaBlock({
  title,
  description,
  canonical,
  robots = "index, follow",
  ogType = "website",
  image = `${SITE_URL}/og.png`,
  imageWidth = 1200,
  imageHeight = 630,
  twitterCard = "summary_large_image",
  /* [{ locale, url }] for every language this page exists in, including the
     page's own. Google requires the set to be complete and self-referencing:
     if /ru/faq lists /faq but /faq doesn't list /ru/faq back, the whole
     cluster is discarded and the translations compete with each other. */
  alternates = null,
  locale = "en",
}) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = escapeHtml(image);
  const indexable = !String(robots).includes("noindex");

  const lines = [
    `${START} — injected. Source of truth: lib/seo.js -->`,
    `    <title>${t}</title>`,
    `    <meta name="description" content="${d}" />`,
    `    <meta name="robots" content="${escapeHtml(robots)}" />`,
  ];

  if (indexable && canonical) {
    lines.push(`    <link rel="canonical" href="${escapeHtml(canonical)}" />`);
    lines.push(`    <meta property="og:url" content="${escapeHtml(canonical)}" />`);
  }

  if (indexable && alternates && alternates.length > 1) {
    for (const alt of alternates) {
      lines.push(
        `    <link rel="alternate" hreflang="${escapeHtml(alt.locale)}" href="${escapeHtml(alt.url)}" />`,
      );
    }
    // x-default is where Google sends a searcher whose language matches none
    // of the above. English at the root is the right home for that.
    const fallback = alternates.find((a) => a.locale === "en") || alternates[0];
    lines.push(
      `    <link rel="alternate" hreflang="x-default" href="${escapeHtml(fallback.url)}" />`,
    );
    lines.push(`    <meta property="og:locale" content="${escapeHtml(OG_LOCALE[locale] || "en_US")}" />`);
  }

  lines.push(
    `    <meta property="og:title" content="${t}" />`,
    `    <meta property="og:description" content="${d}" />`,
    `    <meta property="og:type" content="${escapeHtml(ogType)}" />`,
    `    <meta property="og:image" content="${img}" />`,
  );

  // A square avatar card has no meaningful 1200x630 to declare; sending those
  // numbers anyway makes Discord letterbox the image.
  if (imageWidth && imageHeight) {
    lines.push(
      `    <meta property="og:image:width" content="${imageWidth}" />`,
      `    <meta property="og:image:height" content="${imageHeight}" />`,
    );
  }

  lines.push(
    `    <meta name="twitter:card" content="${escapeHtml(twitterCard)}" />`,
    `    <meta name="twitter:title" content="${t}" />`,
    `    <meta name="twitter:description" content="${d}" />`,
    `    <meta name="twitter:image" content="${img}" />`,
    `    ${END}`,
  );

  return lines.join("\n");
}

/**
 * Swap the marked block in `html`. Throws if the markers are missing — that
 * means index.html was edited in a way that would silently serve every page
 * the homepage's tags, which is the exact bug this file exists to prevent.
 */
export function injectMeta(html, meta) {
  const start = html.indexOf(START);
  const end = html.indexOf(END);

  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      "SEO markers not found in index.html. Expected '<!-- SEO:START ... -->' " +
      "and '<!-- SEO:END -->' in <head>. Without them every route would be " +
      "served the homepage's canonical and title.",
    );
  }

  const withMeta =
    html.slice(0, start) + buildMetaBlock(meta) + html.slice(end + END.length);

  return setHtmlLang(withMeta, meta.locale || "en");
}

const BODY_START = "<!-- SEO:BODY -->";
const BODY_END = "<!-- /SEO:BODY -->";

/**
 * Write the page's heading and intro into #root, in the page's own language.
 *
 * React overwrites this on mount and prints the same text again, so nothing a
 * person sees differs from what a crawler was served. That equivalence is the
 * point — serving different content to crawlers is cloaking, and Google
 * penalises it.
 *
 * Silently does nothing if the markers are absent, because a missing intro
 * costs some ranking signal while a thrown error costs the whole page.
 */
export function injectBody(html, { heading, body } = {}) {
  const start = html.indexOf(BODY_START);
  const end = html.indexOf(BODY_END);
  if (start === -1 || end === -1 || end < start || !heading) return html;

  const content =
    `${BODY_START}<div class="seo-intro"><h1>${escapeHtml(heading)}</h1>` +
    `<p>${escapeHtml(body || "")}</p></div>`;

  return html.slice(0, start) + content + html.slice(end);
}

/**
 * Point <html lang> at the page's actual language.
 *
 * This is not cosmetic. Google weighs the declared language when deciding
 * which query language a page answers, and screen readers switch voice on it —
 * a Russian page announced as English is read with English phonetics, which is
 * unintelligible.
 */
export function setHtmlLang(html, lang) {
  return html.replace(/<html\s+lang="[^"]*"/i, `<html lang="${escapeHtml(lang)}"`);
}

/**
 * The full hreflang cluster for one page, given the locales it exists in.
 * Every page in the cluster gets the identical list, itself included.
 */
export function buildAlternates(path, locales) {
  return locales.map((locale) => ({
    locale,
    url: canonicalUrl(locale === "en" ? path : `/${locale}${path === "/" ? "" : path}`),
  }));
}
