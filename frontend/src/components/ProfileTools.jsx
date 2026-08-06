import { useState, useEffect, useRef } from "react";
import { Icon } from "../icons.jsx";

/**
 * The four things that *generate* something about a player — a report, a roast,
 * an image, a recap — behind one menu.
 *
 * They used to sit in the header as six equal buttons alongside Favorite and
 * Share. Six buttons of the same weight rank nothing, and four of those six
 * only matter once you've already decided you care about this player. Favorite
 * and Share stay outside because they act on the page you're looking at; these
 * four make something new, so they group.
 */
export default function ProfileTools({
  onAnalyze, aiLoading,
  onRoast, roastLoading,
  onShareCard, onWrapped,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const items = [
    {
      key: "ai",
      icon: Icon.stars,
      label: aiLoading ? "Analyzing…" : "AI Analysis",
      hint: "A scouting report on this player's game",
      run: onAnalyze,
      busy: aiLoading,
    },
    {
      key: "roast",
      icon: Icon.fire,
      label: roastLoading ? "Cooking…" : "Roast me",
      hint: "The same stats, considerably less kind",
      run: onRoast,
      busy: roastLoading,
    },
    {
      key: "card",
      icon: Icon.cardImage,
      label: "Share card",
      hint: "A image of this profile, for posting",
      run: onShareCard,
    },
    {
      key: "wrapped",
      icon: Icon.cameraReels,
      label: "Wrapped",
      hint: "The year as a story, one stat at a time",
      run: onWrapped,
    },
  ];

  return (
    <div className="ptools" ref={ref}>
      <button
        className={`act-btn ptools-trigger ${open ? "on" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {Icon.stars}
        Generate
        <svg className="ptools-caret" viewBox="0 0 24 24" width="11" height="11"
             fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="ptools-menu" role="menu">
          {items.map((it) => (
            <button
              key={it.key}
              className="ptools-item"
              role="menuitem"
              disabled={it.busy}
              onClick={() => { it.run(); setOpen(false); }}
            >
              <span className="ptools-ic">{it.icon}</span>
              <span className="ptools-text">
                <span className="ptools-label">{it.label}</span>
                <span className="ptools-hint">{it.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
