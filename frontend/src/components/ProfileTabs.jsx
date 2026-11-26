import { useEffect, useRef, useState } from "react";

export default function ProfileTabs({ primary, more, active, onTab, moreLabel, menuLabel }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const focusOnOpen = useRef("first");
  const activeMore = more.find(([k]) => k === active);

  useEffect(() => {
    if (!open) return undefined;
    const items = [...(menuRef.current?.querySelectorAll("[role='menuitem']") || [])];
    const idx = focusOnOpen.current === "last" ? items.length - 1 : Math.max(0, items.findIndex((el) => el.dataset.tab === active));
    items[idx]?.focus();
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function choose(k) {
    setOpen(false);
    onTab(k);
    btnRef.current?.focus();
  }

  function onMenuKey(e) {
    const items = [...(menuRef.current?.querySelectorAll("[role='menuitem']") || [])];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      btnRef.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="sh-ptabs-wrap" ref={wrapRef}>
      <div className="ptabs sh-ptabs" role="navigation" aria-label={menuLabel}>
        {primary.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`ptab ${active === key ? "active" : ""}`}
            onClick={() => onTab(key)}
            aria-current={active === key ? "page" : undefined}
          >
            {label}
          </button>
        ))}
        {more.length > 0 && (
          <button
            ref={btnRef}
            type="button"
            className={`ptab sh-ptab-more ${activeMore ? "active" : ""} ${open ? "open" : ""}`}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-current={activeMore ? "page" : undefined}
            onClick={() => { focusOnOpen.current = "active"; setOpen((o) => !o); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                focusOnOpen.current = e.key === "ArrowUp" ? "last" : "first";
                setOpen(true);
              }
            }}
          >
            {activeMore ? activeMore[1] : moreLabel}
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" aria-hidden="true"
                 stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        )}
      </div>
      {open && (
        <div className="sh-ptabs-menu" role="menu" aria-label={moreLabel} ref={menuRef} onKeyDown={onMenuKey}>
          {more.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              data-tab={key}
              tabIndex={-1}
              className={`sh-ptabs-item ${active === key ? "on" : ""}`}
              aria-current={active === key ? "page" : undefined}
              onClick={() => choose(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
