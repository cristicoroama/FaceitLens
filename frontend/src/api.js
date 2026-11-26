export const API_BASE = import.meta.env.VITE_API_URL || "";

export const DEFAULT_TTL = 60000;

const RETRY_STATUSES = new Set([502, 503, 504]);
const cache = new Map();
const inflight = new Map();

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function abortError() {
  const err = new Error("Aborted");
  err.name = "AbortError";
  return err;
}

export function isAbort(err) {
  return err?.name === "AbortError";
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(abortError());
    }, { once: true });
  });
}

async function attempt(url, init, notFoundMessage) {
  let resp;
  try {
    resp = await fetch(url, init);
  } catch (err) {
    if (isAbort(err)) throw err;
    const e = new ApiError("Can't reach the server. Check your connection and try again.", 0);
    e.retryable = true;
    throw e;
  }

  let json = null;
  try {
    json = await resp.json();
  } catch {
    const e = new ApiError(
      resp.ok
        ? "The server sent something unreadable. Try again in a moment."
        : resp.status === 404 && notFoundMessage
        ? notFoundMessage
        : `The server is having trouble (${resp.status}). Try again shortly.`,
      resp.status,
    );
    e.retryable = RETRY_STATUSES.has(resp.status);
    throw e;
  }

  if (!resp.ok) {
    const e = new ApiError(json?.error || `Error ${resp.status}`, resp.status);
    e.retryable = RETRY_STATUSES.has(resp.status);
    throw e;
  }
  return json;
}

async function fetchWithRetry(url, init, retries, notFoundMessage) {
  for (let i = 0; ; i += 1) {
    try {
      return await attempt(url, init, notFoundMessage);
    } catch (err) {
      if (isAbort(err) || !err.retryable || i >= retries) throw err;
      await wait(900 * (i + 1), init.signal);
    }
  }
}

function subscribe(entry, signal) {
  if (!signal) return entry.promise;
  if (signal.aborted) return Promise.reject(abortError());
  entry.refs += 1;
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      entry.refs -= 1;
      if (entry.refs <= 0 && !entry.settled) {
        entry.controller.abort();
        if (inflight.get(entry.key) === entry) inflight.delete(entry.key);
      }
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    entry.promise.then(
      (v) => { signal.removeEventListener("abort", onAbort); resolve(v); },
      (e) => { signal.removeEventListener("abort", onAbort); reject(e); },
    );
  });
}

export function getJson(path, {
  ttl = DEFAULT_TTL, signal, retry = 1, force = false, credentials, notFoundMessage,
} = {}) {
  const url = /^https?:/i.test(path) ? path : `${API_BASE}${path}`;
  const key = `${credentials || ""}|${url}`;

  if (!force && ttl > 0) {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value);
    if (hit) cache.delete(key);
  }

  let entry = force ? null : inflight.get(key);
  if (!entry) {
    const controller = new AbortController();
    entry = { key, controller, refs: signal ? 0 : 1, settled: false };
    const init = { signal: controller.signal };
    if (credentials) init.credentials = credentials;
    entry.promise = fetchWithRetry(url, init, retry, notFoundMessage).then(
      (value) => {
        entry.settled = true;
        if (inflight.get(key) === entry) inflight.delete(key);
        if (ttl > 0) cache.set(key, { value, expires: Date.now() + ttl });
        return value;
      },
      (err) => {
        entry.settled = true;
        if (inflight.get(key) === entry) inflight.delete(key);
        throw err;
      },
    );
    entry.promise.catch(() => {});
    inflight.set(key, entry);
  } else if (!signal) {
    entry.refs += 1;
  }

  return subscribe(entry, signal);
}

export function primeCache(path, value, ttl = DEFAULT_TTL) {
  const url = /^https?:/i.test(path) ? path : `${API_BASE}${path}`;
  cache.set(`|${url}`, { value, expires: Date.now() + ttl });
}

export function invalidate(prefix = "") {
  const full = `${API_BASE}${prefix}`;
  for (const key of cache.keys()) {
    if (key.slice(key.indexOf("|") + 1).startsWith(full)) cache.delete(key);
  }
}
