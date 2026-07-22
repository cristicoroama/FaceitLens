import { useState, useEffect, useRef } from "react";

/** All selectable themes. `dot`/`dot2` drive the swatch preview in the menu;
    the actual colors live in index.css under :root[data-theme="id"]. */
export const THEMES = [
  { id: "dark", label: "Aurora", dot: "#8b5cf6", dot2: "#22d3ee" },
  { id: "volt", label: "Volt Green", dot: "#00e888", dot2: "#38bdf8" },
  { id: "purple", label: "Nebula", dot: "#d946ef", dot2: "#818cf8" },
  { id: "crimson", label: "Inferno", dot: "#ff4d6d", dot2: "#ffb020" },
  { id: "ocean", label: "Deep Ocean", dot: "#38bdf8", dot2: "#818cf8" },
  { id: "gold", label: "Solar Gold", dot: "#fbbf24", dot2: "#fb7185" },
  { id: "light", label: "Daylight", dot: "#7c3aed", dot2: "#0891b2" },
];

export default function ThemeMenu({ theme, setTheme }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <div className="theme-menu" ref={ref}>
      <button
        className="tb-btn theme-trigger"
        onClick={() => setOpen((o) => !o)}
        title="Change theme"
      >
        <span className="theme-swatch" style={{ background: `linear-gradient(135deg, ${current.dot}, ${current.dot2})` }} />
        <span className="theme-trigger-label">{current.label}</span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="theme-pop">
          <div className="theme-pop-title">Theme</div>
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-opt ${theme === t.id ? "active" : ""}`}
              onClick={() => { setTheme(t.id); setOpen(false); }}
            >
              <span className="theme-swatch" style={{ background: `linear-gradient(135deg, ${t.dot}, ${t.dot2})` }} />
              {t.label}
              {theme === t.id && <span className="theme-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
