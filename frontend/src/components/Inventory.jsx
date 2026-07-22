function Item({ it, big }) {
  const color = it.color || "var(--border)";
  const price = it.price != null ? `$${it.price.toFixed(2)}` : null;
  return (
    <div
      className={`inv-item ${big ? "big" : ""}`}
      title={`${it.name}${it.rarity ? ` · ${it.rarity}` : ""}${price ? ` · ${price}` : ""}`}
      style={{ "--rar": color }}
    >
      {it.image ? (
        <img src={it.image} alt={it.name} loading="lazy" />
      ) : (
        <div className="inv-noimg" />
      )}
      <div className="inv-name">{it.name}</div>
      {price && <div className="inv-price">{price}</div>}
    </div>
  );
}

const REASON_MSG = {
  private: "This player's Steam inventory is private.",
  empty: "This player's Steam inventory is private or empty.",
  ssl: "Couldn't reach Steam (TLS/proxy). Behind a corporate proxy? Set STEAM_INSECURE=1 on the backend.",
  network: "Couldn't reach Steam right now (network error).",
  ratelimited: "Steam is rate-limiting inventory requests. Give it a few minutes — once it loads, it's cached for hours.",
  throttled: "Steam throttled the request — try again in a few minutes.",
  proxy_auth: "Inventory proxy key rejected — check STEAMWEBAPI_KEY on the backend.",
  proxy_quota: "Inventory proxy is out of credits for now — try again later.",
  "no steamid": "No linked Steam account found for this player.",
};

const TRANSIENT = new Set(["ratelimited", "throttled", "network", "ssl"]);

export default function Inventory({ inventory, onRetry, retrying }) {
  if (!inventory || !inventory.available) {
    const reason = inventory && inventory.reason;
    const msg =
      (reason && (REASON_MSG[reason] || (reason.startsWith("http")
        ? "Steam returned an unexpected response."
        : "Inventory unavailable."))) ||
      (inventory && inventory.private
        ? "This player's Steam inventory is private."
        : "No inventory data available.");
    const canRetry = onRetry && reason && TRANSIENT.has(reason);
    return (
      <div className="state">
        {msg}
        {canRetry && (
          <div style={{ marginTop: 14 }}>
            <button className="act-btn" onClick={onRetry} disabled={retrying}>
              {retrying ? "Retrying…" : "↻ Retry now"}
            </button>
          </div>
        )}
      </div>
    );
  }
  const { special = [], weapons = [], counts = {}, value } = inventory;

  const countChips = [
    ["Total", counts.total],
    ["Skins", counts.weapons],
    ["Stickers", counts.stickers],
    ["Graffiti", counts.graffiti],
  ].filter(([, v]) => v != null);

  return (
    <>
      {value && value.total > 0 && (
        <div className="inv-value">
          <span className="inv-value-num">≈ ${value.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          <span className="inv-value-label">
            inventory value · {value.priced_items} priced items · Steam Market
          </span>
          <span className="inv-counts">
            {countChips.map(([label, v]) => (
              <span key={label} className="inv-count">
                <b>{v}</b> {label}
              </span>
            ))}
          </span>
        </div>
      )}

      {special.length > 0 && (
        <>
          <div className="section-title">Knife &amp; Gloves</div>
          <div className="inv-grid special">
            {special.map((it, i) => (
              <Item it={it} big key={i} />
            ))}
          </div>
        </>
      )}

      <div className="section-title">
        Skins <span className="section-count">{counts.weapons || weapons.length}</span>
      </div>
      {weapons.length === 0 ? (
        <div className="state">No skins in inventory.</div>
      ) : (
        <div className="inv-grid">
          {weapons.map((it, i) => (
            <Item it={it} key={i} />
          ))}
        </div>
      )}

      {(!value || !value.total) && countChips.length > 0 && (
        <div className="inv-counts">
          {countChips.map(([label, v]) => (
            <span key={label} className="inv-count">
              <b>{v}</b> {label}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
