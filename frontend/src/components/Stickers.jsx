import { useEffect, useMemo, useState } from "react";
import { SINGAPORE_2026 } from "../stickers-singapore2026.js";
import { teamLogo } from "../team-logos.js";

const BASE = "/stickers/singapore2026";

const VARIANTS = [
  ["p", "Paper", ""],
  ["h", "Holo", "holo"],
  ["f", "Foil", "foil"],
  ["g", "Gold", "gold"],
  ["r", "Graffiti", "graffiti"],
];
const SUFFIX = Object.fromEntries(VARIANTS.map(([k, , s]) => [k, s]));
const LABEL = Object.fromEntries(VARIANTS.map(([k, l]) => [k, l]));

const ITEMS = SINGAPORE_2026.map(([kind, code, name, vars]) => ({
  kind: kind === "t" ? "team" : "player", code, name, vars: vars.split(""),
}));

function src(item, v) {
  const stem = `${item.kind === "player" ? "sig_" : ""}${item.code}${SUFFIX[v] ? `_${SUFFIX[v]}` : ""}`;
  return `${BASE}/${stem}.webp`;
}

function maskStyle(url) {
  return { WebkitMaskImage: `url(${url})`, maskImage: `url(${url})` };
}

function Sticker({ item, v, onOpen }) {
  const has = item.vars.includes(v);
  const shown = has ? v : "p";
  return (
    <button type="button" className={`stk-card v-${shown}`} onClick={() => onOpen(item)} title={`${item.name} (${LABEL[shown]})`}>
      <span className="stk-img">
        <img src={src(item, shown)} alt={`${item.name} ${LABEL[shown]} sticker`} loading="lazy" decoding="async" />
        {shown !== "p" && shown !== "r" && <i className="stk-sheen" style={maskStyle(src(item, shown))} aria-hidden="true" />}
      </span>
      <span className="stk-name">{item.name}</span>
      {!has && <span className="stk-note">no {LABEL[v].toLowerCase()}</span>}
    </button>
  );
}

function Viewer({ item, onClose, onStep }) {
  const [v, setV] = useState("p");
  useEffect(() => { setV("p"); }, [item?.code, item?.kind]);
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onStep(1);
      else if (e.key === "ArrowLeft") onStep(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep]);
  if (!item) return null;
  const logo = item.kind === "team" ? teamLogo({ name: item.name }) : null;
  return (
    <div className="stk-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="stk-modal-box" role="dialog" aria-modal="true" aria-label={item.name}>
        <button type="button" className="stk-x" onClick={onClose} aria-label="Close">✕</button>
        <div className="stk-modal-head">
          {logo && <img src={logo} alt="" className="stk-modal-logo" />}
          <div>
            <div className="stk-modal-name">{item.name}</div>
            <div className="stk-modal-sub">PGL Major Singapore 2026 · {item.kind === "team" ? "Team sticker" : "Autograph"}</div>
          </div>
        </div>
        <div className={`stk-big v-${v}`}>
          <img src={src(item, v)} alt={`${item.name} ${LABEL[v]}`} />
          {v !== "p" && v !== "r" && <i className="stk-sheen" style={maskStyle(src(item, v))} aria-hidden="true" />}
          <button type="button" className="stk-nav l" onClick={() => onStep(-1)} aria-label="Previous">‹</button>
          <button type="button" className="stk-nav r" onClick={() => onStep(1)} aria-label="Next">›</button>
        </div>
        <div className="stk-variants">
          {VARIANTS.filter(([k]) => item.vars.includes(k)).map(([k, label]) => (
            <button key={k} type="button" className={`stk-var ${v === k ? "on" : ""}`} onClick={() => setV(k)}>
              <img src={src(item, k)} alt="" loading="lazy" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Stickers({ teamsInStage }) {
  const [kind, setKind] = useState("team");
  const [v, setV] = useState("p");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [stageOnly, setStageOnly] = useState(false);

  const stageNames = useMemo(
    () => new Set((teamsInStage || []).map((t) => (teamLogo(t) || "").toLowerCase()).filter(Boolean)),
    [teamsInStage],
  );

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return ITEMS.filter((it) => it.kind === kind)
      .filter((it) => !s || it.name.toLowerCase().includes(s) || it.code.includes(s))
      .filter((it) => !(stageOnly && kind === "team") || stageNames.has((teamLogo({ name: it.name }) || "").toLowerCase()));
  }, [kind, q, stageOnly, stageNames]);

  const counts = useMemo(() => ({
    team: ITEMS.filter((i) => i.kind === "team").length,
    player: ITEMS.filter((i) => i.kind === "player").length,
  }), []);

  function step(d) {
    if (!open) return;
    const i = list.findIndex((x) => x.code === open.code && x.kind === open.kind);
    const next = list[(i + d + list.length) % list.length];
    if (next) setOpen(next);
  }

  const variants = VARIANTS.filter(([k]) => kind === "team" || k !== "r");

  return (
    <div className="stk">
      <div className="stk-bar">
        <div className="hub-view stk-kind">
          <button type="button" className={`hub-view-opt ${kind === "team" ? "on" : ""}`} onClick={() => setKind("team")}>
            Teams <small>{counts.team}</small>
          </button>
          <button type="button" className={`hub-view-opt ${kind === "player" ? "on" : ""}`} onClick={() => { setKind("player"); if (v === "r") setV("p"); }}>
            Autographs <small>{counts.player}</small>
          </button>
        </div>
        <div className="stk-vchips">
          {variants.map(([k, label]) => (
            <button key={k} type="button" className={`stk-chip c-${k} ${v === k ? "on" : ""}`} onClick={() => setV(k)}>
              {label}
            </button>
          ))}
        </div>
        <input className="stk-search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={kind === "team" ? "Search a team" : "Search a player"} />
        {kind === "team" && stageNames.size > 0 && (
          <label className="stk-check">
            <input type="checkbox" checked={stageOnly} onChange={(e) => setStageOnly(e.target.checked)} />
            Only this stage
          </label>
        )}
      </div>

      {list.length === 0 ? (
        <div className="state">No stickers match.</div>
      ) : (
        <div className={`stk-grid ${kind}`}>
          {list.map((it) => <Sticker key={`${it.kind}-${it.code}`} item={it} v={v} onOpen={setOpen} />)}
        </div>
      )}

      <div className="stk-foot">Sticker artwork from Counter-Strike 2 game files, © Valve and the respective teams and players.</div>

      {open && <Viewer item={open} onClose={() => setOpen(null)} onStep={step} />}
    </div>
  );
}
