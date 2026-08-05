import { useState, useRef, useEffect } from "react";

/**
 * Sponsor placements.
 *
 * A note on what went wrong before, so it doesn't get reintroduced: this used
 * to run an ad-block *detector* — a bait element with class names like
 * "adsbox" — and hide the slot whenever the bait got hidden. Brave hides that
 * bait, so the slot vanished for every Brave user even though the advertiser's
 * frame loads there perfectly well. The detector was blocking the ads, not the
 * browser. It's gone.
 *
 * What's left is deliberately plain: the advertiser's frame, first-party
 * fallback art under a normal image path, and no ad- prefixed class names to
 * trip cosmetic filters that were never aimed at us.
 *
 * The frame is still sandboxed WITHOUT allow-same-origin, so the advertiser's
 * code sits on an opaque origin and can't reach our cookies, session or
 * localStorage. It renders and animates fine that way — verified in the wild.
 *
 * The "Sponsored" marker stays, and the affiliate link carries rel="sponsored"
 * as Google requires. Paid placement should read as paid placement.
 */

const AFFILIATE = "https://hunt.gg/r/FACEITLENS";
const FRAME_SRC =
  "https://case-ad.hunt.gg?code=FACEITLENS&campaign_id=6a7346946c23fb0012a60fd9";

function Tag() {
  return <span className="partner-tag">Sponsored</span>;
}

/** Shown only if the frame genuinely never loads (advertiser down, offline). */
function Fallback({ art, width, height }) {
  const [dead, setDead] = useState(false);
  if (dead) return null;
  return (
    <a
      className="partner-link"
      href={AFFILIATE}
      target="_blank"
      rel="noopener noreferrer sponsored"
    >
      <img
        src={`/img/partner/${art}.webp`}
        srcSet={`/img/partner/${art}.webp 1x, /img/partner/${art}@2x.webp 2x`}
        width={width}
        height={height}
        alt="Hunt.gg — open CS2 cases with code FACEITLENS"
        loading="lazy"
        decoding="async"
        onError={() => setDead(true)}
      />
    </a>
  );
}

function Slot({ className }) {
  const [failed, setFailed] = useState(false);
  const frameRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!frameRef.current?.dataset.loaded) setFailed(true);
    }, 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`partner ${className || ""}`}>
      <Tag />
      {failed ? (
        <>
          <div className="partner-wide">
            <Fallback art="leaderboard" width={970} height={90} />
          </div>
          <div className="partner-narrow">
            <Fallback art="mobile" width={300} height={100} />
          </div>
        </>
      ) : (
        <iframe
          ref={frameRef}
          className="partner-frame"
          title="hunt.gg"
          src={FRAME_SRC}
          loading="lazy"
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={(e) => { e.currentTarget.dataset.loaded = "1"; }}
        />
      )}
    </div>
  );
}

/** Home page, between the recent searches and the feature grid. */
export function AdBanner() {
  return <Slot />;
}

/** Player profile, between the tab bar and whichever tab is open. */
export function AdInline() {
  return <Slot className="partner-inline" />;
}

export default AdBanner;
