import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api.js";
import { DISCORD_INVITE } from "../links.js";
import { DiscordIcon } from "./BrandIcons.jsx";

const SLOTS = [
  ["30", "3-0"],
  ["adv", "Advance"],
  ["03", "0-3"],
];

const RESULT_LABEL = { "30": "3-0", adv: "Advanced", elim: "Out", "03": "0-3" };

async function call(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: body ? "POST" : "GET",
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try { j = await r.json(); } catch { /* empty */ }
  if (!r.ok) throw new Error(j?.error || `Error ${r.status}`);
  return j;
}

function initials(n) {
  return (n || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

function countdown(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ${h % 24}h`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function emptyPicks() {
  return { "30": [], "03": [], adv: [] };
}

function StageBoard({ stage, signedIn, onSaved }) {
  const [picks, setPicks] = useState(stage.picks || emptyPicks());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setPicks(stage.picks || emptyPicks()); setDirty(false); }, [stage.id, stage.picks]);

  const slotOf = useMemo(() => {
    const m = {};
    for (const [k] of SLOTS) for (const id of picks[k] || []) m[id] = k;
    return m;
  }, [picks]);

  const full = (k) => (picks[k] || []).length >= stage.need[k];
  const complete = SLOTS.every(([k]) => (picks[k] || []).length === stage.need[k]);
  const ready = stage.teams.length > 0;

  function toggle(teamId, k) {
    if (stage.locked) return;
    setMsg("");
    setPicks((p) => {
      const next = { "30": [...(p["30"] || [])], "03": [...(p["03"] || [])], adv: [...(p.adv || [])] };
      const cur = slotOf[teamId];
      if (cur) next[cur] = next[cur].filter((x) => x !== teamId);
      if (cur !== k) {
        if (next[k].length >= stage.need[k]) return p;
        next[k].push(teamId);
      }
      return next;
    });
    setDirty(true);
  }

  async function save() {
    setSaving(true); setMsg("");
    try {
      const j = await call("/api/pickem/picks/", { stage_id: stage.id, picks });
      setDirty(false);
      setMsg("Saved");
      onSaved(j);
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  if (!ready) {
    return <div className="state">Teams for {stage.name} are announced when the previous stage ends.</div>;
  }

  const left = countdown(stage.lock_at);

  return (
    <div className="pk-board">
      <div className="pk-meter">
        {SLOTS.map(([k, label]) => (
          <div className={`pk-meter-slot s-${k} ${full(k) ? "full" : ""}`} key={k}>
            <span className="pk-meter-label">{label}</span>
            <span className="pk-meter-num">{(picks[k] || []).length}/{stage.need[k]}</span>
          </div>
        ))}
        <div className="pk-meter-side">
          {stage.locked ? (
            <span className="pk-lock">Locked{stage.score != null ? ` · ${stage.score} pts` : ""}</span>
          ) : (
            left && <span className="pk-lock open">Locks in {left}</span>
          )}
        </div>
      </div>

      <div className="pk-teams">
        {stage.teams.map((t) => {
          const s = slotOf[t.id];
          const hit = stage.hits?.[String(t.id)];
          return (
            <div key={t.id} className={`pk-team ${s ? `on s-${s}` : ""} ${hit === true ? "hit" : hit === false ? "miss" : ""}`}>
              <div className="pk-team-id">
                {t.logo ? <img src={t.logo} alt="" loading="lazy" /> : <span className="pk-ph">{initials(t.name)}</span>}
                <span className="pk-team-name">{t.name}</span>
                {(t.wins > 0 || t.losses > 0) && <span className="pk-rec">{t.wins}-{t.losses}</span>}
                {t.result && <span className={`pk-res r-${t.result}`}>{RESULT_LABEL[t.result]}</span>}
              </div>
              <div className="pk-opts" role="group" aria-label={`Pick for ${t.name}`}>
                {SLOTS.map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={`pk-opt s-${k} ${s === k ? "on" : ""}`}
                    disabled={stage.locked || !signedIn || (s !== k && full(k))}
                    aria-pressed={s === k}
                    onClick={() => toggle(t.id, k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {signedIn && !stage.locked && (
        <div className="pk-save">
          <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : complete ? "Save picks" : "Save (incomplete)"}
          </button>
          {msg && <span className={`pk-msg ${msg === "Saved" ? "ok" : ""}`}>{msg}</span>}
        </div>
      )}
    </div>
  );
}

function Standings({ data, title, onClose }) {
  if (!data) return null;
  return (
    <div className="pk-standings">
      <div className="section-title">
        {title}
        {data.players != null && <span className="section-count">{data.players} players</span>}
        {onClose && <button className="pk-x" onClick={onClose} aria-label="Close">✕</button>}
      </div>
      {data.rows.length === 0 ? (
        <div className="state">No picks yet. Be the first.</div>
      ) : (
        <div className="pk-table" style={{ "--cols": data.stages.length + 1 }}>
          <div className="pk-tr pk-th">
            <span>#</span><span>Player</span>
            {data.stages.map((s) => <span key={s} className="pk-num">{s.replace("Stage ", "S")}</span>)}
            <span className="pk-num">Total</span>
          </div>
          {data.rows.map((r, i) => (
            <div className={`pk-tr ${r.me ? "me" : ""}`} key={`${r.name}-${i}`}>
              <span className="pk-pos">{r.position}</span>
              <span className="pk-who">
                {r.avatar ? <img src={r.avatar.startsWith("/") ? `${API_BASE}${r.avatar}` : r.avatar} alt="" loading="lazy" /> : <span className="pk-ph sm">{initials(r.name)}</span>}
                {r.handle ? <a href={`/u/${r.handle}`}>{r.name}</a> : <span>{r.name}</span>}
              </span>
              {r.stages.map((p, j) => <span key={j} className="pk-num">{p ?? "—"}</span>)}
              <span className="pk-num pk-total">{r.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Pickem() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [stageIdx, setStageIdx] = useState(0);
  const [league, setLeague] = useState(null);
  const [global, setGlobal] = useState(null);
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [lmsg, setLmsg] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const j = await call("/api/pickem/");
      setData(j);
      const open = j.stages.findIndex((s) => !s.locked && s.teams.length);
      const lastReady = j.stages.map((s) => s.teams.length > 0).lastIndexOf(true);
      setStageIdx(open >= 0 ? open : Math.max(0, lastReady));
    } catch (e) { setError(e.message); }
  }

  async function openLeague(code) {
    try {
      setLeague(await call(`/api/pickem/league/${encodeURIComponent(code)}/`));
      const u = new URL(window.location.href);
      u.searchParams.set("league", code);
      window.history.replaceState(null, "", u);
    } catch (e) { setLmsg(e.message); }
  }

  useEffect(() => {
    load();
    call("/api/pickem/global/").then(setGlobal).catch(() => {});
    const code = new URLSearchParams(window.location.search).get("league");
    if (code) {
      setJoinCode(code.toUpperCase());
      openLeague(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createLeague() {
    setLmsg("");
    try {
      const j = await call("/api/pickem/league/", { name: newName });
      setData((d) => ({ ...d, leagues: j.leagues }));
      setNewName("");
      openLeague(j.code);
    } catch (e) { setLmsg(e.message); }
  }

  async function joinLeague(codeArg) {
    setLmsg("");
    try {
      const j = await call("/api/pickem/league/join/", { code: codeArg || joinCode });
      setData((d) => ({ ...d, leagues: j.leagues }));
      openLeague(j.code);
    } catch (e) { setLmsg(e.message); }
  }

  async function leaveLeague(code) {
    try {
      const j = await call("/api/pickem/league/leave/", { code });
      setData((d) => ({ ...d, leagues: j.leagues }));
      if (league?.code === code) setLeague(null);
    } catch (e) { setLmsg(e.message); }
  }

  function copyInvite(code) {
    const url = `${window.location.origin}/pickem?league=${code}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  if (error) return <div className="state error">{error}</div>;
  if (!data) return <div className="state">Loading Pick'em…</div>;
  if (!data.event) return <div className="state">No Pick'em running right now. Check back for the next Major.</div>;

  const stage = data.stages[stageIdx];
  const total = data.stages.reduce((a, s) => a + (s.score || 0), 0);

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-title">
          <div className="panel-ic" style={{ width: 38, height: 38 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
              <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
            </svg>
          </div>
          Major <em>Pick'em</em>
        </div>
        <div className="page-hero-sub">
          {data.event.name}. Pick two 3-0 teams, two 0-3 teams and six that advance, then race your friends in a private league.
        </div>
      </div>

      {!data.signed_in && (
        <div className="pk-signin">
          <span>Sign in to save picks and join leagues.</span>
          <a className="btn-primary" href={`${API_BASE}/api/auth/steam/login/`}>Sign in with Steam</a>
        </div>
      )}

      <div className="pk-stages">
        {data.stages.map((s, i) => (
          <button key={s.id} type="button" className={`hub-season ${i === stageIdx ? "on" : ""}`} onClick={() => setStageIdx(i)}>
            {s.name}
            {s.score != null && <b className="pk-stage-pts">{s.score}</b>}
          </button>
        ))}
        {data.signed_in && <span className="pk-total-pill">Your total: <b>{total}</b></span>}
      </div>

      {stage && (
        <StageBoard
          stage={stage}
          signedIn={data.signed_in}
          onSaved={(s) => setData((d) => ({ ...d, stages: d.stages.map((x) => (x.id === s.id ? s : x)) }))}
        />
      )}

      <div className="pk-cols">
        <div className="pk-leagues">
          <div className="section-title">Your leagues</div>
          {data.signed_in ? (
            <>
              {data.leagues.length === 0 && <div className="pk-hint">Create one and send the link to your friends.</div>}
              {data.leagues.map((l) => (
                <div className="pk-league" key={l.code}>
                  <button type="button" className="pk-league-name" onClick={() => openLeague(l.code)}>
                    {l.name}<small>{l.members} {l.members === 1 ? "player" : "players"}</small>
                  </button>
                  <code>{l.code}</code>
                  <button type="button" className="act-btn" onClick={() => copyInvite(l.code)}>
                    {copied === l.code ? "Copied" : "Invite link"}
                  </button>
                  <button type="button" className="pk-leave" onClick={() => leaveLeague(l.code)} title={l.owner ? "Delete league" : "Leave league"}>
                    {l.owner ? "Delete" : "Leave"}
                  </button>
                </div>
              ))}
              <div className="pk-forms">
                <div className="pk-form">
                  <input value={newName} maxLength={40} placeholder="League name" onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createLeague()} />
                  <button className="btn-primary" onClick={createLeague}>Create</button>
                </div>
                <div className="pk-form">
                  <input value={joinCode} maxLength={8} placeholder="Code, e.g. K7Q2MX"
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && joinLeague()} />
                  <button className="act-btn" onClick={() => joinLeague()} disabled={!joinCode.trim()}>Join</button>
                </div>
              </div>
              {lmsg && <div className="pk-msg">{lmsg}</div>}
            </>
          ) : (
            <div className="pk-hint">Sign in to create or join a league.</div>
          )}
          <a className="pk-discord" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
            <DiscordIcon size={16} /> Live standings and banter in our Discord
          </a>
        </div>

        <div className="pk-boards">
          {league && (
            <Standings
              data={league}
              title={league.name}
              onClose={() => {
                setLeague(null);
                const u = new URL(window.location.href);
                u.searchParams.delete("league");
                window.history.replaceState(null, "", u);
              }}
            />
          )}
          {league && !league.member && data.signed_in && (
            <button className="btn-primary pk-joinbtn" onClick={() => joinLeague(league.code)}>
              Join {league.name}
            </button>
          )}
          <Standings data={global} title="Global top 50" />
        </div>
      </div>
    </>
  );
}
