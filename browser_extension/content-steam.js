(() => {
  const SITE = "https://faceit-lens.com";
  const html = document.documentElement.innerHTML;
  const fromUrl = location.pathname.match(/\/profiles\/(7656\d{13})/);
  const fromPage = html.match(/"steamid"\s*:\s*"(7656\d{13})"/);
  const id = (fromUrl && fromUrl[1]) || (fromPage && fromPage[1]);
  if (!id) return;
  const host = document.querySelector(".profile_header_actions") ||
    document.querySelector(".profile_header_summary") ||
    document.querySelector(".profile_header");
  if (!host || host.querySelector(".fl-ext-steam")) return;
  const a = document.createElement("a");
  a.className = "fl-ext-steam";
  a.href = `${SITE}/steam/${id}`;
  a.target = "_blank";
  a.rel = "noopener";
  const img = document.createElement("img");
  img.src = chrome.runtime.getURL("icons/icon32.png");
  img.alt = "";
  a.append(img, "FACEIT stats & trust score");
  host.append(a);
})();
