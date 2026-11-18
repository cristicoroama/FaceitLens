(() => {
  const SITE = "https://faceit-lens.com";
  const ICON = chrome.runtime.getURL("icons/icon32.png");
  let lastUrl = "";
  let hidden = false;

  function target() {
    const path = location.pathname;
    const room = path.match(/\/(?:cs2|csgo)\/room\/([0-9a-z-]+)/i);
    if (room) {
      return {
        href: `${SITE}/matchroom?room=${encodeURIComponent(location.href.split("?")[0])}`,
        label: "Scout lobby on",
      };
    }
    const pl = path.match(/\/players?\/([^/]+)/i);
    if (pl) {
      return { href: `${SITE}/player/${encodeURIComponent(decodeURIComponent(pl[1]))}`, label: "Open stats on" };
    }
    return null;
  }

  function render() {
    document.querySelectorAll(".fl-ext-btn, .fl-ext-x").forEach((n) => n.remove());
    if (hidden) return;
    const t = target();
    if (!t) return;
    const a = document.createElement("a");
    a.className = "fl-ext-btn";
    a.href = t.href;
    a.target = "_blank";
    a.rel = "noopener";
    const img = document.createElement("img");
    img.src = ICON;
    img.alt = "";
    const span = document.createElement("span");
    span.append(`${t.label} `);
    const b = document.createElement("b");
    b.textContent = "FaceitLens";
    span.append(b);
    a.append(img, span);
    const x = document.createElement("button");
    x.className = "fl-ext-x";
    x.type = "button";
    x.title = "Hide until reload";
    x.textContent = "×";
    x.addEventListener("click", () => { hidden = true; render(); });
    document.body.append(a, x);
  }

  function tick() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      render();
    }
  }

  tick();
  setInterval(tick, 800);
})();
