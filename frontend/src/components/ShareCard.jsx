import { useEffect, useRef, useState } from "react";
import { Icon } from "../icons.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";
const S = 1080; // square canvas — works for stories, posts, Discord

function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Reads the live theme colors so the card matches the site's current theme. */
function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const g = (v, fb) => (cs.getPropertyValue(v).trim() || fb);
  return {
    accent: g("--accent", "#8b5cf6"),
    accent2: g("--accent-2", "#22d3ee"),
    aurA: g("--aur-a", "#6d28d9"),
    aurB: g("--aur-b", "#0ea5e9"),
    aurC: g("--aur-c", "#db2777"),
  };
}

export default function ShareCard({ player, onClose }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const t = themeColors();
    const s = player.stats || {};
    let cancelled = false;

    function draw(avatarImg) {
      // background
      ctx.fillStyle = "#05060f";
      ctx.fillRect(0, 0, S, S);
      // Aurora blobs.
      //
      // Only drawn for `#rrggbb` values, because the alpha is applied by
      // string concatenation. The theme currently sets --aur-a/b/c to
      // `transparent`, which made this build "transparentcc" and hand it to
      // addColorStop, which throws a SyntaxError — and since that happens
      // inside an effect, the whole card took the page down with it.
      //
      // A decorative gradient must never be able to do that. An unusable
      // value now means one blob fewer, which is exactly what `transparent`
      // was asking for anyway.
      const HEX6 = /^#[0-9a-f]{6}$/i;
      const blob = (x, y, r, col) => {
        if (!HEX6.test(col)) return;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, col + "cc");
        grd.addColorStop(1, col + "00");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, S, S);
      };
      blob(180, 200, 520, t.aurA);
      blob(920, 160, 460, t.aurB);
      blob(780, 940, 560, t.aurC);
      // subtle grid
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= S; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke(); }
      for (let y = 0; y <= S; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); }
      // dark vignette bottom for text legibility
      const vg = ctx.createLinearGradient(0, S * 0.4, 0, S);
      vg.addColorStop(0, "rgba(5,6,15,0)");
      vg.addColorStop(1, "rgba(5,6,15,0.85)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, S, S);

      // brand
      ctx.fillStyle = "#eef0ff";
      ctx.font = "700 40px system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText("Faceit", 70, 66);
      const bw = ctx.measureText("Faceit").width;
      ctx.fillStyle = t.accent;
      ctx.fillText("Lens", 70 + bw, 66);

      // avatar circle
      const ax = S / 2, ay = 340, ar = 130;
      ctx.save();
      ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.closePath();
      // ring
      const ring = ctx.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar);
      ring.addColorStop(0, t.accent); ring.addColorStop(1, t.accent2);
      ctx.strokeStyle = ring; ctx.lineWidth = 8; ctx.stroke();
      ctx.clip();
      if (avatarImg) {
        ctx.drawImage(avatarImg, ax - ar, ay - ar, ar * 2, ar * 2);
      } else {
        ctx.fillStyle = "#121634"; ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
        ctx.fillStyle = t.accent;
        ctx.font = "700 90px system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(initials(player.nickname), ax, ay + 4);
      }
      ctx.restore();

      /* Level badge, on the avatar ring at 4-o'clock — the same place the
         profile header puts it, so the card reads as a picture of the page
         rather than a different design of the same facts.

         Drawn rather than imported: FaceitLevel is an SVG React component,
         and getting one onto a canvas means serialising it, loading it as an
         image and waiting for that too. A disc with a number is what it
         amounts to at this size. */
      const lvl = player.skill_level;
      if (lvl != null) {
        const lx = ax + ar * 0.72, ly = ay + ar * 0.72, lr = 46;
        ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2);
        ctx.fillStyle = "#0d0f1c"; ctx.fill();
        ctx.strokeStyle = t.accent; ctx.lineWidth = 5; ctx.stroke();
        ctx.fillStyle = t.accent;
        ctx.font = "800 46px system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(lvl), lx, ly + 2);
      }

      // name, with the verified tick beside it when the account carries one
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 68px system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
      const nick = player.nickname || "—";
      const nickW = ctx.measureText(nick).width;
      /* Shifted left by half the tick's width so the NAME PLUS TICK is
         centred, not the name alone with a mark hanging off the side. */
      const tickR = player.verified ? 22 : 0;
      const tickGap = player.verified ? 18 : 0;
      ctx.fillText(nick, S / 2 - (tickR * 2 + tickGap) / 2, 500);

      if (player.verified) {
        const vx = S / 2 - (tickR * 2 + tickGap) / 2 + nickW / 2 + tickGap + tickR;
        const vy = 500 + 34;
        ctx.beginPath(); ctx.arc(vx, vy, tickR, 0, Math.PI * 2);
        ctx.fillStyle = t.accent; ctx.fill();
        // the tick itself
        ctx.beginPath();
        ctx.moveTo(vx - 10, vy);
        ctx.lineTo(vx - 3, vy + 8);
        ctx.lineTo(vx + 11, vy - 8);
        ctx.strokeStyle = "#0d0f1c";
        ctx.lineWidth = 5;
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.stroke();
      }

      // level + ELO line
      ctx.fillStyle = t.accent2;
      ctx.font = "700 40px SFMono-Regular, Menlo, Consolas, 'Courier New', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText(`LVL ${player.skill_level ?? "?"}  ·  ${player.elo ?? "?"} ELO`, S / 2, 582);

      // stat tiles
      const tiles = [
        ["WIN RATE", s.win_rate != null ? `${s.win_rate}%` : "—"],
        ["K/D", s.avg_kd ?? "—"],
        ["HS%", s.avg_hs != null ? `${s.avg_hs}%` : "—"],
        ["MATCHES", s.matches ?? "—"],
      ];
      const tw = 220, th = 190, gap = 24;
      const totalW = tiles.length * tw + (tiles.length - 1) * gap;
      let tx = (S - totalW) / 2;
      const ty = 680;
      tiles.forEach(([label, val]) => {
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        roundRect(ctx, tx, ty, tw, th, 22); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1.5;
        roundRect(ctx, tx, ty, tw, th, 22); ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 52px SFMono-Regular, Menlo, Consolas, 'Courier New', monospace";
        ctx.textBaseline = "middle";
        ctx.fillText(String(val), tx + tw / 2, ty + th / 2 - 8);
        ctx.fillStyle = "#8e95c4";
        ctx.font = "700 22px system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
        ctx.fillText(label, tx + tw / 2, ty + th - 34);
        tx += tw + gap;
      });

      // footer url
      ctx.fillStyle = t.accent;
      ctx.font = "600 34px SFMono-Regular, Menlo, Consolas, 'Courier New', monospace";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`faceit-lens.com/player/${player.nickname}`, S / 2, S - 60);

      // export — if the avatar tainted the canvas, retry without it
      try {
        const data = canvas.toDataURL("image/png");
        if (!cancelled) { setUrl(data); setReady(true); }
      } catch {
        if (avatarImg) draw(null); // tainted → redraw with initials
        else throw new Error("canvas export failed");
      }
    }

    // Load through our own proxy. Straight from FACEIT's CDN the response
    // carries no CORS header, so with crossOrigin set the load simply fails
    // and the card silently fell back to initials every single time.
    /* Every draw goes through here.
       Canvas throws on a surprising range of bad input — an unparseable
       colour, a tainted bitmap, a zero-radius gradient — and this runs inside
       an effect, where an uncaught throw unmounts the tree and blanks the
       page. A share image failing to render is worth a message, not the site. */
    const safeDraw = (img) => {
      try {
        draw(img);
      } catch (err) {
        if (!cancelled) {
          setFailed(true);
          setReady(false);
        }
        console.error("ShareCard: could not render", err);
      }
    };

    if (player.avatar) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => !cancelled && safeDraw(img);
      img.onerror = () => {
        /* Say which URL failed. The fallback to initials is silent by design,
           which meant an avatar that never loaded looked like a styling choice
           for months. The proxy rejects hosts it doesn't recognise, so the URL
           is the one piece of information that identifies the cause. */
        console.warn(
          "ShareCard: avatar failed to load, falling back to initials.",
          { source: player.avatar, via: `${API_BASE}/api/avatar/` }
        );
        if (!cancelled) safeDraw(null);
      };
      img.src = `${API_BASE}/api/avatar/?url=${encodeURIComponent(player.avatar)}`;
    } else {
      safeDraw(null);
    }
    return () => { cancelled = true; };
  }, [player]);

  function download() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `faceitlens-${player.nickname}.png`;
    a.click();
  }

  return (
    <div className="hltv-modal-backdrop" onClick={onClose}>
      <div className="sharecard-modal" onClick={(e) => e.stopPropagation()}>
        <button className="hltv-modal-close" onClick={onClose} title="Close">{Icon.xLg}</button>
        <div className="sharecard-preview">
          <canvas ref={canvasRef} width={S} height={S} className="sharecard-canvas" />
          {!ready && !failed && <div className="sharecard-loading">Rendering card…</div>}
          {failed && (
            <div className="sharecard-loading">
              Couldn't render the card. The rest of the profile is unaffected.
            </div>
          )}
        </div>
        <button className="btn-primary sharecard-dl" onClick={download} disabled={!ready}>
          {Icon.download} Download PNG
        </button>
        <div className="sharecard-hint">Post it on your story, Twitter or Discord.</div>
      </div>
    </div>
  );
}
