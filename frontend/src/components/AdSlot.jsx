import { useState, useEffect, useRef } from "react";

/**
 * Advertising slots.
 *
 * Three things this has to get right:
 *
 * 1. Safety. The interactive unit is a third-party iframe. It runs sandboxed
 *    WITHOUT allow-same-origin, so the advertiser's code lives on its own
 *    opaque origin and can't read our cookies, our session, or localStorage.
 *    It can still run scripts and open links, which is all an ad needs.
 *    Dropping allow-same-origin is the entire point — with it, the sandbox is
 *    decorative.
 *
 * 2. Honesty. Each slot carries a small "Ad" marker. Presenting paid
 *    placement as ordinary site content is a banned practice in the EU, and
 *    affiliate links carry their own disclosure rules. It's kept as quiet as
 *    it can be while still being legible.
 *
 * 3. Not breaking the page. Ad blockers are near-universal in a CS2 audience,
 *    so a blocked slot collapses to a static image or disappears — never
 *    leaves a hole. Sizes are declared up front so nothing reflows when an ad
 *    lands.
 */

const AFFILIATE = "https://hunt.gg/r/FACEITLENS";
const IFRAME_SRC =
  "https://case-ad.hunt.gg?code=FACEITLENS&campaign_id=6a7346946c23fb0012a60fd9";

/** Ad blockers hide elements whose class names look like ad containers. */
function useAdBlocked() {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const bait = document.createElement("div");
    bait.className = "adsbox ad-banner ad-placement pub_300x250";
    bait.style.cssText =
      "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;";
    document.body.appendChild(bait);

    // Blockers apply their rules on the next frame, not synchronously.
    const t = setTimeout(() => {
      setBlocked(
        bait.offsetHeight === 0 ||
        bait.offsetParent === null ||
        getComputedStyle(bait).display === "none"
      );
      bait.remove();
    }, 120);

    return () => { clearTimeout(t); bait.remove(); };
  }, []);

  return blocked;
}

function Label() {
  return <span className="ad-label" aria-label="Advertisement">Ad</span>;
}

function StaticBanner({ stem, width, height }) {
  const [dead, setDead] = useState(false);

  // A blocker that stops the image still leaves the <img> in the page, where
  // it renders as a broken-image icon and alt text. Better to remove the whole
  // slot than to show the wreckage of one.
  if (dead) return null;

  return (
    <a
      className="ad-static"
      href={AFFILIATE}
      target="_blank"
      rel="noopener noreferrer sponsored"
      style={{ maxWidth: width }}
    >
      <img
        src={`/ads/${stem}.webp`}
        srcSet={`/ads/${stem}.webp 1x, /ads/${stem}@2x.webp 2x`}
        width={width}
        height={height}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setDead(true)}
      />
    </a>
  );
}

/**
 * Thin banner for the home page only. 970x90 on desktop, 300x100 on a phone —
 * short enough that it never pushes the search box out of view.
 */
export function AdBanner() {
  const blocked = useAdBlocked();
  if (blocked) return null;   // nothing to fall back to; give the space back

  return (
    <div className="ad-slot ad-banner-slot">
      <Label />
      <div className="ad-wide">
        <StaticBanner stem="hunt-leaderboard" width={970} height={90} />
      </div>
      <div className="ad-narrow">
        <StaticBanner stem="hunt-mobile" width={300} height={100} />
      </div>
    </div>
  );
}

/**
 * The interactive unit, sized down from the advertiser's 800x600 to something
 * that sits inside a stats page without dominating it. The wrapper keeps the
 * 4:3 shape and the iframe fills it, so it scales instead of overflowing.
 */
export function AdInline() {
  const blocked = useAdBlocked();
  const [failed, setFailed] = useState(false);
  const frameRef = useRef(null);

  // If the frame never loads — blocked at the network layer, advertiser down —
  // fall back rather than leaving an empty box for ever.
  useEffect(() => {
    if (blocked) return;
    const t = setTimeout(() => {
      if (!frameRef.current?.dataset.loaded) setFailed(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [blocked]);

  if (blocked || failed) {
    return (
      <div className="ad-slot ad-inline-slot">
        <Label />
        <StaticBanner stem="hunt-rectangle" width={300} height={250} />
      </div>
    );
  }

  return (
    <div className="ad-slot ad-inline-slot">
      <Label />
      <div className="ad-frame-wrap">
        <iframe
          ref={frameRef}
          src={IFRAME_SRC}
          title="Sponsored"
          loading="lazy"
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={(e) => { e.currentTarget.dataset.loaded = "1"; }}
        />
      </div>
    </div>
  );
}

export default AdBanner;
