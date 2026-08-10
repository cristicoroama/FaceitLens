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

  return html.slice(0, start) + buildMetaBlock(meta) + html.slice(end + END.length);
}
