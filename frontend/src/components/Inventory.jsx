function Item({ it, big }) {
  const color = it.color || "var(--border)";
  return (
    <div
      className={`inv-item ${big ? "big" : ""}`}
      title={`${it.name}${it.rarity ? ` · ${it.rarity}` : ""}`}
      style={{ "--rar": color }}
    >
      {it.image ? (
        <img src={it.image} alt={it.name} loading="lazy" />
      ) : (
        <div className="inv-noimg" />
      )}
      <div className="inv-name">{it.name}</div>
    </div>
  );
}

export default function Inventory({ inventory }) {
  if (!inventory || !inventory.available) {
    return (
      <div className="state">
        {inventory && inventory.private
          ? "This player's Steam inventory is private."
          : "No inventory data available."}
      </div>
    );
  }
  const { special = [], weapons = [], counts = {} } = inventory;

  return (
    <>
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

      <div className="inv-counts">
        {[
          ["Total", counts.total],
          ["Skins", counts.weapons],
          ["Stickers", counts.stickers],
          ["Graffiti", counts.graffiti],
        ]
          .filter(([, v]) => v != null)
          .map(([label, v]) => (
            <span key={label} className="inv-count">
              <b>{v}</b> {label}
            </span>
          ))}
      </div>
    </>
  );
}
