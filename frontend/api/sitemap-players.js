import { ALL_LOCALES } from "../src/i18n.js";

const SITE = "https://faceit-lens.com";
const MAX_URLS = 50000;
const PLAYERS_PER_PAGE = Math.floor(MAX_URLS / ALL_LOCALES.length);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

async function loadPlayers() {
  const backend = process.env.BACKEND_URL;
  if (!backend) return [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(`${backend}/api/sitemap/players/`, { signal: ctrl.signal });
    if (r.ok) return (await r.json()).items || [];
  } catch {
  } finally {
    clearTimeout(timer);
  }
  return [];
}

function playerUrl(locale, nickname) {
  const path = `/player/${encodeURIComponent(nickname)}`;
  return `${SITE}${locale === "en" ? "" : `/${locale}`}${path}`;
}

function playerEntries(p) {
  const alts = ALL_LOCALES.map((locale) => [locale, playerUrl(locale, p.nickname)]);
  const links =
    alts.map(([l, u]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${esc(u)}"/>`).join("") +
    `<xhtml:link rel="alternate" hreflang="x-default" href="${esc(alts[0][1])}"/>`;
  return alts.map(([, u]) =>
    `  <url><loc>${esc(u)}</loc>${links}` +
    (p.lastmod ? `<lastmod>${esc(p.lastmod)}</lastmod>` : "") +
    `<changefreq>daily</changefreq><priority>0.6</priority></url>`,
  );
}

function send(res, xml, cached) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", cached ? "public, s-maxage=43200, stale-while-revalidate=86400" : "public, s-maxage=600");
  res.status(200).send(xml);
}

export default async function handler(req, res) {
  const items = (await loadPlayers()).filter((p) => p && p.nickname);
  const pages = Math.max(1, Math.ceil(items.length / PLAYERS_PER_PAGE));
  const rawPage = req.query?.page;

  if (rawPage === undefined || rawPage === "") {
    const maps = Array.from({ length: pages }, (_, i) =>
      `  <sitemap><loc>${SITE}/sitemap-players-${i + 1}.xml</loc></sitemap>`,
    );
    send(
      res,
      `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${maps.join("\n")}\n</sitemapindex>\n`,
      items.length > 0,
    );
    return;
  }

  const page = Number.parseInt(String(rawPage), 10);
  if (!Number.isInteger(page) || page < 1 || page > pages) {
    res.setHeader("Cache-Control", "public, s-maxage=600");
    res.status(404).send("Not found");
    return;
  }

  const slice = items.slice((page - 1) * PLAYERS_PER_PAGE, page * PLAYERS_PER_PAGE);
  const urls = slice.flatMap(playerEntries).slice(0, MAX_URLS);
  send(
    res,
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`,
    items.length > 0,
  );
}
