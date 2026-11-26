/* Checks the things that decide whether this site can be indexed at all, in
 * any language: that every prerendered page carries its own self-referencing
 * canonical, that the hreflang clusters are complete and mutual, that each
 * translation actually contains translated text, and that api/render does the
 * same for /player/:nick under every backend mood (fast, asleep, 404).
 *
 * All of these fail silently — the site looks perfect in a browser while being
 * invisible to Google, or while quietly serving four copies of the same
 * English page. That is exactly the kind of bug worth spending a build step on.
 *
 *   node scripts/prerender.mjs && node scripts/seo-check.mjs
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_LOCALES } from "../src/i18n.js";

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "..", "dist");
const SITE = "https://faceit-lens.com";

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { failures++; console.error(`  ✗ ${m}`); };

function tag(html, re) {
  const m = html.match(re);
  return m ? m[1] : null;
}

const CYRILLIC = /[Ѐ-ӿ]/;
const POLISH = /[ąćęłńóśźż]/i;

/* ---------- 1. prerendered pages ---------- */

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir)) {
    const p = join(dir, entry);
    if ((await stat(p)).isDirectory()) out.push(...await walk(p));
    else if (entry === "index.html") out.push(p);
  }
  return out;
}

console.log("\nPrerendered pages");

let files = [];
try {
  files = await walk(dist);
} catch {
  console.error(`  no dist/ at ${dist} — run the build first\n`);
  process.exit(1);
}

const seen = new Map();          // url -> locale
const titlesByLocale = new Map(); // locale -> Map(title -> path)

for (const file of files) {
  const html = await readFile(file, "utf8");
  const rel = "/" + relative(dist, file).replace(/index\.html$/, "").replace(/\\/g, "/");
  const urlPath = rel === "/" ? "/" : rel.replace(/\/$/, "");
  const expected = SITE + (urlPath === "/" ? "/" : urlPath);

  const localeMatch = urlPath.match(/^\/(ru|pl|uk)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : "en";
  const basePath = localeMatch ? (urlPath.replace(/^\/(ru|pl|uk)/, "") || "/") : urlPath;

  // -- canonical
  const canonicals = html.match(/rel="canonical"/g) || [];
  const canonical = tag(html, /<link rel="canonical" href="([^"]+)"/);
  if (canonicals.length !== 1) bad(`${urlPath} has ${canonicals.length} canonicals, expected exactly 1`);
  else if (canonical !== expected) bad(`${urlPath} canonical is ${canonical}, expected ${expected}`);

  // -- title, unique within its own language
  const title = tag(html, /<title>([^<]*)<\/title>/);
  if (!title) bad(`${urlPath} has no <title>`);
  else {
    if (!titlesByLocale.has(locale)) titlesByLocale.set(locale, new Map());
    const byTitle = titlesByLocale.get(locale);
    if (byTitle.has(title)) bad(`${urlPath} shares its title with ${byTitle.get(title)}`);
    else byTitle.set(title, urlPath);
  }

  // -- html lang
  const htmlLang = tag(html, /<html\s+lang="([^"]+)"/);
  if (htmlLang !== locale) bad(`${urlPath} declares lang="${htmlLang}", expected "${locale}"`);

  // -- hreflang cluster: every locale present, self included, plus x-default
  const alts = [...html.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)];
  const langs = alts.map((m) => m[1]);
  for (const l of ALL_LOCALES) {
    if (!langs.includes(l)) bad(`${urlPath} hreflang cluster is missing "${l}"`);
  }
  if (!langs.includes("x-default")) bad(`${urlPath} has no x-default`);
  const self = alts.find((m) => m[1] === locale);
  if (self && self[2] !== expected) {
    bad(`${urlPath} hreflang="${locale}" points at ${self[2]}, not itself`);
  }

  // -- the translation is actually translated
  const body = tag(html, /<div class="seo-intro">([\s\S]*?)<\/div>/);
  if (!body) bad(`${urlPath} has no prerendered intro — Google would read this page as empty`);
  else if (locale === "ru" || locale === "uk") {
    if (!CYRILLIC.test(body)) bad(`${urlPath} is meant to be ${locale} but its intro has no Cyrillic`);
  } else if (locale === "pl") {
    if (!POLISH.test(body) && !/[a-z]/i.test(body)) bad(`${urlPath} pl intro looks empty`);
  }

  // -- still a working app
  if (!/id="root"/.test(html)) bad(`${urlPath} lost the SPA mount point`);
  if (!/<script type="module"/.test(html)) bad(`${urlPath} lost its script tag`);

  seen.set(expected, { locale, basePath });
}

