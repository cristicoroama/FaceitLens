import { useState, useMemo } from "react";
import { PRO_SETTINGS } from "../prosettings-data.js";
import { Flag } from "./RankIcons.jsx";

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <div className="ps-d">
      <span className="ps-d-label">{label}</span>
      <span className="ps-d-value">{value}</span>
    </div>
  );
}

function Row({ p, open, onToggle }) {
  return (
    <div className={`ps-block ${open ? "open" : ""}`}>
      <div className="ps-row2" onClick={onToggle}>
        <span className="ps-name">
          <Flag country={p.country} size={16} />{p.nick}
          {p.team && <span className="ps-team">{p.team}</span>}
        </span>
        <span className="ps-role hide-sm">{p.role}</span>
        <span className="ps-mono">{p.sens}</span>
        <span className="ps-mono">{p.dpi}</span>
        <span className="ps-mono ps-edpi">{p.edpi}</span>
        <span className="ps-mono hide-sm">{p.res}</span>
        <span className="ps-mono hide-sm">{p.hz ? `${p.hz}Hz` : "—"}</span>
        <span className="ps-chev">▾</span>
      </div>
      {open && (
        <div className="ps-detail">
          <Detail label="Mouse" value={p.mouse} />
          <Detail label="Monitor" value={p.monitor} />
          <Detail label="GPU" value={p.gpu} />
          <Detail label="Keyboard" value={p.keyboard} />
          <Detail label="Mousepad" value={p.mousepad} />
          <Detail label="Headset" value={p.headset} />
          <Detail label="Chair" value={p.chair} />
          <Detail label="Zoom sens" value={p.zoom} />
          <Detail label="Aspect ratio" value={p.ratio} />
          <Detail label="Scaling" value={p.scaling} />
          <Detail label="Resolution" value={p.res} />
          <Detail label="Polling" value={p.hz ? `${p.hz} Hz` : null} />
        </div>
      )}
    </div>
  );
}

export default function ProSettings() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("nick");
  const [open, setOpen] = useState(null);

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
      if (sort === "team") return (a.team || "").localeCompare(b.team || "");
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
          Full CS2 pro settings &amp; gear — sensitivity, DPI, eDPI, resolution plus
          mouse, monitor, GPU, keyboard, mousepad and headset. Click a player for the
          full setup.
        </div>
      </div>

      <div className="lb-controls">
        <input type="text" placeholder="Search pro or team…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="map-filter" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="nick">Sort: Name</option>
          <option value="team">Sort: Team</option>
          <option value="edpi">Sort: eDPI</option>
          <option value="sens">Sort: Sensitivity</option>
        </select>
      </div>

      <div className="ps-table-wrap">
        <div className="ps-row2 ps-head">
          <span>Player</span><span className="hide-sm">Role</span><span>Sens</span><span>DPI</span><span>eDPI</span>
          <span className="hide-sm">Res</span><span className="hide-sm">Poll</span><span />
        </div>
        <div className="stagger">
          {rows.map((p, i) => (
            <Row key={`${p.nick}-${i}`} p={p} open={open === `${p.nick}-${i}`}
              onToggle={() => setOpen(open === `${p.nick}-${i}` ? null : `${p.nick}-${i}`)} />
          ))}
        </div>
      </div>

      <div className="hltv-note" style={{ textAlign: "left", padding: "12px 2px 0" }}>
        Data from <a href="https://prosettings.net/lists/cs2/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>prosettings.net</a> — {rows.length} pros.
        Full gear shown for top-team players; click any row to expand. “Poll” is the mouse polling rate.
      </div>
    </>
  );
}
