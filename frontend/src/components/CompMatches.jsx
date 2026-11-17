import { useEffect, useState } from "react";
import { getJson } from "../api.js";
import { MapIcon, mapLabel } from "../map-art.jsx";

const TABS = [
  ["ongoing", "Live"],
  ["upcoming", "Upcoming"],
  ["past", "Recent"],
];

const EMPTY = {
  ongoing: "Nothing is being played right now.",
  upcoming: "No matches scheduled.",
  past: "No finished matches yet.",
};

function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

function since(ts) {
  if (!ts) return null;
  const mins = Math.floor((Date.now() / 1000 - ts) / 60);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60}m`;
  return `${Math.floor(h / 24)}d`;
}

function when(ts) {
  if (!ts) return null;
  const d = new Date(ts * 1000);
  return d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Side({ t, right, onPick }) {
  return (
    <div className={`cm-side ${right ? "r" : ""} ${t.won === true ? "won" : t.won === false ? "lost" : ""}`}>
      <div className="cm-team">
        {t.avatar
          ? <img src={t.avatar} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
          : <span className="cm-ph">{initials(t.name)}</span>}
        <span className="cm-name">{t.name}</span>
      </div>
      {t.roster.length > 0 && (
        <div className="cm-roster">
          {t.roster.map((p) => (
            <button type="button" key={p.player_id || p.nickname} onClick={() => onPick?.(p.nickname)}>
              {p.nickname}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ m, onPick }) {
  const [a, b] = m.teams;
  const scored = a.score != null && b.score != null;
  const live = m.state === "live";
  const starting = m.state === "starting";
  let meta = null;
  if (live) meta = since(m.started_at);
  else if (starting) meta = "starting";
  else if (m.state === "finished") meta = since(m.finished_at) && `${since(m.finished_at)} ago`;
  else if (m.state === "cancelled") meta = "cancelled";
  else meta = when(m.scheduled_at);

  return (
    <div className={`cm-card ${live ? "live" : ""} ${starting ? "starting" : ""}`}>
      <div className="cm-top">
        {(live || starting) && (
          <span className="cm-pill"><i className="lv-dot" aria-hidden="true" />{live ? "Live" : "Starting"}</span>
        )}
        {m.map && <span className="cm-map"><MapIcon map={m.map} size={14} />{mapLabel(m.map)}</span>}
        {m.best_of > 1 && <span className="cm-dim">Bo{m.best_of}</span>}
        {m.round != null && m.round !== 0 && <span className="cm-dim">Round {m.round}</span>}
        {meta && <span className="cm-dim cm-when">{meta}</span>}
        {m.faceit_url && (
          <a className="cm-go" href={m.faceit_url} target="_blank" rel="noopener noreferrer">Room →</a>
        )}
      </div>
      <div className="cm-body">
        <Side t={a} onPick={onPick} />
        <div className="cm-score">
          {scored ? (
            <>
              <b className={a.won ? "w" : ""}>{a.score}</b>
              <span>:</span>
              <b className={b.won ? "w" : ""}>{b.score}</b>
            </>
          ) : <span className="cm-vs">vs</span>}
        </div>
        <Side t={b} right onPick={onPick} />
      </div>
    </div>
  );
}

export default function CompMatches({ base, onPick, title = "Matches" }) {
  const [tab, setTab] = useState("ongoing");
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);

  async function load(kind, quiet) {
    if (!quiet) setLoading(true);
    try {
      const j = await getJson(`${base}?type=${kind}`);
      setData((d) => ({ ...d, [kind]: j.items || [] }));
    } catch {
      setData((d) => ({ ...d, [kind]: d[kind] || [] }));
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  useEffect(() => {
    setData({});
    setTab("ongoing");
    load("ongoing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  useEffect(() => {
    if (tab !== "ongoing") return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load("ongoing", true);
    }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, base]);

  function pick(k) {
    setTab(k);
    if (!data[k]) load(k);
  }

  const items = data[tab];
  const liveCount = data.ongoing?.filter((m) => m.state === "live").length || 0;

  return (
    <div className="cm">
      <div className="section-title">
        {title}
        {liveCount > 0 && <span className="cm-count"><i className="lv-dot" aria-hidden="true" />{liveCount} live</span>}
        <div className="hub-view">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" className={`hub-view-opt ${tab === k ? "on" : ""}`} onClick={() => pick(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {loading && !items && <div className="state">Loading matches…</div>}
      {items && items.length === 0 && <div className="state">{EMPTY[tab]}</div>}
      {items && items.length > 0 && (
        <div className="cm-list">
          {items.map((m) => <Card key={m.match_id} m={m} onPick={onPick} />)}
        </div>
      )}
    </div>
  );
}