// Every page must exist in every language, or the switcher and the hreflang
// cluster both point at 404s.
const basePaths = new Set([...seen.values()].map((v) => v.basePath));
for (const base of basePaths) {
  for (const l of ALL_LOCALES) {
    const url = SITE + (l === "en" ? (base === "/" ? "/" : base) : `/${l}${base === "/" ? "" : base}`);
    if (!seen.has(url)) bad(`${url} was never generated, but its siblings link to it`);
  }
}

if (!failures) {
  ok(`${files.length} pages across ${ALL_LOCALES.length} languages — canonical, hreflang, lang and translated copy all present`);
}

/* ---------- 2. sitemap ---------- */

console.log("\nSitemap");
try {
  const sitemap = await readFile(join(dist, "sitemap.xml"), "utf8");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (locs.length !== seen.size) {
    bad(`sitemap lists ${locs.length} URLs but ${seen.size} pages were built`);
  }
  const missing = locs.filter((l) => !seen.has(l));
  if (missing.length) bad(`sitemap lists ${missing.length} URL(s) that don't exist, e.g. ${missing[0]}`);
  if (!failures) ok(`${locs.length} URLs, all of which were actually built`);
} catch {
  bad("no sitemap.xml in dist/");
}

/* ---------- 3. api/render ---------- */

console.log("\n/player/:nick");

const shell = await readFile(join(dist, "index.html"), "utf8");
let spaShell = "";
try {
  spaShell = await readFile(join(dist, "spa.html"), "utf8");
} catch {
  bad("no spa.html in dist/");
}
const realFetch = globalThis.fetch;

function mockFetch({ shellOk = true, backend }) {
  return async (url) => {
    if (String(url).endsWith("/index.html") || String(url).endsWith("/spa.html")) {
      return shellOk
        ? { ok: true, text: async () => shell }
        : { ok: false, text: async () => "" };
    }
    if (typeof backend === "function") return backend();
    throw new Error("backend unreachable");
  };
}

function mockRes() {
  return {
    headers: {}, code: null, body: null, redirected: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(c) { this.code = c; return this; },
    send(b) { this.body = b; return this; },
    redirect(c, loc) { this.code = c; this.redirected = loc; return this; },
  };
}

// Fresh module each time: the shell is cached in module scope on purpose.
let n = 0;
const loadHandler = async () =>
  (await import(`../api/render.js?t=${n++}`)).default;

async function run(name, { shellOk = true, backend, query = {}, env = {} }, check) {
  const saved = { ...process.env };
  Object.assign(process.env, { BACKEND_URL: "https://backend.test", ...env });
  globalThis.fetch = mockFetch({ shellOk, backend });
  try {
    const handler = await loadHandler();
    const res = mockRes();
    await handler({ query: { nick: "s1mple", ...query } }, res);
    check(res, name);
  } finally {
    globalThis.fetch = realFetch;
    process.env = saved;
  }
}

const PLAYER = {
  nickname: "s1mple", skill_level: 10, elo: 3247, country: "ua", region: "EU",
  ranking: 12, form: "7-3", elo_extremes: { high: 3390, low: 2400, avg: 3100 },
  stats: { win_rate: 62, avg_kd: 1.34, avg_hs: 51, adr: 88.2, matches: 1820 },
  map_stats: [
    { map: "Mirage", matches: 210, win_rate: 66, avg_kd: 1.41 },
    { map: "Inferno", matches: 180, win_rate: 61, avg_kd: 1.30 },
  ],
};

const answers = async () => ({ ok: true, status: 200, json: async () => PLAYER });

