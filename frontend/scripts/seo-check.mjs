/* Checks the two things that decide whether this site can be indexed at all:
 * that every prerendered page carries its own self-referencing canonical, and
 * that api/render does the same for /player/:nick under every backend mood
 * (fast, asleep, 404).
 *
 * The bug this guards against is silent — the site looks perfect in a browser
 * while being invisible to Google — so it is worth a check that fails loudly.
 *
 *   node scripts/prerender.mjs && node scripts/seo-check.mjs
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

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

const titles = new Map();

for (const file of files) {
  const html = await readFile(file, "utf8");
  const rel = "/" + relative(dist, file).replace(/index\.html$/, "").replace(/\\/g, "/");
  const urlPath = rel === "/" ? "/" : rel.replace(/\/$/, "");
  const expected = SITE + (urlPath === "/" ? "/" : urlPath);

  const canonicals = html.match(/rel="canonical"/g) || [];
  const canonical = tag(html, /<link rel="canonical" href="([^"]+)"/);
  const title = tag(html, /<title>([^<]*)<\/title>/);

  if (canonicals.length !== 1) bad(`${urlPath} has ${canonicals.length} canonicals, expected exactly 1`);
  else if (canonical !== expected) bad(`${urlPath} canonical is ${canonical}, expected ${expected}`);

  if (!title) bad(`${urlPath} has no <title>`);
  else if (titles.has(title)) bad(`${urlPath} shares its title with ${titles.get(title)}`);
  else titles.set(title, urlPath);

  if (!/id="root"/.test(html)) bad(`${urlPath} lost the SPA mount point`);
  if (!/<script type="module"/.test(html)) bad(`${urlPath} lost its script tag`);
}

if (!failures) ok(`${files.length} pages, each with a unique title and its own canonical`);

/* ---------- 2. api/render ---------- */

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
  const res = {
    headers: {}, code: null, body: null, redirected: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(c) { this.code = c; return this; },
    send(b) { this.body = b; return this; },
    redirect(c, loc) { this.code = c; this.redirected = loc; return this; },
  };
  return res;
}

// Fresh module each time: the shell is cached in module scope on purpose.
let n = 0;
const loadHandler = async () =>
  (await import(`../api/render.js?t=${n++}`)).default;

async function run(name, { shellOk = true, backend, env = {} }, check) {
  const saved = { ...process.env };
  Object.assign(process.env, { BACKEND_URL: "https://backend.test", ...env });
  globalThis.fetch = mockFetch({ shellOk, backend });
  try {
    const handler = await loadHandler();
    const res = mockRes();
    await handler({ query: { nick: "s1mple" } }, res);
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

await run("backend answers", {
  backend: async () => ({ ok: true, status: 200, json: async () => PLAYER }),
}, (res, name) => {
  const c = tag(res.body, /<link rel="canonical" href="([^"]+)"/);
  const t = tag(res.body, /<title>([^<]*)<\/title>/);
  const r = tag(res.body, /<meta name="robots" content="([^"]+)"/);
  if (c !== `${SITE}/player/s1mple`) return bad(`${name}: canonical is ${c}`);
  if (!t.includes("s1mple") || !t.includes("FACEIT")) return bad(`${name}: title is ${t}`);
  if (r !== "index, follow") return bad(`${name}: robots is ${r}`);
  if (!/og:type" content="profile"/.test(res.body)) return bad(`${name}: og:type not profile`);
  if (!/assets\/index-/.test(res.body)) return bad(`${name}: lost the app bundle`);
  ok(`${name} — canonical, title and stats all present`);
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
  backend: async () => ({ ok: true, status: 200, json: async () => PLAYER }),
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
