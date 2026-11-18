import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api.js";
import { DISCORD_INVITE } from "../links.js";
import { DiscordIcon } from "./BrandIcons.jsx";
import { teamLogo } from "../team-logos.js";
import { Flag } from "./RankIcons.jsx";
import Stickers from "./Stickers.jsx";
import { simulate, cleanWinners, fillAll, fillRound, resetFrom } from "../swiss.js";

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

const EVENT_META = {
  "singapore-2026": {
    banner: "/img/pickem/singapore-2026-banner.png",
    bannerRemote: "https://img-cdn.hltv.org/eventbanner/1WB6amkvVfb-X3PMsTVzSR.png?ixlib=java-2.1.0&w=1276&s=847a11fa3c70a3e0e8f59971457fd1c4",
    logo: "/img/pickem/pgl.png",
    logoRemote: "https://img-cdn.hltv.org/eventlogo/u-4VdjFWGYz_GwBxLGrr11.png?ixlib=java-2.1.0&w=100&s=d720c0ce81fe5b3e760c5b545c22e819",
    location: "Singapore",
    country: "sg",
    teams: 32,
    stages: [
      { name: "Stage 1", dates: "Nov 24 – Nov 27", start: "2026-11-24", end: "2026-11-27", teams: 16 },
      { name: "Stage 2", dates: "Nov 28 – Dec 1", start: "2026-11-28", end: "2026-12-01", teams: 16 },
      { name: "Stage 3 & Playoffs", dates: "Dec 2 – Dec 13", start: "2026-12-02", end: "2026-12-13", teams: 16 },
    ],
  },
};

function meta(slug) {
  return EVENT_META[slug] || {};
}

function FallbackImg({ src, fallback, alt = "", className, style }) {
  const [cur, setCur] = useState(src || fallback);
  const [dead, setDead] = useState(false);
  if (!cur || dead) return null;
  return (
    <img className={className} style={style} src={cur} alt={alt} loading="lazy"
      onError={() => (cur !== fallback && fallback ? setCur(fallback) : setDead(true))} />
  );
}

function EvLogo({ slug, size = 30 }) {
  const m = meta(slug);
  if (!m.logo) return null;
  return <FallbackImg className="pk-evlogo" src={m.logo} fallback={m.logoRemote} style={{ width: size, height: size }} />;
}

function stageStatus(d) {
  if (!d?.start) return null;
  const now = Date.now();
  const s = new Date(`${d.start}T00:00:00Z`).getTime();
  const e = new Date(`${d.end}T23:59:59Z`).getTime();
  if (now < s) return "upcoming";
  if (now <= e) return "live";
  return "finished";
}

