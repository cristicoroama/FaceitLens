export default async function handler(req, res) {
  const nick = String(req.query.nick || "").replace(/\.png$/i, "").slice(0, 40);
  const backend = process.env.BACKEND_URL;
  if (!backend || !nick) {
    res.setHeader("Location", "/og.png");
    return res.status(302).end();
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${backend}/api/og/${encodeURIComponent(nick)}.png`, { signal: ctrl.signal });
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !type.startsWith("image/")) throw new Error("bad");
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).send(buf);
  } catch {
    res.setHeader("Location", "/og.png");
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(302).end();
  } finally {
    clearTimeout(timer);
  }
}
