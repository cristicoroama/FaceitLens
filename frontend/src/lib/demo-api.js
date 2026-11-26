import { API_BASE, getJson } from "../api.js";

export function fetchMatchDemo(matchId) {
  return getJson(`/api/match/${encodeURIComponent(matchId)}/demo/`);
}

export async function requestMatchParse(matchId) {
  let resp;
  try {
    resp = await fetch(`${API_BASE}/api/match/${encodeURIComponent(matchId)}/parse/`, {
      method: "POST",
    });
  } catch {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }
  let json = null;
  try {
    json = await resp.json();
  } catch {
    throw new Error(`The server is having trouble (${resp.status}). Try again shortly.`);
  }
  if (!resp.ok) throw new Error(json?.error || `Error ${resp.status}`);
  return json;
}

export function fetchDemoMatches(nickname) {
  return getJson(`/api/player/${encodeURIComponent(nickname)}/demo-matches/`);
}

export function fetchDemoCoach(nickname, { ai = false } = {}) {
  return getJson(`/api/player/${encodeURIComponent(nickname)}/coach/${ai ? "?ai=1" : ""}`);
}