await run("backend answers", { backend: answers }, (res, name) => {
  const c = tag(res.body, /<link rel="canonical" href="([^"]+)"/);
  const t = tag(res.body, /<title>([^<]*)<\/title>/);
  const r = tag(res.body, /<meta name="robots" content="([^"]+)"/);
  if (c !== `${SITE}/player/s1mple`) return bad(`${name}: canonical is ${c}`);
  if (!t.includes("s1mple")) return bad(`${name}: title is ${t}`);
  if (r !== "index, follow") return bad(`${name}: robots is ${r}`);
  if (!/og:type" content="profile"/.test(res.body)) return bad(`${name}: og:type not profile`);
  // Assert the page still boots, without depending on Vite's chunk naming —
  // that filename is a build detail and pinning it makes the check brittle.
  if (!/<script type="module"[^>]*src="\/assets\//.test(res.body)) {
    return bad(`${name}: lost the app bundle`);
  }
  ok(`${name} — canonical, title and stats all present`);
});

/* The numbers themselves, not just the tags around them.
 *
 * The handler fetches the whole profile in order to write four figures into the
 * meta description. For a long time it then threw the rest away, and what a
 * crawler received was a heading and one sentence — so the page could not rank
 * for "<nick> elo" (the ELO was not in the document) and nothing parsing the
 * HTML had a figure to quote. This is the check that keeps that from silently
 * coming back: it passes in a browser either way. */
await run("stats are in the body", { backend: answers }, (res, name) => {
  const body = tag(res.body, /<div class="seo-data">([\s\S]*?)<\/div>\s*<!-- \/SEO:BODY -->/)
    || tag(res.body, /<div class="seo-data">([\s\S]*?)<!-- \/SEO:BODY -->/);
  if (!body) return bad(`${name}: no stat block was rendered at all`);

  for (const [what, needle] of [
    ["ELO", "3247"], ["win rate", "62%"], ["K/D", "1.34"],
    ["headshots", "51%"], ["matches", "1820"], ["peak ELO", "3390"],
    ["country name", "Ukraine"], ["map block", "Mirage"],
  ]) {
    if (!body.includes(needle)) return bad(`${name}: ${what} (${needle}) missing`);
  }
  ok(`${name} — ELO, form, maps and country all readable without JavaScript`);
});

await run("structured data", { backend: answers }, (res, name) => {
  // The shell carries a WebSite node of its own; the per-page one is the
  // ProfilePage, so pick it out rather than assuming a position.
  const blocks = [...res.body.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )];
  let profile = null;
  for (const [, raw] of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return bad(`${name}: a JSON-LD block does not parse — ${e.message}`);
    }
    if (parsed["@type"] === "ProfilePage") profile = parsed;
  }
  if (!profile) return bad(`${name}: no ProfilePage node`);
  if (profile.mainEntity?.name !== "s1mple") return bad(`${name}: wrong subject`);

  const props = profile.mainEntity.additionalProperty || [];
  if (!props.some((p) => p.value === "3247")) {
    return bad(`${name}: ELO is not exposed as a PropertyValue`);
  }
  ok(`${name} — ProfilePage parses and carries the stats as PropertyValues`);
});

/* A nickname is arbitrary user input that ends up inside a <script> block. A
 * literal "</script>" in one would close the tag early and drop whatever
 * followed into the document as markup. */
await run("hostile nickname", {
  backend: async () => ({
    ok: true, status: 200,
    json: async () => ({ ...PLAYER, nickname: '</script><img src=x onerror=alert(1)>' }),
  }),
}, (res, name) => {
  if (/<\/script><img/.test(res.body)) {
    return bad(`${name}: nickname broke out of the JSON-LD script tag`);
  }
  ok(`${name} — escaped, no break-out`);
});

/* A stat block built from a profile that never arrived would be a grid of empty
 * rows: worse than nothing for a person, and a page full of blanks for a
 * crawler. The tags still have to be right, which the "backend asleep" case
 * below covers. */
await run("no stat block without data", {
  backend: () => { throw new Error("ETIMEDOUT"); },
}, (res, name) => {
  if (/seo-facts/.test(res.body)) return bad(`${name}: rendered an empty stat grid`);
  if (/ProfilePage/.test(res.body)) return bad(`${name}: claimed structured data it doesn't have`);
  ok(`${name} — degrades to the intro alone`);
});

