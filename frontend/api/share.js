// Vercel serverless function. Serves per-player Open Graph tags for link
// previews (Discord/WhatsApp), then redirects real users to the SPA.
// Needs env var BACKEND_URL = https://<your-service>.onrender.com

export default async function handler(req, res) {
  const nick = (req.query.nick || "").toString();
  const backend = process.env.BACKEND_URL || "";
  const appUrl = `/player/${encodeURIComponent(nick)}`;

  let title = "FaceitLens — CS2 Stats Tracker";
  let desc = "FACEIT CS2 stats: ELO, win rate, K/D, maps and more.";
  let image = "";

  try {
    if (backend && nick) {
      const r = await fetch(`${backend}/api/player/${encodeURIComponent(nick)}/`);
      if (r.ok) {
        const p = await r.json();
        title = `${p.nickname} — Level ${p.skill_level ?? "?"} · ${p.elo ?? "?"} ELO`;
        const wr = p.stats?.win_rate ? `${p.stats.win_rate}% WR` : "";
        const kd = p.stats?.avg_kd ? `${p.stats.avg_kd} K/D` : "";
        desc = [wr, kd, p.region].filter(Boolean).join(" · ") || desc;
        image = p.avatar || "";
      }
    }
  } catch {
    // fall back to defaults
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(`<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(desc)}" />
<meta property="og:type" content="profile" />
<meta name="theme-color" content="#ff5500" />
${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ""}
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(desc)}" />
<title>${escapeHtml(title)}</title>
<meta http-equiv="refresh" content="0; url=${appUrl}" />
<script>window.location.replace(${JSON.stringify(appUrl)});</script>
</head>
<body>Redirecting to ${escapeHtml(nick)}…</body>
</html>`);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
