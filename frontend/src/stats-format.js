import { DEFAULT_LOCALE, splitLocale } from "./i18n.js";

export function uiLocale() {
  if (typeof document !== "undefined" && document.documentElement.lang) {
    return document.documentElement.lang;
  }
  if (typeof window !== "undefined") return splitLocale(window.location.pathname).locale;
  return DEFAULT_LOCALE;
}

function toDate(value) {
  if (typeof value === "number") return new Date(value * 1000);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(value);
}

export function fmtDate(value, opts = { day: "2-digit", month: "short" }) {
  if (value == null || value === "") return "";
  const d = toDate(value);
  if (isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString(uiLocale(), opts);
  } catch {
    return d.toLocaleDateString(undefined, opts);
  }
}

export function fmtDateTime(value, opts) {
  if (value == null || value === "") return "";
  const d = toDate(value);
  if (isNaN(d.getTime())) return "";
  const o = opts || { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };
  try {
    return d.toLocaleString(uiLocale(), o);
  } catch {
    return d.toLocaleString(undefined, o);
  }
}

export function daysAgoLabel(ts) {
  if (!ts) return null;
  const then = new Date(ts * 1000);
  const now = new Date();
  const a = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((b - a) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return fmtDate(ts);
}

export function snapshotStats(snapshots) {
  const points = (snapshots || [])
    .filter((p) => p && p.date && p.elo != null)
    .map((p) => ({ date: p.date, elo: Number(p.elo) }))
    .filter((p) => Number.isFinite(p.elo))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (points.length < 2) return null;

  let peak = points[0];
  let low = points[0];
  for (const p of points) {
    if (p.elo > peak.elo) peak = p;
    if (p.elo < low.elo) low = p;
  }

  let best = null;
  let worst = null;
  for (let i = 1; i < points.length; i++) {
    const delta = points[i].elo - points[i - 1].elo;
    if (!best || delta > best.delta) best = { date: points[i].date, delta };
    if (!worst || delta < worst.delta) worst = { date: points[i].date, delta };
  }

  let streak = 0;
  for (let i = points.length - 1; i > 0; i--) {
    if (points[i].elo >= points[i - 1].elo) streak += 1;
    else break;
  }

  return {
    current: points[points.length - 1].elo,
    peak,
    low,
    best_day: best && best.delta > 0 ? best : null,
    worst_day: worst && worst.delta < 0 ? worst : null,
    streak,
    days_tracked: points.length,
    since: points[0].date,
  };
}
