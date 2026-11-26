import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "input:not([disabled])", "select:not([disabled])",
  "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusables(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter(
    (el) => !el.hasAttribute("hidden") && el.getClientRects().length > 0,
  );
}

export default function useFocusTrap(ref, active, { onEscape, initialFocus } = {}) {
  const escRef = useRef(onEscape);
  escRef.current = onEscape;

  useEffect(() => {
    if (!active) return undefined;
    const root = ref.current;
    if (!root) return undefined;
    const previous = document.activeElement;

    const target = (initialFocus && root.querySelector(initialFocus)) || focusables(root)[0] || root;
    const id = setTimeout(() => target?.focus?.(), 0);

    function onKey(e) {
      if (e.key === "Escape" && escRef.current) {
        e.preventDefault();
        escRef.current(e);
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables(root);
      if (!list.length) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(id);
      document.removeEventListener("keydown", onKey, true);
      if (previous && typeof previous.focus === "function" && document.contains(previous)) {
        previous.focus();
      }
    };
  }, [active, ref, initialFocus]);
}
