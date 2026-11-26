import { useCallback, useEffect, useId, useRef, useState } from "react";

export default function useListNav({ count, onSelect, onEscape, initial = 0, enabled = true }) {
  const [active, setActive] = useState(initial);
  const listRef = useRef(null);
  const baseId = useId().replace(/:/g, "");

  useEffect(() => { setActive(initial); }, [count, initial]);

  useEffect(() => {
    if (!enabled || active < 0) return;
    const el = listRef.current?.querySelector(`[data-nav-index="${active}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [active, enabled]);

  const optionId = useCallback((i) => `${baseId}-opt-${i}`, [baseId]);

  const onKeyDown = useCallback((e) => {
    if (e.key === "ArrowDown") {
      if (!count) return;
      e.preventDefault();
      setActive((a) => (a + 1 >= count ? 0 : a + 1));
    } else if (e.key === "ArrowUp") {
      if (!count) return;
      e.preventDefault();
      setActive((a) => (a <= 0 ? count - 1 : a - 1));
    } else if (e.key === "Home" && count && e.ctrlKey) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && count && e.ctrlKey) {
      e.preventDefault();
      setActive(count - 1);
    } else if (e.key === "Enter") {
      if (onSelect) onSelect(active, e);
    } else if (e.key === "Escape") {
      if (onEscape) onEscape(e);
    }
  }, [count, active, onSelect, onEscape]);

  return {
    active,
    setActive,
    onKeyDown,
    listRef,
    listId: `${baseId}-list`,
    optionId,
    activeId: active >= 0 && active < count ? optionId(active) : undefined,
  };
}
