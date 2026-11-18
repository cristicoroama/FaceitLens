document.getElementById("f").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = document.getElementById("q").value.trim();
  if (!v) return;
  const site = "https://faceit-lens.com";
  let url;
  if (/faceit\.com\/.*\/room\//i.test(v)) url = `${site}/matchroom?room=${encodeURIComponent(v)}`;
  else if (/7656\d{13}/.test(v)) url = `${site}/steam/${v.match(/7656\d{13}/)[0]}`;
  else {
    const m = v.match(/players?\/([^/?#\s]+)/i);
    url = `${site}/player/${encodeURIComponent(m ? decodeURIComponent(m[1]) : v)}`;
  }
  chrome.tabs.create({ url });
});