function EventHero({ event, stage }) {
  const m = meta(event.slug);
  const idx = stage ? stage.order - 1 : 0;
  const d = m.stages?.[idx];
  const status = stageStatus(d);
  return (
    <div className="pk-hero">
      <div className="pk-hero-banner">
        {m.banner && <FallbackImg className="pk-hero-img" src={m.banner} fallback={m.bannerRemote} />}
        {status && <span className={`pk-hero-status s-${status}`}>{status}</span>}
        <div className="pk-hero-title">
          <span className="pk-hero-eyebrow">Major Pick'em</span>
          {event.name}{d ? ` ${d.name}` : ""}
        </div>
      </div>
      <div className="pk-hero-info">
        <div><span>Date</span><b>{d?.dates ? `${d.dates} 2026` : "—"}</b></div>
        <div><span>Format</span><b>Swiss · picks lock at start</b></div>
        <div><span>Teams</span><b>{d?.teams || stage?.teams?.length || "—"}</b></div>
        {m.location && (
          <div><span>Location</span><b className="pk-hero-loc"><Flag country={m.country} size={16} />{m.location}</b></div>
        )}
      </div>
    </div>
  );
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

const LAYOUT = [
  { r: 1, slots: [["0-0", 8]] },
  { r: 2, slots: [["1-0", 4], ["0-1", 4]] },
  { r: 3, slots: [["2-0", 2], ["1-1", 4], ["0-2", 2]] },
  { r: 4, slots: [["res", "3-0", 2, "win"], ["2-1", 3], ["1-2", 3], ["res", "0-3", 2, "lose"]] },
  { r: 5, slots: [["res2", ["3-1", "3-2"], 3, "win"], ["2-2", 3], ["res2", ["1-3", "2-3"], 3, "lose"]] },
];

function Logo({ team, size = 34 }) {
  const src = team ? teamLogo(team) : null;
  if (!team) return <span className="sw-logo q" style={{ width: size, height: size }}>?</span>;
  return src
    ? <img className="sw-logo" src={src} alt={team.name} title={team.name} style={{ width: size, height: size }} />
    : <span className="sw-logo txt" title={team.name} style={{ width: size, height: size }}>{initials(team.name)}</span>;
}

function Match({ m, byId, onPick, locked }) {
  const ta = m ? byId[m.a] : null;
  const tb = m ? byId[m.b] : null;
  const cls = (id) => (!m?.winner ? "" : m.winner === id ? "won" : "lost");
  return (
    <div className={`sw-match ${m ? "" : "empty"}`}>
      <button type="button" className={`sw-side ${m ? cls(m.a) : ""}`} disabled={!m || locked}
        onClick={() => m && onPick(m.key, m.a)} title={ta ? `${ta.name} wins` : ""}>
        <Logo team={ta} />
      </button>
      <span className="sw-vs">vs</span>
      <button type="button" className={`sw-side ${m ? cls(m.b) : ""}`} disabled={!m || locked}
        onClick={() => m && onPick(m.key, m.b)} title={tb ? `${tb.name} wins` : ""}>
        <Logo team={tb} />
      </button>
    </div>
  );
}

function ResultBox({ labels, ids, n, tone, byId, hits }) {
  const list = Array.isArray(labels) ? labels : [labels];
  return (
    <div className={`sw-res ${tone}`}>
      {list.map((lbl, i) => {
        const got = ids[lbl] || [];
        return (
          <div className="sw-res-row" key={lbl}>
            <div className="sw-res-lbl">{lbl}</div>
            <div className="sw-res-teams">
              {Array.from({ length: n }, (_, k) => {
                const t = got[k] ? byId[got[k]] : null;
                const hit = t ? hits?.[String(t.id)] : undefined;
                return (
                  <span key={k} className={`sw-res-slot ${hit === true ? "hit" : hit === false ? "miss" : ""}`}>
                    <Logo team={t} size={30} />
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StageBoard({ stage, signedIn, onSaved }) {
  const [winners, setWinners] = useState(stage.picks?.sim || {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setWinners(stage.picks?.sim || {}); setDirty(false); setMsg(""); }, [stage.id, stage.picks]);

  const teams = stage.teams;
  const byId = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);
  const sim = useMemo(() => simulate(teams, winners), [teams, winners]);
  const locked = stage.locked;

  const byOutcome = useMemo(() => {
    const o = {};
    for (const [id, rec] of Object.entries(sim.outcome)) (o[rec] = o[rec] || []).push(Number(id));
    for (const k of Object.keys(o)) o[k].sort((a, b) => sim.seedOf[a] - sim.seedOf[b]);
    return o;
  }, [sim]);

  function update(next) {
    if (locked) return;
    setWinners(cleanWinners(teams, next));
    setDirty(true);
    setMsg("");
  }

  function pick(key, id) {
    update({ ...winners, [key]: winners[key] === id ? undefined : id });
  }

  async function save() {
    if (!sim.done) return;
    setSaving(true); setMsg("");
    try {
      const j = await call("/api/pickem/picks/", { stage_id: stage.id, picks: { ...sim.picks, sim: winners } });
      setDirty(false);
      setMsg("Saved");
      onSaved(j);
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  if (!teams.length) {
    return <div className="state">Teams for {stage.name} are announced when the previous stage ends.</div>;
  }

  const legacy = !stage.picks?.sim && stage.picks && (stage.picks["30"] || []).length > 0;
  const left = countdown(stage.lock_at);
  const decided = Object.keys(winners).length;

  return (
    <div className="pk-board">
      <div className="sw-bar">
        <div className="sw-bar-info">
          {locked ? (
            <span className="pk-lock">Locked{stage.score != null ? ` · ${stage.score} pts` : ""}</span>
          ) : (
            <>
              {left && <span className="pk-lock open">Locks in {left}</span>}
              <span className="sw-progress">{decided}/33 matches picked</span>
            </>
          )}
        </div>
        {!locked && (
          <div className="sw-tools">
            <button type="button" onClick={() => update({})}>Reset</button>
            <button type="button" onClick={() => update(fillAll(teams, winners, "rand"))} title="Fill the rest at random">Shuffle</button>
            <button type="button" onClick={() => update(fillAll(teams, winners, "seed"))}>Higher seed</button>
          </div>
        )}
      </div>

      {legacy && (
        <div className="pk-hint">You saved picks before the bracket existed. They still count; simulate again to change them.</div>
      )}

      <div className="sw-scroll">
        <div className="sw-grid">
          {LAYOUT.map((col) => {
            const round = sim.rounds.find((x) => x.r === col.r);
            return (
              <div className="sw-col" key={col.r}>
                {!locked && (
                  <div className="sw-col-tools">
                    <button type="button" onClick={() => update(resetFrom(teams, winners, col.r))}>Reset</button>
                    <button type="button" aria-label="Random" title="Random" onClick={() => update(fillRound(teams, winners, col.r, "rand"))}>⤨</button>
                    <button type="button" onClick={() => update(fillRound(teams, winners, col.r, "seed"))}>Higher seed</button>
                  </div>
                )}
                {col.slots.map((slot) => {
                  if (slot[0] === "res" || slot[0] === "res2") {
                    return (
                      <ResultBox key={String(slot[1])} labels={slot[1]} ids={byOutcome} n={slot[2]} tone={slot[3]}
                        byId={byId} hits={stage.hits} />
                    );
                  }
                  const [rec, n] = slot;
                  const g = round?.groups.find((x) => x.record === rec);
                  return (
                    <div className="sw-group" key={rec}>
                      <div className="sw-rec">{rec}</div>
                      {Array.from({ length: n }, (_, i) => (
                        <Match key={i} m={g?.matches[i]} byId={byId} onPick={pick} locked={locked} />
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {signedIn && !locked && (
        <div className="pk-save">
          <button className="btn-primary" onClick={save} disabled={saving || !dirty || !sim.done}>
            {saving ? "Saving…" : sim.done ? "Save picks" : "Finish the bracket to save"}
          </button>
          {msg && <span className={`pk-msg ${msg === "Saved" ? "ok" : ""}`}>{msg}</span>}
        </div>
      )}
      {!signedIn && <div className="pk-hint">Sign in to save your bracket and join leagues.</div>}
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
  const [view, setView] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "stickers" ? "stickers" : "pickem");

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
      <EventHero event={data.event} stage={stage} />

      <div className="pk-views">
        {[["pickem", "Pick'em"], ["stickers", "Stickers"]].map(([k, label]) => (
          <button key={k} type="button" className={`pk-view ${view === k ? "on" : ""}`}
            onClick={() => {
              setView(k);
              const u = new URL(window.location.href);
              if (k === "stickers") u.searchParams.set("view", "stickers"); else u.searchParams.delete("view");
              window.history.replaceState(null, "", u);
            }}>
            {label}
            {k === "stickers" && <span className="pk-view-new">805</span>}
          </button>
        ))}
      </div>

      {view === "stickers" ? (
        <Stickers teamsInStage={stage?.teams} />
      ) : (
      <>

      {!data.signed_in && (
        <div className="pk-signin">
          <span>Sign in to save picks and join leagues.</span>
          <a className="btn-primary" href={`${API_BASE}/api/auth/steam/login/`}>Sign in with Steam</a>
        </div>
      )}

      <div className="pk-stages">
        {data.stages.map((s, i) => {
          const d = meta(data.event.slug).stages?.[i];
          return (
            <button key={s.id} type="button" className={`pk-stage ${i === stageIdx ? "on" : ""}`} onClick={() => setStageIdx(i)}>
              <EvLogo slug={data.event.slug} size={30} />
              <span className="pk-stage-txt">
                <b>{d?.name || s.name}</b>
                <small>{d?.dates || new Date(s.lock_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</small>
              </span>
              {s.score != null && <b className="pk-stage-pts">{s.score}</b>}
            </button>
          );
        })}
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
      )}
    </>
  );
}
