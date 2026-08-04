export const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * Fetch JSON, failing with something a person can read.
 *
 * `await resp.json()` on an empty or non-JSON body throws
 * "Failed to execute 'json' on 'Response': Unexpected end of JSON input",
 * which is what a visitor saw whenever the API was down — a browser internal
 * presented as if it were the site's own message.
 */
export async function getJson(path) {
  let resp;
  try {
    resp = await fetch(`${API_BASE}${path}`);
  } catch {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }

  let json = null;
  try {
    json = await resp.json();
  } catch {
    throw new Error(
      resp.ok
        ? "The server sent something unreadable. Try again in a moment."
        : `The server is having trouble (${resp.status}). Try again shortly.`,
    );
  }

  if (!resp.ok) throw new Error(json?.error || `Error ${resp.status}`);
  return json;
}
