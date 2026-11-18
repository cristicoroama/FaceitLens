const SITE = "https://faceit-lens.com";

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

export default async function handler(req, res) {
  const backend = process.env.BACKEND_URL;
  let items = [];
  if (backend) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    try {
      const r = await fetch(`${backend}/api/sitemap/players/`, { signal: ctrl.signal });
      if (r.ok) items = (await r.json()).items || [];
    } catch { /* empty sitemap rather than an error page */ }
    finally { clearTimeout(timer); }
  }
  const urls = items.map((p) =>
    `  <url><loc>${SITE}/player/${esc(encodeURIComponent(p.nickname))}</loc>` +
    (p.lastmod ? `<lastmod>${esc(p.lastmod)}</lastmod>` : "") +
    `<changefreq>daily</changefreq><priority>0.6</priority></url>`,
  );
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", items.length ? "public, s-maxage=43200, stale-while-revalidate=86400" : "public, s-maxage=600");
  res.status(200).send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
  );
}
