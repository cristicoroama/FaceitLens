// Vercel serverless function. Serves per-player Open Graph tags for link
// previews (Discord/WhatsApp), then redirects real users to the SPA.
// Needs env var BACKEND_URL = https://<your-service>.onrender.com

export default async function handler(req, res) {
  const nick = (req.query.nick || "").toString();
  const backend = process.env.BACKEND_URL || "";
  const appUrl = `/player/${encodeURIComponent(nick)}`;

  let title = "FaceitLens — FACEIT CS2 Stats & Account Checker";
  let desc = "Scan any CS2 player: ELO, K/D, trust score, inventory and Leetify stats.";
  let image = "https://faceit-lens.com/og.png";
  let card = "summary_large_image";

  try {
    if (backend && nick) {
      const r = await fetch(`${backend}/api/player/${encodeURIComponent(nick)}/`);
      if (r.ok) {
        const p = await r.json();
        title = `${p.nickname} — Level ${p.skill_level ?? "?"} · ${p.elo ?? "?"} FACEIT ELO`;
        const wr = p.stats?.win_rate ? `${p.stats.win_rate}% win rate` : "";
        const kd = p.stats?.avg_kd ? `${p.stats.avg_kd} K/D` : "";
        const hs = p.stats?.avg_hs ? `${p.stats.avg_hs}% HS` : "";
        const matches = p.stats?.matches ? `${p.stats.matches} matches` : "";
        desc =
          [wr, kd, hs, matches].filter(Boolean).join(" · ") ||
          `View ${p.nickname}'s full FACEIT CS2 stats, trust score and match history on FaceitLens.`;
        // Use the player's avatar as the preview when we have it (square card);
        // otherwise keep the branded large card.
        if (p.avatar) {
          image = p.avatar;
          card = "summary";
        }
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
<meta property="og:site_name" content="FaceitLens" />
<meta property="og:url" content="https://faceit-lens.com${appUrl}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta name="theme-color" content="#8b5cf6" />
<meta name="twitter:card" content="${card}" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(desc)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
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
