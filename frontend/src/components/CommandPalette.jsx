import { useEffect, useMemo, useRef, useState } from "react";
import { FaceitLevel } from "./RankIcons.jsx";
import { PROS } from "../pros-data.js";
import { getJson, isAbort } from "../api.js";
import { DEFAULT_LOCALE, makeT } from "../i18n.js";
import useListNav from "../hooks/useListNav.js";
import useFocusTrap from "../hooks/useFocusTrap.js";
import { IS_MAC } from "../shell-utils.js";

const RECENT_KEY = "fl_palette_recent";

function readRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 6); } catch { return []; }
}

function pushRecent(nick) {
  try {
    const list = [nick, ...readRecent().filter((n) => n.toLowerCase() !== nick.toLowerCase())].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { return; }
}

function parsePaste(q, t) {
  const v = q.trim();
  const room = v.match(/faceit\.com\/[a-z-]*\/?(?:cs2|csgo)\/room\/([0-9a-z-]+)/i);
  if (room) return { kind: "room", value: v, label: t("cp.scoutRoom") };
  const pl = v.match(/faceit\.com\/[a-z-]*\/?players?\/([^/?#\s]+)/i);
  if (pl) {
    const nick = decodeURIComponent(pl[1]);
    return { kind: "player", value: nick, label: t("cp.openPlayer", { name: nick }) };
  }
  const sid = v.match(/(7656\d{13})/);
  if (sid) return { kind: "steam", value: sid[1], label: t("cp.openSteam") };
  const vanity = v.match(/steamcommunity\.com\/id\/([^/?#\s]+)/i);
  if (vanity) return { kind: "steam", value: v, label: t("cp.openSteam") };
  return null;
}

export default function CommandPalette({
  open, onClose, groups, tabs, tabsLabel, onTab, onPlayer, onNav, onPath, lang = DEFAULT_LOCALE,
}) {
  const t = makeT(lang);
  const [q, setQ] = useState("");
  const [players, setPlayers] = useState([]);
  const dialogRef = useRef(null);

  useFocusTrap(dialogRef, open, { onEscape: onClose, initialFocus: "input" });

  useEffect(() => {
    if (open) {
      setQ("");
      setPlayers([]);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const v = q.trim();
    if (v.length < 2 || parsePaste(v, t)) {
      setPlayers([]);
      return undefined;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      getJson(`/api/search/?q=${encodeURIComponent(v)}`, { ttl: 30000, signal: ctrl.signal, retry: 0 })
        .then((j) => setPlayers(j.items || []))
        .catch((err) => { if (!isAbort(err)) setPlayers([]); });
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  const pages = useMemo(() => {
    const flat = [];
    for (const g of groups || []) {
      for (const sec of g.sections || [{ items: g.items }]) {
        for (const it of sec.items || []) if (it.id) flat.push({ ...it, group: g.label });
      }
    }
    return flat;
  }, [groups]);

  const items = useMemo(() => {
    const v = q.trim().toLowerCase();
    const out = [];
    const paste = parsePaste(q, t);
    if (paste) out.push({ type: "paste", ...paste });
    if (v === "rush b") {
      const lvl10 = PROS[Math.floor(Math.random() * PROS.length)];
      out.push({ type: "player", nickname: lvl10.nickname, hint: "Cyka blyat, no stop" });
    }
    if (!v) {
      for (const n of readRecent()) out.push({ type: "player", nickname: n, hint: t("cp.recent") });
    }
    for (const p of players) {
      out.push({ type: "player", nickname: p.nickname, avatar: p.avatar, level: p.level ?? p.skill_level, elo: p.elo, verified: p.verified });
    }
    if (v && !paste && !players.some((p) => p.nickname?.toLowerCase() === v)) {
      out.push({ type: "player", nickname: q.trim(), hint: t("cp.exact") });
    }
    const tb = (tabs || []).filter(([, label]) => !v || label.toLowerCase().includes(v));
    for (const [id, label] of tb.slice(0, v ? 6 : 4)) {
      out.push({ type: "tab", id, label, group: tabsLabel || t("cp.profileTab") });
    }
    const pg = pages.filter((p) => !v || p.label.toLowerCase().includes(v) || (p.hint || "").toLowerCase().includes(v));
    for (const p of pg.slice(0, v ? 6 : 8)) out.push({ type: "page", ...p });
    return out;
  }, [q, players, pages, tabs, tabsLabel, lang]);

  function run(it) {
    if (!it) return;
    onClose();
    if (it.type === "player") { pushRecent(it.nickname); onPlayer(it.nickname); }
    else if (it.type === "tab") onTab?.(it.id);
    else if (it.type === "page") onNav(it.id);
    else if (it.kind === "player") { pushRecent(it.value); onPlayer(it.value); }
    else if (it.kind === "room") onPath(`/matchroom?room=${encodeURIComponent(it.value)}`);
    else if (it.kind === "steam") onPath(/^\d+$/.test(it.value) ? `/steam/${it.value}` : `/steam/${encodeURIComponent(it.value)}`);
  }

  const nav = useListNav({
    count: items.length,
    initial: 0,
    enabled: open,
    onSelect: (i, e) => {
      e.preventDefault();
      run(items[i]);
    },
  });

  if (!open) return null;

  return (
    <div className="cp-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cp" role="dialog" aria-modal="true" aria-label={t("cp.title")} ref={dialogRef}>
        <div className="cp-input">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={nav.onKeyDown}
            placeholder={t("cp.placeholder")}
            aria-label={t("cp.placeholder")}
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls={nav.listId}
            aria-autocomplete="list"
            aria-activedescendant={nav.activeId}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="cp-list" role="listbox" id={nav.listId} ref={nav.listRef} aria-label={t("cp.results")}>
          {items.length === 0 && <div className="cp-empty">{t("cp.empty")}</div>}
          {items.map((it, i) => (
            <div
              key={`${it.type}-${it.nickname || it.id || it.value}-${i}`}
              id={nav.optionId(i)}
              data-nav-index={i}
              className={`cp-item ${i === nav.active ? "on" : ""}`}
              onMouseEnter={() => nav.setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(it)}
              role="option"
              aria-selected={i === nav.active}
            >
              {it.type === "player" ? (
                <>
                  {it.avatar ? <img src={it.avatar} alt="" /> : <span className="cp-ic" aria-hidden="true">@</span>}
                  <span className="cp-main">{it.nickname}</span>
                  {it.hint && <span className="cp-hint">{it.hint}</span>}
                  {it.elo != null && <span className="cp-elo">{it.elo}</span>}
                  {it.level ? <FaceitLevel level={it.level} size={20} /> : null}
                </>
              ) : it.type === "page" || it.type === "tab" ? (
                <>
                  <span className="cp-ic" aria-hidden="true">{it.icon || "›"}</span>
                  <span className="cp-main">{it.label}</span>
                  <span className="cp-hint">{it.group}</span>
                </>
              ) : (
                <>
                  <span className="cp-ic" aria-hidden="true">↵</span>
                  <span className="cp-main">{it.label}</span>
                  <span className="cp-hint">{t("cp.pasted")}</span>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="cp-foot" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> {t("cp.move")}</span>
          <span><kbd>Enter</kbd> {t("cp.open")}</span>
          <span>{IS_MAC ? <kbd>⌘</kbd> : <kbd>Ctrl</kbd>}<kbd>K</kbd> {t("cp.toggle")}</span>
        </div>
      </div>
    </div>
  );
}
