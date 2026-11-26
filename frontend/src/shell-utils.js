export const IS_MAC = typeof navigator !== "undefined"
  && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "");

export const SHORTCUT_LABEL = IS_MAC ? "⌘K" : "Ctrl K";

export function isPlainClick(e) {
  return !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0;
}

export function stripLocalePath(pathname) {
  return String(pathname || "/").replace(/^\/(ru|pl|uk)(?=\/|$)/, "") || "/";
}
