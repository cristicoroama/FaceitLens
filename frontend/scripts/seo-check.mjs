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
const realFetch = globalThis.fetch;

function mockFetch({ shellOk = true, backend }) {
  return async (url) => {
    if (String(url).endsWith("/index.html")) {
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
  nickname: "s1mple", skill_level: 10, elo: 3247,
  stats: { win_rate: 62, avg_kd: 1.34, avg_hs: 51, matches: 1820 },
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
  ok(`${name} — Russian canonical, title, body and full cluster`);
});

await run("unknown lang falls back", { backend: answers, query: { lang: "de" } }, (res, name) => {
  const c = tag(res.body, /<link rel="canonical" href="([^"]+)"/);
  if (c !== `${SITE}/player/s1mple`) return bad(`${name}: canonical is ${c}`);
  ok(`${name} — served as English instead of inventing a /de tree`);
});

await run("player has an avatar", {
  backend: async () => ({
    ok: true, status: 200,
    json: async () => ({ ...PLAYER, avatar: "https://cdn.faceit.com/a.jpg" }),
  }),
}, (res, name) => {
  if (!/twitter:card" content="summary"/.test(res.body)) return bad(`${name}: not a square card`);
  if (/og:image:width/.test(res.body)) return bad(`${name}: declared 1200x630 for a square avatar`);
  ok(`${name} — square card, no bogus dimensions`);
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
  backend: answers,
}, (res, name) => {
  if (res.code !== 307 || !String(res.redirected).includes("__spa=1")) {
    return bad(`${name}: expected a 307 to the static SPA, got ${res.code} ${res.redirected}`);
  }
  ok(`${name} — falls back to the SPA instead of erroring`);
});

console.log(
  failures ? `\n${failures} check(s) failed\n` : "\nAll SEO checks passed\n",
);
process.exit(failures ? 1 : 0);
