import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * The streamer-facing half of the overlay: generate the link, choose what it
 * shows, drop it into OBS.
 *
 * The URL carries a secret token rather than the public handle, because OBS
 * loads the page with no session — the token is the only thing standing
 * between a stranger and someone's live ELO. Regenerating it is the way to
 * revoke a link that got shown on stream by accident, which happens a lot.
 */

const TOGGLES = [
  ["show_elo", "ELO and level", "Your current rating and skill level."],
  ["show_session", "Session record", "Wins, losses and ELO gained since you started."],
  ["show_match", "Live match", "The map you're on right now."],
  ["show_brand", "faceit-lens.com credit", "A small line under the card. Keeping it helps other people find this."],
];

export default function OverlaySettings({ user }) {
  const [ov, setOv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/overlay/settings/`, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error === "no_faceit" ? "no_faceit" : (j.error || "Couldn't load."));
        return j;
      })
      .then((j) => setOv(j.overlay))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  async function patch(body, msg) {
    try {
      const r = await fetch(`${API_BASE}/api/overlay/settings/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok) {
        setOv(j.overlay);
        if (msg) { setStatus(msg); setTimeout(() => setStatus(""), 2500); }
      }
    } catch { setStatus("Couldn't save."); }
  }

  async function resetSession() {
    try {
      const r = await fetch(`${API_BASE}/api/overlay/session/`, {
        method: "POST", credentials: "include",
      });
      const j = await r.json();
      if (r.ok) {
        setOv(j.overlay);
        setStatus("Session reset — counting from now");
        setTimeout(() => setStatus(""), 2500);
      }
    } catch { setStatus("Couldn't reset."); }
  }

  if (!user) {
    return (
      <div className="panel">
        <div className="empty-state">
          <div className="empty-ico">▶</div>
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
          <div className="empty-ico">◈</div>
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
          <div className="empty-ico">◌</div>
          <h3>{error || "Couldn't load your overlay."}</h3>
        </div>
      </div>
    );
  }

  const fullUrl = `${window.location.origin}${ov.url}`;

  return (
    <>
      <div className="page-hero">
        <h1 className="page-title">Stream overlay</h1>
        <p className="page-sub">
          A live ELO card for your stream. Free, no account needed by your
          viewers, and nothing to install.
        </p>
      </div>

      <div className="panel ps-card">
        <div className="panel-head">
          <h2 className="panel-title">Your overlay link</h2>
          {status && <span className="ps-status">{status}</span>}
        </div>

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
          <a className="btn ghost" href={ov.url} target="_blank" rel="noopener noreferrer">
            Preview
          </a>
        </div>

        <p className="ps-hint">
          Treat this like a password — anyone with the link can watch your ELO
          live. If it ends up on stream, regenerate it.
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

      <div className="panel ps-card">
        <div className="panel-head"><h2 className="panel-title">What it shows</h2></div>
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

      <div className="panel ps-card">
        <div className="panel-head"><h2 className="panel-title">Adding it to OBS</h2></div>
        <ol className="ps-steps">
          <li>In OBS, under Sources, press <b>+</b> and choose <b>Browser</b>.</li>
          <li>Paste the link above into the <b>URL</b> field.</li>
          <li>Set width to <b>420</b> and height to <b>200</b>.</li>
          <li>
            Tick <b>Shutdown source when not visible</b> — that stops it polling
            while the scene is hidden.
          </li>
          <li>Press OK and drag it wherever you want on your layout.</li>
        </ol>
        <p className="ps-hint">
          It updates every 10 seconds on its own. Nothing to start or stop —
          leave the source in your scene and forget about it.
        </p>
      </div>
    </>
  );
}
