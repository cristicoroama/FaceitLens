import { useNavigate } from "react-router-dom";
import TrustScore from "./TrustScore.jsx";
import Medals from "./Medals.jsx";
import Inventory from "./Inventory.jsx";
import PremierBadge from "./PremierBadge.jsx";
import { Flag } from "./RankIcons.jsx";
import { SteamIcon } from "./BrandIcons.jsx";
import { Icon } from "../icons.jsx";
import { LeetifyView } from "./LeetifyStats.jsx";

/** Steam-first profile — works for players with no FACEIT account.
    `profile` is the /api/steamprofile/ payload. */
export default function SteamProfileView({ profile }) {
  const navigate = useNavigate();
  if (!profile) return null;

  const inv = profile.inventory;
  const hasInv = inv && inv.available;
  const premier = profile.leetify?.ranks?.premier;
  const createdYear = profile.created
    ? new Date(profile.created * 1000).getFullYear()
    : null;

  return (
    <>
      <div className="player-hero">
        <div className="ph-top">
          <div className="ph-avatar">
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.persona || "Steam avatar"} />
            ) : (
              <div className="ph-avatar-empty" />
            )}
          </div>

          <div className="ph-info">
            <div className="ph-name">
              {profile.persona || `Player ${profile.steamid.slice(-5)}`}
              <span className="acct-badge steam" title="Steam profile (no FACEIT needed)" aria-label="Steam profile"><SteamIcon size={13} /></span>
              {profile.vac_banned && (
                <span className="acct-badge vac" title="VAC banned">VAC BAN</span>
              )}
            </div>
            <div className="ph-meta">
              <span className="ph-country">
                <Flag country={profile.country} />
                {profile.country ? profile.country.toUpperCase() : "—"}
              </span>
              {createdYear && <span>Member since {createdYear}</span>}
              {profile.hours_cs2 != null && <span>{profile.hours_cs2.toLocaleString()}h CS2</span>}
              {profile.steam_level != null && <span>Level {profile.steam_level}</span>}
            </div>
          </div>

          <div className="ph-elo">
            <div className="ph-elo-label">Premier</div>
            <div className="ph-elo-value premier">
              {premier != null ? <PremierBadge rating={premier} /> : <span className="ph-none">—</span>}
            </div>
          </div>
        </div>

        <div className="ph-actions">
          <a className="act-btn" href={profile.profile_url} target="_blank" rel="noopener noreferrer">
            <SteamIcon size={15} />
            Open Steam profile
            {Icon.boxArrowUpRight}
          </a>
          {profile.faceit_nickname && (
            <button
              className="act-btn on"
              onClick={() => navigate(`/player/${encodeURIComponent(profile.faceit_nickname)}`)}
            >
              FACEIT profile: {profile.faceit_nickname} →
            </button>
          )}
          {!profile.faceit_nickname && (
            <span className="form-badge">No linked FACEIT account found</span>
          )}
        </div>
      </div>

      <div className="account-layout">
        <div className="account-left">
          <TrustScore trust={profile.trust} steamLevel={profile.steam_level} />
        </div>
        <div className="account-right">
          {hasInv && inv.medals && inv.medals.length > 0 && <Medals medals={inv.medals} />}
          <Inventory inventory={inv} />
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 22 }}>Demo stats</div>
      <LeetifyView data={profile.leetify} />
    </>
  );
}
