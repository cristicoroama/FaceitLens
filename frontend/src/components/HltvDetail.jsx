import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

/** Fetch a details section (team-details / player-details) by url or id. */
function useDetails(section, ref) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  useEffect(() => {
    let alive = true;
    setState({ loading: true, data: null, error: "" });
    const qs = ref.url
      ? `url=${encodeURIComponent(ref.url)}`
      : `id=${encodeURIComponent(ref.id)}`;
    fetch(`${API_BASE}/api/hltv/${section}/?${qs}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!alive) return;
        if (!ok) throw new Error(j.error || "Error");
        setState({ loading: false, data: j, error: "" });
      })
      .catch((e) => alive && setState({ loading: false, data: null, error: e.message }));
    return () => { alive = false; };
  }, [section, ref.url, ref.id]);
  return state;
}

/** Image that swaps to a fallback node if it's missing or fails to load. */
function Img({ src, className, fallback }) {
  const [ok, setOk] = useState(true);
  if (!src || !ok) return fallback || null;
  return <img className={className} src={src} onError={() => setOk(false)} alt="" loading="lazy" />;
}

export function Modal({ onClose, children }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="hltv-modal-backdrop" onClick={onClose}>
      <div className="hltv-modal" onClick={(e) => e.stopPropagation()}>
        <button className="hltv-modal-close" onClick={onClose} title="Close (Esc)">✕</button>
        {children}
      </div>
    </div>
  );
}

function Tile({ label, val }) {
  return (
    <div className="hltv-tile">
      <div className="hltv-tile-val">{val ?? "—"}</div>
      <div className="hltv-tile-label">{label}</div>
    </div>
  );
}

export function PlayerModal({ playerRef, onClose, onFaceit }) {
  const { loading, data, error } = useDetails("player-details", playerRef);
  const name = data?.name || playerRef.name || "Player";
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <Modal onClose={onClose}>
      {loading && <div className="state">Loading player…</div>}
      {error && <div className="state error">{error}</div>}

      {!loading && data && !data.available && (
        <div className="hltv-detail-empty">
          <div className="hltv-detail-name">{name}</div>
          <p className="hltv-detail-sub">
            HLTV profile isn't available yet (needs the get_player_details endpoint).
          </p>
          {onFaceit && (
            <button className="act-btn" onClick={() => { onFaceit(name); onClose(); }}>
              Search {name} on FACEIT
            </button>
          )}
        </div>
      )}

      {!loading && data?.available && (
        <div className="hltv-player">
          <div className="hltv-player-head">
            <Img
              src={data.photo}
              className="hltv-player-photo"
              fallback={<div className="hltv-player-photo ph">{initials}</div>}
            />
            <div>
              <div className="hltv-detail-name">{name}</div>
              {data.real_name && <div className="hltv-detail-sub">{data.real_name}</div>}
              <div className="hltv-detail-sub">
                {[data.country, data.age && `${data.age} yrs`, data.team].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
          <div className="hltv-tiles">
            <Tile label="Rating 2.0" val={data.rating} />
            <Tile label="K/D" val={data.kd} />
            <Tile label="Maps" val={data.maps} />
            <Tile label="HS %" val={data.hs} />
          </div>
          {onFaceit && (
            <button className="act-btn" onClick={() => { onFaceit(name); onClose(); }}>
              Search on FACEIT
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

export function TeamModal({ teamUrl, teamName, onClose, onOpenPlayer }) {
  const { loading, data, error } = useDetails("team-details", { url: teamUrl });
  const name = data?.name || teamName || "Team";
  return (
    <Modal onClose={onClose}>
      {loading && <div className="state">Loading team…</div>}
      {error && <div className="state error">{error}</div>}

      {!loading && data && !data.available && (
        <div className="hltv-detail-empty">
          <div className="hltv-detail-name">{name}</div>
          <p className="hltv-detail-sub">
            Team details aren't available yet (needs the get_team_details endpoint).
          </p>
        </div>
      )}

      {!loading && data?.available && (
        <div className="hltv-team">
          <div className="hltv-team-head">
            <Img src={data.logo} className="hltv-team-logo" fallback={null} />
            <div>
              <div className="hltv-detail-name">{name}</div>
              {data.world_ranking && (
                <div className="hltv-detail-sub">World rank #{data.world_ranking}</div>
              )}
            </div>
          </div>
          <div className="hltv-roster-title">Roster</div>
          <div className="hltv-roster">
            {data.roster.map((p, i) => (
              <button
                className="hltv-roster-card"
                key={i}
                onClick={() => onOpenPlayer({ url: p.player_url, id: p.player_id, name: p.name })}
              >
                <Img
                  src={p.photo}
                  className="hltv-roster-photo"
                  fallback={<div className="hltv-roster-photo ph">{(p.name || "?").slice(0, 2).toUpperCase()}</div>}
                />
                <div className="hltv-roster-name">{p.name}</div>
                {p.country && <div className="hltv-roster-country">{p.country}</div>}
              </button>
            ))}
            {data.roster.length === 0 && <div className="state">No roster data.</div>}
          </div>
        </div>
      )}
    </Modal>
  );
}
