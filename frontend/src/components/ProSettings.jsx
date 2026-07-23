import { useState, useMemo } from "react";
import { PRO_SETTINGS } from "../prosettings-data.js";
import { Flag } from "./RankIcons.jsx";

export default function ProSettings() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("nick"); // nick | edpi | sens

  const rows = useMemo(() => {
    let list = PRO_SETTINGS.map((p) => ({ ...p, edpi: Math.round(p.sens * p.dpi) }));
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (p) => p.nick.toLowerCase().includes(query) || (p.team || "").toLowerCase().includes(query)
      );
    }
    list.sort((a, b) => {
      if (sort === "edpi") return a.edpi - b.edpi;
      if (sort === "sens") return a.sens - b.sens;
      return a.nick.localeCompare(b.nick);
    });
    return list;
  }, [q, sort]);

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-title">
          <div className="panel-ic" style={{ width: 38, height: 38 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 18, height: 18 }}>
              <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
            </svg>
          </div>
          Pro <em>Settings</em>
        </div>
        <div className="page-hero-sub">
          Mouse sensitivity, DPI, eDPI, resolution and gear used by the top CS2 pros.
          Copy a setup, then tweak your own in the Crosshair tool.
        </div>
      </div>

      <div className="lb-controls">
        <input
          type="text"
          placeholder="Search pro or team…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="map-filter" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="nick">Sort: Name</option>
          <option value="edpi">Sort: eDPI</option>
          <option value="sens">Sort: Sensitivity</option>
        </select>
      </div>

      <div className="ps-table-wrap">
        <div className="ps-row ps-head">
          <span>Player</span><span>Sens</span><span>DPI</span><span>eDPI</span>
          <span className="hide-sm">Res</span><span className="hide-sm">Hz</span>
          <span className="hide-sm">Mouse</span><span className="hide-sm">Crosshair</span>
        </div>
        <div className="stagger">
          {rows.map((p, i) => (
            <div className="ps-row" key={`${p.nick}-${i}`}>
              <span className="ps-name"><Flag country={p.country} size={16} />{p.nick}
                {p.team && p.team !== "—" && <span className="ps-team">{p.team}</span>}
              </span>
              <span className="ps-mono">{p.sens}</span>
              <span className="ps-mono">{p.dpi}</span>
              <span className="ps-mono ps-edpi">{p.edpi}</span>
              <span className="ps-mono hide-sm">{p.res}</span>
              <span className="ps-mono hide-sm">{p.hz}</span>
              <span className="ps-gear hide-sm">{p.mouse}</span>
              <span className="ps-cross hide-sm">{p.cross}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="hltv-note" style={{ textAlign: "left", padding: "12px 2px 0" }}>
        Community-sourced and approximate — pros change settings often, treat as a
        reference not gospel. Almost everyone plays 400 DPI, 4:3 stretched, 240Hz+.
      </div>
    </>
  );
}
