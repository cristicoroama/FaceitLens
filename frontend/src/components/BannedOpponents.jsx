import { useCommunityData, agoShort } from "../lib/community-api.js";
import "../styles/community.css";

function humanise(t) {
  const s = (t || "ban").replace(/_/g, " ").trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function BannedOpponents({ nickname, onPick, hideWhenEmpty = false }) {
  const { data, error, loading } = useCommunityData(
    nickname ? `/api/player/${encodeURIComponent(nickname)}/banned-opponents/` : null,
  );
  const items = data?.items || [];
  if (hideWhenEmpty && (loading || error || items.length === 0)) return null;

  return (
    <div className="panel cm-panel">
      <div className="panel-head">
        <div className="panel-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" />
          </svg>
        </div>
        <div className="panel-title">Banned since we played</div>
        {items.length > 0 && <span className="panel-count">{items.length}</span>}
        <div className="panel-sub">recent opponents and teammates</div>
      </div>
      {loading && <div className="cm-empty">Loading…</div>}
      {error && <div className="cm-empty">{error.message}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="cm-empty">
          {data?.tracking
            ? "Nobody from the last 50 matches has picked up a ban since. We check regularly."
            : "This check runs for FaceitLens members with a linked FACEIT account."}
        </div>
      )}
      {items.length > 0 && (
        <ul className="cm-list">
          {items.map((b) => (
            <li key={`${b.player_id}-${b.ban_type}`} className="cm-ban-row">
              <button type="button" className="cm-list-row" onClick={() => onPick?.(b.nickname)}>
                <span className={`cm-rel ${b.relation}`}>{b.relation}</span>
                <span className="cm-new">{b.nickname}</span>
                <span className="cm-ban-type">{humanise(b.ban_type)}</span>
                <span className="cm-when">{agoShort(b.detected_at)}</span>
              </button>
              {b.match_url && (
                <a className="cm-match-link" href={b.match_url} target="_blank" rel="noopener noreferrer">match</a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
