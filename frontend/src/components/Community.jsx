import Climbers from "./Climbers.jsx";
import RankDistribution from "./RankDistribution.jsx";
import SkillBadge from "./SkillBadge.jsx";
import { useCommunityData, agoShort } from "../lib/community-api.js";
import "../styles/community.css";

function Initials({ name }) {
  const txt = (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
  return <div className="lrow-ava">{txt}</div>;
}

function Section({ title, sub, children }) {
  return (
    <div className="panel cm-panel">
      <div className="panel-head">
        <div className="panel-title">{title}</div>
        {sub && <div className="panel-sub">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Status({ state, empty }) {
  if (state.loading) return <div className="cm-empty">Loading…</div>;
  if (state.error) return <div className="cm-empty">{state.error.message}</div>;
  if (empty) return <div className="cm-empty">{empty}</div>;
  return null;
}

function NewMembers({ onOpen }) {
  const state = useCommunityData("/api/profiles/");
  const rows = (state.data?.profiles || []).slice(0, 12);
  return (
    <Section title="Recently joined" sub="public profiles">
      <Status state={state} empty={!state.loading && !state.error && rows.length === 0 ? "No public profiles yet." : null} />
      {rows.length > 0 && (
        <div className="cm-members">
          {rows.map((p) => (
            <button type="button" key={p.handle} className="cm-member" onClick={() => onOpen?.(`/u/${p.handle}`)}>
              {p.avatar ? (
                <img className="lrow-ava img" src={`${import.meta.env.VITE_API_URL || ""}${p.avatar}`} alt="" loading="lazy" />
              ) : (
                <Initials name={p.name || p.handle} />
              )}
              <span className="cm-member-name">{p.name || p.handle}</span>
              <span className="cm-member-sub">{p.faceit_nickname}</span>
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

function Renamed({ onPick }) {
  const state = useCommunityData("/api/community/renamed/");
  const rows = state.data?.items || [];
  return (
    <Section title="Recently renamed" sub="name changes we noticed">
      <Status state={state} empty={!state.loading && !state.error && rows.length === 0 ? "No renames spotted yet." : null} />
      {rows.length > 0 && (
        <ul className="cm-list">
          {rows.map((r) => (
            <li key={`${r.nickname}-${r.renamed_at}`}>
              <button type="button" className="cm-list-row" onClick={() => onPick?.(r.nickname)}>
                <span className="cm-old">{r.previous}</span>
                <span className="cm-arrow" aria-hidden="true">→</span>
                <span className="cm-new">{r.nickname}</span>
                <span className="cm-when">{agoShort(r.renamed_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Searched({ onPick }) {
  const state = useCommunityData("/api/community/searched/");
  const rows = state.data?.items || [];
  return (
    <Section title="Searched today" sub="looked up in the last 24 hours">
      <Status state={state} empty={!state.loading && !state.error && rows.length === 0 ? "Quiet day so far." : null} />
      {rows.length > 0 && (
        <ul className="cm-list">
          {rows.map((r) => (
            <li key={r.nickname}>
              <button type="button" className="cm-list-row" onClick={() => onPick?.(r.nickname)}>
                {r.level ? <SkillBadge level={r.level} size={22} /> : <span className="cm-badge-gap" />}
                <span className="cm-new">{r.nickname}</span>
                {r.elo != null && <span className="cm-elo">{r.elo}</span>}
                <span className="cm-when">{agoShort(r.searched_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export default function Community({ onPick, onOpen, nickname }) {
  return (
    <div className="cm-page">
      <div className="page-hero">
        <div className="page-hero-title">
          <em>Community</em>
        </div>
        <div className="page-hero-sub">
          Who is climbing, who just joined and who changed their name, from the players
          FaceitLens tracks. These are our numbers, not FACEIT-wide statistics.
        </div>
      </div>
      <div className="cm-grid">
        <Climbers onPick={onPick} />
        <RankDistribution nickname={nickname || ""} />
        <Searched onPick={onPick} />
        <Renamed onPick={onPick} />
        <NewMembers onOpen={onOpen} />
      </div>
    </div>
  );
}
