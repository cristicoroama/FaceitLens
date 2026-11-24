export const LEVELS = [
  { level: 1, min: 100, max: 500 },
  { level: 2, min: 501, max: 750 },
  { level: 3, min: 751, max: 900 },
  { level: 4, min: 901, max: 1050 },
  { level: 5, min: 1051, max: 1200 },
  { level: 6, min: 1201, max: 1350 },
  { level: 7, min: 1351, max: 1530 },
  { level: 8, min: 1531, max: 1750 },
  { level: 9, min: 1751, max: 2000 },
  { level: 10, min: 2001, max: null },
];

export function levelFor(elo) {
  const e = Number(elo);
  if (!Number.isFinite(e)) return null;
  return [...LEVELS].reverse().find((l) => e >= l.min) || LEVELS[0];
}
