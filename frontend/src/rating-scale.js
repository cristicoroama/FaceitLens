const CUTS = {
  kd: [0.7, 0.9, 1.1, 1.35],
  rating: [0.7, 0.9, 1.1, 1.35],
  adr: [60, 70, 85, 100],
  kr: [0.5, 0.65, 0.8, 0.95],
};

export function tier(kind, value) {
  const v = Number(value);
  const cuts = CUTS[kind];
  if (value == null || value === "" || !Number.isFinite(v) || !cuts) return "";
  let t = 1;
  for (const c of cuts) if (v >= c) t += 1;
  return `rs-${t}`;
}

export function tone(value, pivot = 0) {
  const v = Number(value);
  if (value == null || value === "" || !Number.isFinite(v) || v === pivot) return "";
  return v > pivot ? "tone-up" : "tone-down";
}
