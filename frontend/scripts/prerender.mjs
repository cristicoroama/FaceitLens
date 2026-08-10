/* Post-build step: give every fixed page its own HTML file.
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
 * What it does
 * ------------
 * Copies dist/index.html to dist/<route>/index.html with the SEO block
 * swapped for that page's real tags. Vercel checks the filesystem before it
 * applies rewrites, so dist/faq/index.html wins over the SPA catch-all and
 * the crawler gets correct HTML on the first byte. The JS bundle is untouched,
 * so React hydrates and behaves exactly as before.
 *
 * Player pages can't be done here — there are millions and they change hourly.
 * Those are handled per request by api/render.js.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { injectMeta, canonicalUrl } from "../lib/seo.js";
import {
  PAGE_META,
  DEFAULT_TITLE,
  DEFAULT_DESC,
  prerenderRoutes,
} from "../src/page-meta.js";

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
  const meta = key ? PAGE_META[key] : null;

  if (key && !meta) {
    // A route listed for prerendering with no metadata would silently ship the
    // homepage's title. Better to stop the build than to ship it.
    console.error(`\n  prerender: no PAGE_META entry for "${key}" (route ${path})\n`);
    process.exit(1);
  }

  const html = injectMeta(shell, {
    title: meta ? `${meta[0]} | Faceit-Lens` : DEFAULT_TITLE,
    description: meta ? meta[1] : DEFAULT_DESC,
    canonical: canonicalUrl(path),
  });

  // "/" overwrites dist/index.html in place; everything else becomes a
  // directory with an index.html, which is what static hosts serve for a
  // clean URL with no extension.
  const out = path === "/" ? shellPath : join(dist, path, "index.html");
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, html, "utf8");
  written++;
}

console.log(`  prerender: wrote ${written} pages with their own title + canonical`);
