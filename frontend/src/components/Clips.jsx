import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

/** Allstar returns a complete iframe URL (clip, platform, useCase, known) in
    clip_url — use it as-is and only add a location hint for their metrics.
    We do NOT pass UID/known: the viewer is anonymous, so Allstar's known=false
    is correct (passing the profile's steam here would wrongly claim ownership). */
function iframeSrc(clip, data) {
  const uc = encodeURIComponent(data.use_case || "POTG");
  const base =
    clip.clip_url ||
    `https://allstar.gg/iframe?clip=${clip.id}&platform=${encodeURIComponent(data.partner_id || "")}&useCase=${uc}`;
  if (base.includes("location=")) return base;
  return base + (base.includes("?") ? "&" : "?") + "location=userProfile";
}

export default function Clips({ nickname }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    return fetch(`${API_BASE}/api/player/${encodeURIComponent(nickname)}/clips/`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setData(j))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [nickname]);

  useEffect(() => {
    setPlaying(null);
    setGenMsg("");
    load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    setGenMsg("");
    try {
      const resp = await fetch(
        `${API_BASE}/api/player/${encodeURIComponent(nickname)}/clips/generate/`,
        { method: "POST" }
      );
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setGenMsg(j.error || "Couldn't request highlights.");
      } else if (j.requested > 0) {
        setGenMsg(`Requested ${j.requested} highlight${j.requested > 1 ? "s" : ""} — they'll appear in ~30 min.`);
      } else {
        setGenMsg("No new matches to clip right now (already requested, or no demos available).");
      }
    } catch {
      setGenMsg("Network error requesting highlights.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading && !data) return <div className="state">Loading highlights…</div>;
  if (!data || data.configured === false)
    return <div className="state">Highlights aren't enabled yet.</div>;

  const clips = (data.clips || []).filter((c) => c.clip_url || c.id);

  const toolbar = data.can_generate && (
    <div className="clips-toolbar">
      <button className="clip-gen-btn" onClick={generate} disabled={generating}>
        {generating ? "Requesting…" : "✨ Generate highlights"}
      </button>
      {genMsg && <span className="clip-gen-msg">{genMsg}</span>}
    </div>
  );

  if (clips.length === 0) {
    return (
      <>
        {toolbar}
        <div className="state">
          No highlights yet for this player.
          {data.can_generate && " Click “Generate highlights” to make some from their recent matches."}
        </div>
      </>
    );
  }

  return (
    <>
      {toolbar}
      <div className="clips-grid">
        {clips.map((c) => (
          <div className="clip-card" key={c.id}>
            <div className="clip-frame">
              {playing === c.id ? (
                <iframe
                  allow="clipboard-write"
                  allowFullScreen
                  src={iframeSrc(c, data)}
                  title={c.title}
                  loading="lazy"
                />
              ) : (
                <button
                  className="clip-thumb"
                  onClick={() => setPlaying(c.id)}
                  aria-label={`Play ${c.title}`}
                  style={{ backgroundImage: c.thumb ? `url(${c.thumb})` : undefined }}
                >
                  <span className="clip-play">▶</span>
                </button>
              )}
            </div>
            <div className="clip-meta">
              <span className="clip-title" title={c.title}>{c.title}</span>
              <span className="clip-tags">
                {c.map && <span className="clip-tag">{c.map}</span>}
                {c.kills && <span className="clip-tag">{c.kills}K</span>}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="hltv-note" style={{ textAlign: "left", paddingTop: 12 }}>
        Highlights powered by <a href="https://allstar.gg" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Allstar.gg</a>.
        Clips can take ~30 min to appear after a match.
      </div>
    </>
  );
}