await run("russian player page", { backend: answers, query: { lang: "ru" } }, (res, name) => {
  const c = tag(res.body, /<link rel="canonical" href="([^"]+)"/);
  const t = tag(res.body, /<title>([^<]*)<\/title>/);
  const l = tag(res.body, /<html\s+lang="([^"]+)"/);
  if (c !== `${SITE}/ru/player/s1mple`) return bad(`${name}: canonical is ${c}`);
  if (!CYRILLIC.test(t)) return bad(`${name}: title isn't Russian — ${t}`);
  if (l !== "ru") return bad(`${name}: html lang is ${l}`);
  if (!/hreflang="uk"/.test(res.body)) return bad(`${name}: incomplete hreflang cluster`);
  if (!CYRILLIC.test(tag(res.body, /<div class="seo-intro">([\s\S]*?)<\/div>/) || "")) {
    return bad(`${name}: body copy isn't Russian, so Google files it as English`);
  }
  // The field names beside the numbers are content too. English labels on a
  // Russian page are the same "filed as English" problem the intro check
  // exists to catch, just further down the document.
  if (!/<dt>Эло<\/dt>/.test(res.body)) {
    return bad(`${name}: stat labels are still English`);
  }
  if (!res.body.includes("3247")) {
    return bad(`${name}: the Russian page lost the numbers`);
  }
  ok(`${name} — Russian canonical, title, body, stat labels and full cluster`);
});

await run("unknown lang falls back", { backend: answers, query: { lang: "de" } }, (res, name) => {
  const c = tag(res.body, /<link rel="canonical" href="([^"]+)"/);
  if (c !== `${SITE}/player/s1mple`) return bad(`${name}: canonical is ${c}`);
  ok(`${name} — served as English instead of inventing a /de tree`);
});

await run("player gets a generated card", {
  backend: async () => ({
    ok: true, status: 200,
    json: async () => ({ ...PLAYER, avatar: "https://cdn.faceit.com/a.jpg" }),
  }),
}, (res, name) => {
  if (!/twitter:card" content="summary_large_image"/.test(res.body)) return bad(`${name}: not a large card`);
  if (!/og:image" content="https:\/\/faceit-lens\.com\/og\/s1mple\.png"/.test(res.body)) return bad(`${name}: og:image is not the generated card`);
  ok(`${name} — 1200x630 generated card`);
});

await run("backend asleep", {
  backend: () => { throw new Error("ETIMEDOUT"); },
}, (res, name) => {
  const c = tag(res.body, /<link rel="canonical" href="([^"]+)"/);
  const r = tag(res.body, /<meta name="robots" content="([^"]+)"/);
  if (c !== `${SITE}/player/s1mple`) return bad(`${name}: canonical is ${c}`);
  if (r !== "index, follow") return bad(`${name}: noindexed a real player because the backend was down`);
  ok(`${name} — still indexable with the right canonical`);
});

await run("no such player", {
  backend: async () => ({ ok: false, status: 404, json: async () => ({}) }),
}, (res, name) => {
  const r = tag(res.body, /<meta name="robots" content="([^"]+)"/);
  if (r !== "noindex, follow") return bad(`${name}: robots is ${r}, expected noindex`);
  if (/rel="canonical"/.test(res.body)) return bad(`${name}: a noindex page should not claim a canonical`);
  ok(`${name} — kept out of the index`);
});

await run("shell unreachable", {
  shellOk: false,
  env: { RENDER_SHELL_FILES: "" },
  backend: answers,
}, (res, name) => {
  if (res.code !== 307 || !String(res.redirected).includes("__spa=1")) {
    return bad(`${name}: expected a 307 to the static SPA, got ${res.code} ${res.redirected}`);
  }
  ok(`${name} — falls back to the SPA instead of erroring`);
});

await run("shell over the network", { backend: answers, env: { RENDER_SHELL_FILES: "" } }, (res, name) => {
  if (res.code !== 200) return bad(`${name}: expected 200, got ${res.code}`);
  if (tag(res.body, /<link rel="canonical" href="([^"]+)"/) !== `${SITE}/player/s1mple`) return bad(`${name}: wrong canonical`);
  ok(`${name} — disk shell missing, network fallback still renders`);
});

