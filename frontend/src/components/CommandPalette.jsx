import { useEffect, useMemo, useRef, useState } from "react";
import { FaceitLevel } from "./RankIcons.jsx";
import { PROS } from "../pros-data.js";

const API_BASE = import.meta.env.VITE_API_URL || "";
const RECENT_KEY = "fl_palette_recent";

function readRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 6); } catch { return []; }
}

function pushRecent(nick) {
  try {
    const list = [nick, ...readRecent().filter((n) => n.toLowerCase() !== nick.toLowerCase())].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* storage unavailable */ }
}

function parsePaste(q) {
  const v = q.trim();
  const room = v.match(/faceit\.com\/[a-z-]*\/?(?:cs2|csgo)\/room\/([0-9a-z-]+)/i);
  if (room) return { kind: "room", value: v, label: "Scout this match room" };
  const pl = v.match(/faceit\.com\/[a-z-]*\/?players?\/([^/?#\s]+)/i);
  if (pl) return { kind: "player", value: decodeURIComponent(pl[1]), label: `Open ${decodeURIComponent(pl[1])}` };
  const sid = v.match(/(7656\d{13})/);
  if (sid) return { kind: "steam", value: sid[1], label: "Open Steam profile" };
  const vanity = v.match(/steamcommunity\.com\/id\/([^/?#\s]+)/i);
  if (vanity) return { kind: "steam", value: v, label: "Open Steam profile" };
  return null;
}

export default function CommandPalette({ groups, onPlayer, onNav, onPath }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [players, setPlayers] = useState([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    function onKey(e) {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")
        || document.activeElement?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    function onOpen() { setOpen(true); }
    window.addEventListener("keydown", onKey);
    window.addEventListener("fl:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("fl:palette", onOpen);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQ(""); setPlayers([]); setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    clearTimeout(timer.current);
    const v = q.trim();
    if (v.length < 2 || parsePaste(v)) { setPlayers([]); return undefined; }
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/search/?q=${encodeURIComponent(v)}`);
        const j = await r.json();
        setPlayers(j.items || []);
      } catch { setPlayers([]); }
    }, 200);
    return () => clearTimeout(timer.current);
  }, [q]);

  const pages = useMemo(() => {
    const flat = [];
    for (const g of groups || []) for (const it of g.items || []) if (it.id) flat.push({ ...it, group: g.label });
    return flat;
  }, [groups]);

  const items = useMemo(() => {
    const v = q.trim().toLowerCase();
    const out = [];
    const paste = parsePaste(q);
    if (paste) out.push({ type: "paste", ...paste });
    if (v === "rush b") {
      const lvl10 = PROS[Math.floor(Math.random() * PROS.length)];
      out.push({ type: "player", nickname: lvl10.nickname, hint: "Cyka blyat, no stop" });
    }
    if (!v) {
      for (const n of readRecent()) out.push({ type: "player", nickname: n, hint: "Recent" });
    }
    for (const p of players) out.push({ type: "player", nickname: p.nickname, avatar: p.avatar, level: p.level ?? p.skill_level, elo: p.elo, verified: p.verified });
    if (v && !paste && !players.some((p) => p.nickname?.toLowerCase() === v)) {
      out.push({ type: "player", nickname: q.trim(), hint: "Search exact nickname" });
    }
    const pg = pages.filter((p) => !v || p.label.toLowerCase().includes(v) || (p.hint || "").toLowerCase().includes(v));
    for (const p of pg.slice(0, v ? 6 : 8)) out.push({ type: "page", ...p });
    return out;
  }, [q, players, pages]);

  useEffect(() => { setActive(0); }, [items.length]);

  function run(it) {
    if (!it) return;
    setOpen(false);
    if (it.type === "player") { pushRecent(it.nickname); onPlayer(it.nickname); }
    else if (it.type === "page") onNav(it.id);
    else if (it.kind === "player") { pushRecent(it.value); onPlayer(it.value); }
    else if (it.kind === "room") onPath(`/matchroom?room=${encodeURIComponent(it.value)}`);
    else if (it.kind === "steam") onPath(/^\d+$/.test(it.value) ? `/steam/${it.value}` : `/steam/${encodeURIComponent(it.value)}`);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); run(items[active]); }
  }

  if (!open) return null;

  return (
    <div className="cp-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="cp" role="dialog" aria-modal="true" aria-label="Search">
        <div className="cp-input">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Player, page, or paste a FACEIT / Steam link"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="cp-list" role="listbox">
          {items.length === 0 && <div className="cp-empty">Type a nickname or a page name.</div>}
          {items.map((it, i) => (
            <button
              type="button"
              key={`${it.type}-${it.nickname || it.id || it.value}-${i}`}
              className={`cp-item ${i === active ? "on" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(it)}
              role="option"
              aria-selected={i === active}
            >
              {it.type === "player" ? (
                <>
                  {it.avatar ? <img src={it.avatar} alt="" /> : <span className="cp-ic">@</span>}
                  <span className="cp-main">{it.nickname}</span>
                  {it.hint && <span className="cp-hint">{it.hint}</span>}
                  {it.elo != null && <span className="cp-elo">{it.elo}</span>}
                  {it.level ? <FaceitLevel level={it.level} size={20} /> : null}
                </>
              ) : it.type === "page" ? (
                <>
                  <span className="cp-ic">{it.icon || "›"}</span>
                  <span className="cp-main">{it.label}</span>
                  <span className="cp-hint">{it.group}</span>
                </>
              ) : (
                <>
                  <span className="cp-ic">↵</span>
                  <span className="cp-main">{it.label}</span>
                  <span className="cp-hint">Pasted link</span>
                </>
              )}
            </button>
          ))}
        </div>
        <div className="cp-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>Ctrl</kbd><kbd>K</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}
