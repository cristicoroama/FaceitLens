import { useState, useEffect, useRef } from "react";

/** The two themes. `dot` drives the swatch preview in the menu; the actual
    colors live in index.css under :root (dark) and :root[data-theme="light"].

    This used to be eight palettes. That sounds generous but it meant no
    surface could assume a background, so everything defended itself with a
    border and a glow — which is most of why the old UI read as noisy. */
export const THEMES = [
  { id: "dark", label: "Dark", dot: "#0a0a0c", dot2: "#ff6a21" },
  { id: "light", label: "Light", dot: "#ffffff", dot2: "#d94f00" },
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
