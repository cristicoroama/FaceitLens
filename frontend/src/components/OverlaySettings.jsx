import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import OverlayCard, { LOOK_DEFAULTS, lookToQuery, readLook } from "./OverlayCard.jsx";
import { Icon } from "../icons.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * The streamer-facing half of the overlay: style it, watch it change, copy the
 * link into OBS.
 *
 * The preview renders the real OverlayCard rather than a mock-up of it, so what
 * is shown here and what OBS draws cannot drift apart.
 *
 * The URL carries a secret token rather than the public handle, because OBS
 * loads the page with no session — the token is the only thing standing
 * between a stranger and someone's live ELO. Regenerating it is the way to
 * revoke a link that got shown on stream by accident, which happens a lot.
 */

const TOGGLES = [
  ["show_elo", "ELO and level", "Your current rating and skill level."],
  ["show_session", "Stats row", "Wins, losses, today\u2019s ELO, K/D, ADR, HS%, win rate and your last five results."],
  ["show_match", "Live match", "The map you're on right now."],
  ["show_brand", "faceit-lens.com credit", "A small line under the card. Keeping it helps other people find this."],
];

const ACCENTS = [
  ["ff6a21", "Signal"],
  ["ff5500", "FACEIT"],
  ["3dd67f", "Green"],
  ["4aa8ff", "Blue"],
  ["b46bff", "Purple"],
  ["ffffff", "White"],
];

/* Shown only where the live account has nothing to show — you can't style a
   match card you can't see, and most people set this up before going live. */
const SAMPLE = {
  nickname: "your_nickname",
  level: 9,
  elo: 2418,
  avatar: null,
  country: "ro",
  region: "EU",
  rank: 64553,
  rank_country: 1234,
  session: { wins: 4, losses: 2, elo_delta: 34 },
  recent: { kd: 1.46, kr: 0.93, adr: 97.7, hs: 51, winrate: 66, matches: 20 },
  form: [
    { win: true, map: "mirage" }, { win: true, map: "inferno" },
    { win: false, map: "nuke" }, { win: true, map: "ancient" },
    { win: false, map: "dust2" },
  ],
  match: { map: "de_mirage", competition: "5v5 Ranked" },
};

const BASE_W = 420;
const BASE_H = 220;