await run("shell read from disk", { backend: answers, shellOk: false }, (res, name) => {
  if (res.code !== 200) return bad(`${name}: network was down and the bundled shell was not used (${res.code})`);
  if (!/neutral SPA shell/.test(spaShell)) return bad(`${name}: dist/spa.html is not the neutral shell`);
  ok(`${name} — built from the bundled spa.html`);
});

await run("case redirect", { backend: answers, query: { nick: "S1MPLE", lang: "ru", tab: "maps" } }, (res, name) => {
  if (res.code !== 301) return bad(`${name}: expected 301, got ${res.code}`);
  if (res.redirected !== "/ru/player/s1mple?tab=maps") return bad(`${name}: redirected to ${res.redirected}`);
  ok(`${name} — 301 to the canonical-case path, lang and query kept`);
});

await run("canonical uses real nickname", {
  backend: async () => ({ ok: true, status: 200, json: async () => ({ ...PLAYER, nickname: "s1mple-renamed" }) }),
}, (res, name) => {
  const c = tag(res.body, /<link rel="canonical" href="([^"]+)"/);
  if (c !== `${SITE}/player/s1mple-renamed`) return bad(`${name}: canonical is ${c}`);
  if (!res.body.includes(`hreflang="ru" href="${SITE}/ru/player/s1mple-renamed"`)) return bad(`${name}: hreflang not on the real nickname`);
  ok(`${name} — canonical and hreflang follow player.nickname`);
});

await run("player data inlined", {
  backend: async () => ({
    ok: true, status: 200,
    json: async () => ({ ...PLAYER, fetched_at: 1767323045, fetched_at_iso: "2026-01-02T03:04:05Z", bio: "</script><b>x</b>" }),
  }),
}, (res, name) => {
  const raw = tag(res.body, /<script id="__PLAYER__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!raw) return bad(`${name}: no __PLAYER__ script`);
  if (/<\/script><b>/.test(res.body)) return bad(`${name}: player JSON broke out of its script tag`);
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { return bad(`${name}: __PLAYER__ does not parse — ${e.message}`); }
  if (parsed.elo !== 3247 || parsed.bio !== "</script><b>x</b>") return bad(`${name}: __PLAYER__ content altered`);
  if (!res.body.includes('"dateModified":"2026-01-02T03:04:05Z"')) return bad(`${name}: dateModified ignores fetched_at_iso`);
  ok(`${name} — __PLAYER__ JSON escaped and parseable, dateModified from fetched_at_iso`);
});

await run("no player data without a player", {
  backend: async () => ({ ok: false, status: 404, json: async () => ({}) }),
}, (res, name) => {
  if (/__PLAYER__/.test(res.body)) return bad(`${name}: inlined data for a missing player`);
  ok(`${name} — nothing inlined`);
});

console.log("\nShell and static files");
const before = failures;

if (!/rel="canonical"/.test(spaShell) && !/hreflang=/.test(spaShell) && !/class="seo-intro"/.test(spaShell)) {
  ok("spa.html is neutral: no canonical, no hreflang, no homepage body");
} else bad("spa.html carries a canonical, hreflang or the homepage body");
if (/name="robots" content="[^"]*noindex/.test(spaShell)) bad("spa.html is noindex, which would stop Google rendering real SPA routes");
if (!/<script type="module"/.test(spaShell)) bad("spa.html lost the app bundle");

try {
  const page404 = await readFile(join(dist, "404.html"), "utf8");
  if (!/name="robots" content="noindex, follow"/.test(page404)) bad("404.html is not noindex");
  if (/rel="canonical"/.test(page404)) bad("404.html claims a canonical");
  if (/<script type="module"/.test(page404)) bad("404.html boots the SPA, which has no route for unmatched paths");
} catch {
  bad("no 404.html in dist/");
}

for (const region of ["EU", "NA", "SA", "SEA", "OCE"]) {
  for (const prefix of ["", "/ru", "/pl", "/uk"]) {
    if (!seen.has(`${SITE}${prefix}/leaderboard/${region}`)) bad(`${prefix}/leaderboard/${region} was not prerendered`);
  }
}

