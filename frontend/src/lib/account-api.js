import { useEffect, useState } from "react";
import { splitLocale } from "../i18n.js";

export const API_BASE = import.meta.env.VITE_API_URL || "";

const DATE_LOCALES = { en: "en-GB", ru: "ru-RU", pl: "pl-PL", uk: "uk-UA" };

export function uiLocale() {
  const path = typeof window === "undefined" ? "/" : window.location.pathname;
  return DATE_LOCALES[splitLocale(path).locale] || "en-GB";
}

export function fmtDay(value, opts = { day: "2-digit", month: "short", year: "numeric" }) {
  if (value == null || value === "") return null;
  const d = typeof value === "number" && value < 1e12 ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(uiLocale(), opts);
}

export async function requestJson(path, options = {}) {
  let resp;
  try {
    resp = await fetch(`${API_BASE}${path}`, options);
  } catch {
    const err = new Error("Can't reach the server. Check your connection and try again.");
    err.status = 0;
    throw err;
  }
  let json = null;
  try { json = await resp.json(); } catch { json = null; }
  if (!resp.ok) {
    const err = new Error(json?.error || `The server is having trouble (${resp.status}). Try again shortly.`);
    err.status = resp.status;
    err.retryAfter = Number(resp.headers.get("Retry-After")) || null;
    err.body = json;
    throw err;
  }
  return json || {};
}

let faceitConfig = null;

export function loadFaceitConfig() {
  if (!faceitConfig) {
    faceitConfig = requestJson("/api/auth/faceit/config/")
      .then((j) => !!j.enabled)
      .catch(() => {
        faceitConfig = null;
        return false;
      });
  }
  return faceitConfig;
}

export const FACEIT_LOGIN_URL = `${API_BASE}/api/auth/faceit/login/`;
export const STEAM_LOGIN_URL = `${API_BASE}/api/auth/steam/login/`;

export function useFaceitLogin() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    loadFaceitConfig().then((on) => { if (alive) setEnabled(on); });
    return () => { alive = false; };
  }, []);
  return enabled;
}

export function countBy(list, pick) {
  const out = {};
  for (const item of list || []) {
    const k = pick(item);
    if (k) out[k] = (out[k] || 0) + 1;
  }
  return out;
}
