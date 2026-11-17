import { useMemo, useState } from "react";

const REASON_MSG = {
  unreachable: "FACEIT's inventory data didn't respond. Try again in a moment.",
  no_data: "FACEIT has no inventory snapshot for this player yet.",
  no_faceit: "No linked FACEIT account, so there's no inventory to show.",
  no_player: "No inventory to show for this player.",
};

const CATS = [
  ["all", "All"], ["knife", "Knives"], ["gloves", "Gloves"], ["rifle", "Rifles"],
  ["pistol", "Pistols"], ["smg", "SMGs"], ["heavy", "Heavy"],
];

const WEAR_EDGES = [0.07, 0.15, 0.38, 0.45];

function splitName(name = "") {
  const clean = name.replace(/^★\s*/, "").replace(/^StatTrak™\s*/, "").replace(/^Souvenir\s*/, "");
  const [weapon, skin] = clean.split(" | ");
  return { weapon, skin: skin || null, star: name.startsWith("★") };
}

function ago(iso) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (Number.isNaN(days) || days < 0) return null;
  if (days < 1) return "today";
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

function FloatBar({ wear }) {
  if (!wear) return null;
  const v = Math.max(0, Math.min(1, wear.value));
  return (
    <div className="inv-float" title={`Float ${wear.value}`}>
      <div className="inv-float-top">
        <span className="inv-float-tier" style={{ color: wear.color || undefined }}>{wear.tier}</span>
        <span className="inv-float-val">{wear.value.toFixed(4)}</span>
      </div>
      <div className="inv-float-track">
        {WEAR_EDGES.map((e) => <i key={e} className="inv-float-edge" style={{ left: `${e * 100}%` }} />)}
        <i className="inv-float-mark" style={{ left: `${v * 100}%` }} />
      </div>
    </div>
  );
}

function Marks({ list, kind }) {
  if (!list?.length) return null;
  return (
    <div className={`inv-marks inv-marks-${kind}`}>
      {list.map((m, i) => (
        m.icon
          ? <img key={i} src={m.icon} alt={m.name} title={m.name} loading="lazy" />
          : <span key={i} title={m.name}>{m.name}</span>
      ))}
    </div>
  );
}

function Item({ it }) {
  const { weapon, skin } = splitName(it.name);
  return (
    <div className="inv-item" style={{ "--rar": it.rarity?.color || "var(--border)" }}
         title={`${it.name}${it.rarity?.name ? ` · ${it.rarity.name}` : ""}`}>
      <div className="inv-tags">
        {it.stattrak_kills != null && <span className="inv-tag st">ST {it.stattrak_kills.toLocaleString()}</span>}
        {it.souvenir && <span className="inv-tag sv">Souvenir</span>}
      </div>
      {it.icon ? <img src={it.icon} alt="" loading="lazy" /> : <div className="inv-noimg" />}
      <div className="inv-name">
        <span className="inv-weapon">{weapon}</span>
        {skin && <span className="inv-skin">{skin}</span>}
      </div>
      <FloatBar wear={it.wear} />
      {it.pattern != null && <div className="inv-pattern">Pattern {it.pattern}</div>}
      <Marks list={it.stickers} kind="stickers" />
      <Marks list={it.charms} kind="charms" />
    </div>
  );
}

function Highlight({ label, item, value }) {
  if (!item) return null;
  const { weapon, skin } = splitName(item.name);
  return (
    <div className="inv-hl-card" style={{ "--rar": item.rarity?.color || "var(--border)" }}>
      <div className="inv-hl-text">
        <span className="inv-hl-label">{label}</span>
        <span className="inv-hl-name">{weapon}{skin ? ` | ${skin}` : ""}</span>
        <span className="inv-hl-val">{value}</span>
      </div>
      {item.icon && <img src={item.icon} alt="" loading="lazy" />}
    </div>
  );
}

function Breakdown({ rows, total }) {
  const used = rows.filter((r) => r.count > 0);
  if (!used.length || !total) return null;
  return (
    <div className="inv-rar">
      <div className="inv-rar-bar">
        {used.map((r) => (
          <i key={r.name} title={`${r.name}: ${r.count}`}
             style={{ flexGrow: r.count, background: `var(--r-${r.grade}, var(--border-hi))` }} />
        ))}
      </div>
      <div className="inv-rar-legend">
        {used.map((r) => (
          <span key={r.name}>
            <i style={{ background: `var(--r-${r.grade}, var(--border-hi))` }} />
            <b>{r.count}</b> {r.name.replace(" Grade", "")}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Inventory({ inventory, onRetry, retrying }) {
  const [cat, setCat] = useState("all");
  const items = inventory?.items || [];

  const cats = useMemo(() => {
    const have = new Set(items.map((i) => i.category));
    return CATS.filter(([k]) => k === "all" || have.has(k));
  }, [items]);

  const shown = cat === "all" ? items : items.filter((i) => i.category === cat);

  if (!inventory?.available) {
    const reason = inventory?.reason;
    return (
      <div className="state">
        {REASON_MSG[reason] || "No inventory data available."}
        {onRetry && reason === "unreachable" && (
          <div style={{ marginTop: 14 }}>
            <button className="act-btn" onClick={onRetry} disabled={retrying}>
              {retrying ? "Retrying…" : "Retry"}
            </button>
          </div>
        )}
      </div>
    );
  }

  const { highlights = {}, counts = {}, rarity_breakdown = [] } = inventory;
  const updated = ago(inventory.updated_at);

  return (
    <div className="inv">
      <div className="inv-head">
        <span className="section-title">Inventory</span>
        <span className="inv-head-count">{counts.total} items</span>
        {/* The snapshot's age, said out loud: these are FACEIT's numbers from
            whenever they last scanned, not the live inventory. */}
        {updated && <span className="inv-head-note">FACEIT snapshot · {updated}</span>}
      </div>

      <div className="inv-hl">
        <Highlight label="Rarest" item={highlights.rarest}
                   value={highlights.rarest?.rarity?.name} />
        <Highlight label="Lowest float" item={highlights.lowest_float}
                   value={highlights.lowest_float && `${highlights.lowest_float.wear.tier} ${highlights.lowest_float.wear.value.toFixed(4)}`} />
        <Highlight label="Top StatTrak" item={highlights.top_stattrak}
                   value={highlights.top_stattrak && `${highlights.top_stattrak.stattrak_kills.toLocaleString()} kills`} />
      </div>

      <Breakdown rows={rarity_breakdown} total={counts.total} />

      {cats.length > 2 && (
        <div className="inv-filters">
          {cats.map(([k, label]) => (
            <button key={k} type="button" className={`inv-filter ${cat === k ? "on" : ""}`}
                    onClick={() => setCat(k)}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="inv-grid">
        {shown.map((it) => <Item it={it} key={it.id} />)}
      </div>

      {inventory.truncated && (
        <div className="inv-head-note">
          Showing {counts.shown} of {counts.total}. FACEIT returned the rest in pages we didn't reach.
        </div>
      )}
    </div>
  );
}