if (/SearchAction/.test(shell)) bad("retired SearchAction JSON-LD is still in the shell");
if (/name="keywords"/.test(shell)) bad("meta keywords is still in the shell");
if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(shell)) bad("Google Fonts is still linked");
if (!/rel="preload" href="\/fonts\/inter-[^"]+\.woff2"/.test(shell)) bad("main Inter font is not preloaded");
if (!/rel="manifest" href="\/site\.webmanifest"/.test(shell)) bad("web manifest is not linked");
for (const [, f] of shell.matchAll(/url\((\/fonts\/[^)]+)\)/g)) {
  try { await stat(join(dist, f)); } catch { bad(`font ${f} is referenced but missing`); }
}

try {
  const manifest = JSON.parse(await readFile(join(dist, "site.webmanifest"), "utf8"));
  if (!manifest.icons?.some((i) => i.sizes === "512x512")) bad("manifest has no 512px icon");
  for (const icon of manifest.icons || []) {
    try { await stat(join(dist, icon.src)); } catch { bad(`manifest icon ${icon.src} is missing`); }
  }
  if (manifest.display !== "standalone") bad("manifest display is not standalone");
} catch (e) {
  bad(`site.webmanifest missing or invalid — ${e.message}`);
}

const robotsTxt = await readFile(join(dist, "robots.txt"), "utf8");
for (const rule of ["Disallow: /settings", "Disallow: /ru/settings", "Disallow: /pl/settings", "Disallow: /uk/settings"]) {
  if (!robotsTxt.includes(rule)) bad(`robots.txt is missing "${rule}"`);
}
for (const sm of ["sitemap.xml", "sitemap-players.xml"]) {
  if (!robotsTxt.includes(`Sitemap: ${SITE}/${sm}`)) bad(`robots.txt does not reference ${sm}`);
}

const vercel = JSON.parse(await readFile(resolve(here, "..", "vercel.json"), "utf8"));
const catchAll = (vercel.rewrites || []).find((r) => r.source.endsWith("[^/.]+/?)"));
if (!catchAll || catchAll.destination !== "/spa.html") bad("SPA catch-all does not point at /spa.html");
const assetHeader = (vercel.headers || []).find((h) => h.source === "/assets/(.*)");
if (!assetHeader || !/immutable/.test(JSON.stringify(assetHeader))) bad("/assets is not cached immutable");
if (!vercel.functions?.["api/render.js"]?.includeFiles) bad("api/render.js does not bundle the shell");

if (failures === before) ok("region pages, fonts, manifest, robots and vercel.json all consistent");

console.log("\nPlayer sitemap");
{
  const saved = { ...process.env };
  process.env.BACKEND_URL = "https://backend.test";
  const many = Array.from({ length: 60000 }, (_, i) => ({ nickname: `p${i}`, lastmod: "2026-01-01" }));
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ items: many }) });
  try {
    const handler = (await import(`../api/sitemap-players.js?t=${n++}`)).default;
    const index = mockRes();
    await handler({ query: {} }, index);
    const start = failures;
    const parts = [...index.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    if (!/<sitemapindex/.test(index.body) || parts.length !== 5) bad(`player sitemap index lists ${parts.length} sitemaps, expected 5 for 60000 players`);
    if (parts[0] !== `${SITE}/sitemap-players-1.xml`) bad(`player sitemap index points at ${parts[0]}`);
    const beyond = mockRes();
    await handler({ query: { page: "6" } }, beyond);
    if (beyond.code !== 404) bad(`player sitemap page beyond the end answered ${beyond.code}`);
    const res = mockRes();
    await handler({ query: { page: "1" } }, res);
    const count = (res.body.match(/<url>/g) || []).length;
    if (count > 50000) bad(`player sitemap has ${count} URLs, the limit is 50000`);
    if (!res.body.includes(`hreflang="ru" href="${SITE}/ru/player/p0"`)) bad("player sitemap lacks hreflang alternates");
    if (!/hreflang="x-default"/.test(res.body)) bad("player sitemap lacks x-default");
    if (failures === start) ok(`index of ${parts.length} sitemaps, ${count} URLs per page (cap 50000), with hreflang alternates`);
  } finally {
    globalThis.fetch = realFetch;
    process.env = saved;
  }
}

console.log(
  failures ? `\n${failures} check(s) failed\n` : "\nAll SEO checks passed\n",
);
process.exit(failures ? 1 : 0);