export default function OverlaySettings({ user }) {
  const [ov, setOv] = useState(null);
  const [live, setLive] = useState(null);
  const [look, setLook] = useState(LOOK_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  /* The look the server currently has. null until the first load, which is
     also what stops the debounce below from POSTing the defaults back on
     mount and overwriting whatever was saved. */
  const savedLook = useRef(null);

  const flash = useCallback((msg) => {
    setStatus(msg);
    setTimeout(() => setStatus(""), 2500);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/overlay/settings/`, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error === "no_faceit" ? "no_faceit" : (j.error || "Couldn't load."));
        return j;
      })
      .then((j) => {
        setOv(j.overlay);
        // Seed the sliders from the saved look, so coming back next week
        // doesn't silently reset someone's styling to stock.
        savedLook.current = j.overlay?.look || "";
        if (savedLook.current) setLook(readLook(savedLook.current));
        // Real numbers make a far better preview than invented ones.
        return fetch(`${API_BASE}/api/overlay/${j.overlay.token}/`)
          .then((r) => r.json())
          .then((s) => { if (s?.ok) setLive(s); })
          .catch(() => {});
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  async function patch(body, msg) {
    const prev = ov;
    // Optimistic: the preview should react on the click, not after the network.
    setOv((o) => ({ ...o, ...body }));
    try {
      const r = await fetch(`${API_BASE}/api/overlay/settings/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error();
      setOv(j.overlay);
      if (msg) flash(msg);
    } catch {
      setOv(prev);
      flash("Couldn't save.");
    }
  }

  async function resetSession() {
    try {
      const r = await fetch(`${API_BASE}/api/overlay/session/`, {
        method: "POST", credentials: "include",
      });
      const j = await r.json();
      if (r.ok) { setOv(j.overlay); flash("Session reset — counting from now"); }
    } catch { flash("Couldn't reset."); }
  }

  const set = (k) => (v) => setLook((l) => ({ ...l, [k]: v }));

  /* Appearance saves itself, quietly, a beat after you stop dragging. Making
     people press Save after every slider nudge is how a customiser stops
     being fun to use. */
  useEffect(() => {
    if (savedLook.current === null) return;
    const q = lookToQuery(look);
    if (q === savedLook.current) return;
    const id = setTimeout(() => {
      savedLook.current = q;
      fetch(`${API_BASE}/api/overlay/settings/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ look: q }),
      })
        .then((r) => r.json())
        .then((j) => { if (j?.overlay) setOv(j.overlay); })
        .catch(() => {});
    }, 700);
    return () => clearTimeout(id);
  }, [look]);

  /* All real, or all sample — never a blend.
     Filling the gaps field by field looked reasonable until an account with no
     matches rendered its owner's real nickname and real (zero) ranks beside a
     borrowed 2,418 ELO and a 66% win rate. A card that mixes the two is worse
     than one that is openly fake, because nothing tells you which numbers are
     actually yours. */
  const hasRealData = !!(live && live.elo && live.recent?.matches);

  const previewState = useMemo(() => ({
    ...(hasRealData ? live : SAMPLE),
    show: {
      elo: !!ov?.show_elo,
      session: !!ov?.show_session,
      match: !!ov?.show_match,
      brand: !!ov?.show_brand,
    },
  }), [hasRealData, live, ov]);

  if (!user) {
    return (
      <div className="panel">
        <div className="empty-state">
          <div className="empty-ico">{Icon.broadcastPin}</div>
          <h3>Sign in to get your overlay</h3>
          <p>Your FACEIT account has to be linked before the overlay has anything to show.</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="panel"><div className="skeleton tall" /></div>;

  if (error === "no_faceit") {
    return (
      <div className="panel">
        <div className="empty-state">
          <div className="empty-ico">{Icon.link45deg}</div>
          <h3>Link your FACEIT account first</h3>
          <p>The overlay reads your live ELO, so it needs to know which account is yours.</p>
        </div>
      </div>
    );
  }

  if (error || !ov) {
    return (
      <div className="panel">
        <div className="empty-state">
          <div className="empty-ico">{Icon.exclamationTriangle}</div>
          <h3>{error || "Couldn't load your overlay."}</h3>
        </div>
      </div>
    );
  }

  const path = `${ov.url.split("?")[0]}${lookToQuery(look)}`;
  const fullUrl = `${window.location.origin}${path}`;
  const w = BASE_W;
  const h = BASE_H;
  const usingSample = !hasRealData;

  return (
    <>
      <div className="page-hero">
        <h1 className="page-title">Stream overlay</h1>
        <p className="page-sub">
          A live ELO card for your stream. Style it here, copy the link, paste
          it into OBS. Free, nothing to install.
        </p>
      </div>

      {/* ---------- live preview ---------- */}
      <div className="panel ps-card">
        <div className="panel-head">
          <h2 className="panel-title">Preview</h2>
        </div>

        <div className="ovl-stage">
          <OverlayCard state={previewState} look={look} />
        </div>

        <p className="ps-hint">
          {usingSample
            ? "Sample data — every number here is invented, the name included. Yours replaces all of it once FACEIT has a match to report."
            : "These are your real numbers, updating every 10 seconds."}
        </p>
      </div>

      {/* ---------- appearance ---------- */}
      <div className="panel ps-card">
        <div className="panel-head">
          <h2 className="panel-title">Appearance</h2>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setLook(LOOK_DEFAULTS)}
          >
            Reset
          </button>
        </div>

        <div className="ovl-opt">
          <b>Accent</b>
          <div className="ovl-swatches">
            {ACCENTS.map(([hex, name]) => (
              <button
                key={hex}
                type="button"
                title={name}
                aria-label={name}
                className={`ovl-swatch ${look.a === hex ? "on" : ""}`}
                style={{ background: `#${hex}` }}
                onClick={() => set("a")(hex)}
              />
            ))}
            <input
              type="color"
              className="ovl-swatch custom"
              value={`#${look.a}`}
              onChange={(e) => set("a")(e.target.value.replace("#", "").toLowerCase())}
              aria-label="Custom colour"
            />
          </div>
        </div>

        <Slider label="Corners" suffix="px" min={0} max={28} step={1}
                value={look.r} onChange={set("r")} />

        <label className="ps-toggle ovl-opt">
          <input type="checkbox" checked={!!look.av}
                 onChange={(e) => set("av")(e.target.checked ? 1 : 0)} />
          <span className="ps-toggle-track"><span className="ps-toggle-thumb" /></span>
          <span><b>Avatar</b><span className="ps-hint">Your FACEIT profile picture.</span></span>
        </label>
      </div>

      {/* ---------- content ---------- */}
      <div className="panel ps-card">
        <div className="panel-head">
          <h2 className="panel-title">What it shows</h2>
          {status && <span className="ps-status">{status}</span>}
        </div>
        {TOGGLES.map(([key, label, hint]) => (
          <label className="ps-toggle ovl-opt" key={key}>
            <input
              type="checkbox"
              checked={!!ov[key]}
              onChange={(e) => patch({ [key]: e.target.checked }, "Saved")}
            />
            <span className="ps-toggle-track"><span className="ps-toggle-thumb" /></span>
            <span>
              <b>{label}</b>
              <span className="ps-hint">{hint}</span>
            </span>
          </label>
        ))}
      </div>

      {/* ---------- the link ---------- */}
      <div className="panel ps-card">
        <div className="panel-head"><h2 className="panel-title">Your OBS link</h2></div>

        <div className="ps-share">
          <code className="ps-url">{fullUrl}</code>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              navigator.clipboard?.writeText(fullUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <a className="btn ghost" href={path} target="_blank" rel="noopener noreferrer">
            Open
          </a>
        </div>

        <p className="ps-hint">
          The styling above is part of this link, so copy it again after you
          change anything. Treat it like a password — anyone who has it can
          watch your ELO live. If it ends up on stream, regenerate it.
        </p>

        <div className="ps-btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (window.confirm("Regenerate the link? The old one stops working immediately and you'll need to update OBS."))
                patch({ regenerate: true }, "New link generated");
            }}
          >
            Regenerate link
          </button>
          <button type="button" className="btn" onClick={resetSession}>
            Reset session counter
          </button>
        </div>
      </div>

      {/* ---------- OBS ---------- */}
      <div className="panel ps-card">
        <div className="panel-head"><h2 className="panel-title">Adding it to OBS</h2></div>
        <ol className="ps-steps">
          <li>In OBS, under Sources, press <b>+</b> and choose <b>Browser</b>.</li>
          <li>Paste the link above into the <b>URL</b> field.</li>
          <li>Set width to <b>{w}</b> and height to <b>{h}</b>.</li>
          <li>
            Tick <b>Shutdown source when not visible</b> — that stops it polling
            while the scene is hidden.
          </li>
          <li>Press OK and drag it wherever you want on your layout.</li>
        </ol>
        <p className="ps-hint">
          It updates every 10 seconds on its own — leave the source in your
          scene and forget about it. Scale it in OBS if you want it bigger.
        </p>
      </div>
    </>
  );
}

function Slider({ label, value, onChange, min, max, step, suffix = "", hint }) {
  return (
    <div className="ovl-opt ovl-slider">
      <div className="ovl-slider-head">
        <b>{label}</b>
        <span className="ovl-slider-val">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        aria-label={label}
      />
      {hint && <span className="ps-hint">{hint}</span>}
    </div>
  );
}
