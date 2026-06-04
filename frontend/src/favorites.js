const KEY = "faceitlens_favorites";

export function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function isFavorite(nick) {
  return getFavorites().some((n) => n.toLowerCase() === nick.toLowerCase());
}

export function toggleFavorite(nick) {
  const favs = getFavorites();
  const i = favs.findIndex((n) => n.toLowerCase() === nick.toLowerCase());
  if (i >= 0) favs.splice(i, 1);
  else favs.unshift(nick);
  localStorage.setItem(KEY, JSON.stringify(favs.slice(0, 12)));
  return getFavorites();
}
