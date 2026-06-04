import { useState, useEffect, useRef } from "react";

export default function CountUp({ value, duration = 900 }) {
  const target = Number(value);
  const [display, setDisplay] = useState(Number.isFinite(target) ? 0 : value);
  const raf = useRef(null);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      setDisplay(value ?? "—");
      return;
    }
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(target * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, value, duration]);

  return <>{display}</>;
}
