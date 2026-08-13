/* Post-build step: give every page, in every language, its own HTML file.
 *
 * Why this exists
 * ---------------
 * This is a Vite SPA, so the server has exactly one HTML file to hand out.
 * Every route — /prosettings, /leaderboard, /faq — arrived at the crawler as
 * the homepage's <head>: same title, same description, and (before this) a
 * canonical pointing at "/". Google reads the canonical and consolidates, so
 * the entire site collapsed into one indexable page. The app fixed its own
 * tags after React booted, but the canonical had already been read.
 *
 * The same problem applies twice over to translations. A Russian page that is
 * only Russian after JavaScript runs is, to a crawler, an English page — and
 * without a complete hreflang cluster the language versions compete with each
 * other instead of covering different queries.
 *
 * What it does
 * ------------
 * Copies dist/index.html to dist/<locale>/<route>/index.html with the SEO
 * block swapped for that page's real tags, the hreflang cluster written out,
 * <html lang> set, and a translated heading and intro placed in the body.
 * Vercel checks the filesystem before it applies rewrites, so dist/ru/faq/
 * index.html wins over the SPA catch-all and the crawler gets correct HTML on
 * the first byte. The JS bundle is untouched, so React hydrates as before.
 *
 * Player pages can't be done here — there are millions and they change hourly.
 * Those are handled per request by api/render.js.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { injectMeta, injectBody, canonicalUrl, buildAlternates } from "../lib/seo.js";
import {
  PAGE_META,
  DEFAULT_TITLE,
  DEFAULT_DESC,
  prerenderRoutes,
} from "../src/page-meta.js";
import { ALL_LOCALES, localePath, metaFor } from "../src/i18n.js";

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "..", "dist");

const shellPath = join(dist, "index.html");

let shell;
try {
  shell = await readFile(shellPath, "utf8");
} catch {
  console.error(
    `\n  prerender: no build found at ${shellPath}\n` +
    `  Run the Vite build first — this script only rewrites its output.\n`,
  );
  process.exit(1);
}

const routes = prerenderRoutes();
let written = 0;

for (const [path, key] of routes) {
  const english = key ? PAGE_META[key] : null;

  if (key && !english) {
    // A route listed for prerendering with no metadata would silently ship the
    // homepage's title. Better to stop the build than to ship it.
    console.error(`\n  prerender: no PAGE_META entry for "${key}" (route ${path})\n`);
    process.exit(1);
  }

  // Identical on every page of the cluster, itself included — Google discards
  // one-way hreflang sets.
  const alternates = buildAlternates(path, ALL_LOCALES);

  for (const locale of ALL_LOCALES) {
    const [rawTitle, description] = metaFor(
      locale, key, english, [DEFAULT_TITLE, DEFAULT_DESC],
    );

    // Sub-pages carry the brand, the homepage already has it in its title.
    const title = key ? `${rawTitle} | Faceit-Lens` : rawTitle;

    let html = injectMeta(shell, {
      title,
      description,
      canonical: canonicalUrl(localePath(locale, path)),
      alternates,
      locale,
    });

    // The heading is the title without the brand suffix — a visible "|
    // Faceit-Lens" in an <h1> reads like a mistake.
    html = injectBody(html, { heading: rawTitle, body: description });

    const outPath = localePath(locale, path);
    const out = outPath === "/"
      ? shellPath
      : join(dist, outPath, "index.html");

    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, html, "utf8");
    written++;
  }
}

console.log(
  `  prerender: ${written} pages — ${routes.length} routes x ${ALL_LOCALES.length} languages ` +
  `(${ALL_LOCALES.join(", ")}), each with its own canonical and hreflang`,
);

// x-default points at the English root, so its absence would break every
// hreflang cluster at once.
if (!routes.some(([p]) => p === "/")) {
  console.error("  prerender: no route for '/', which x-default points at");
  process.exit(1);
}

/* ---------------- sitemap ---------------- */

/* Generated rather than hand-written: 23 routes across 4 languages is 92 URLs,
   and a hand-maintained list silently rots the first time someone adds a page.
   Now the sitemap cannot disagree with what was actually built, because both
   come from the same loop.

   Each entry carries the full hreflang set. Google accepts alternates either
   in the page or in the sitemap; doing both is redundant but harmless, and the
   sitemap version is what gets picked up fastest on a site with little
   crawl budget. */
const CRAWL_HINTS = {
  "/": ["daily", "1.0"],
  "/leaderboard": ["daily", "0.9"],
  "/leaderboard/map": ["daily", "0.8"],
  "/bans": ["daily", "0.9"],
  "/faceitstatus": ["hourly", "0.9"],
  "/steamstatus": ["hourly", "0.9"],
  "/prosettings": ["weekly", "0.9"],
  "/competitions": ["daily", "0.8"],
  "/news": ["daily", "0.6"],
  "/privacy": ["yearly", "0.3"],
  "/terms": ["yearly", "0.3"],
  "/feedback": ["monthly", "0.4"],
};

const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

const entries = [];
for (const [path] of routes) {
  const alts = buildAlternates(path, ALL_LOCALES);
  const [changefreq, priority] = CRAWL_HINTS[path] || ["weekly", "0.7"];

  for (const self of alts) {
    entries.push(
      `  <url>\n` +
      `    <loc>${xml(self.url)}</loc>\n` +
      alts
        .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.locale}" href="${xml(a.url)}"/>\n`)
        .join("") +
      `    <changefreq>${changefreq}</changefreq>\n` +
      `    <priority>${priority}</priority>\n` +
      `  </url>`,
    );
  }
}

await writeFile(
  join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
  `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
  entries.join("\n") +
  `\n</urlset>\n`,
  "utf8",
);

console.log(`  prerender: sitemap.xml with ${entries.length} URLs`);
