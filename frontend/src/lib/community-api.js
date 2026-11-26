import { useEffect, useState } from "react";

export const API_BASE = import.meta.env.VITE_API_URL || "";

export async function communityJson(path, options = {}) {
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
    throw err;
  }
  return json || {};
}

const memo = new Map();

export function cachedJson(path, ttl = 5 * 60 * 1000) {
  const hit = memo.get(path);
  if (hit && Date.now() - hit.at < ttl) return hit.promise;
  const promise = communityJson(path).catch((e) => {
    memo.delete(path);
    throw e;
  });
  memo.set(path, { at: Date.now(), promise });
  return promise;
}

export function useCommunityData(path) {
  const [state, setState] = useState({ data: null, error: null, loading: !!path });
  useEffect(() => {
    if (!path) {
      setState({ data: null, error: null, loading: false });
      return undefined;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    cachedJson(path)
      .then((data) => { if (alive) setState({ data, error: null, loading: false }); })
      .catch((error) => { if (alive) setState({ data: null, error, loading: false }); });
    return () => { alive = false; };
  }, [path]);
  return state;
}

export function synergyPath(nickname) {
  return nickname ? `/api/player/${encodeURIComponent(nickname)}/synergy/` : null;
}

export function sendGoal(method, path, body) {
  return communityJson(path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function fmtSigned(n, digits = 0) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n).toFixed(digits);
  return Number(n) > 0 ? `+${v}` : v;
}

export function agoShort(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
