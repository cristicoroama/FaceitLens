import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TrustScore from "./TrustScore.jsx";
import Medals from "./Medals.jsx";
import Inventory from "./Inventory.jsx";
import PremierBadge from "./PremierBadge.jsx";
import { Flag } from "./RankIcons.jsx";
import { SteamIcon } from "./BrandIcons.jsx";
import { Icon } from "../icons.jsx";
import { LeetifyView } from "./LeetifyStats.jsx";
import { CsrepView } from "./CsrepStats.jsx";

/** CSRep's current Premier rating.
 *
 * They key Premier by season — "premier:season4", "premier:season5" — with
 * older seasons left null, so the newest key that actually has a rating is
 * the current one. Sorted numerically, not lexically: "season10" must beat
 * "season9", which a string comparison gets backwards. */
function csrepPremier(csrep) {
  const seasons = Object.entries(csrep?.ranks || {})
    .filter(([k, v]) => k.startsWith("premier:") && v && v.current != null)
    .map(([k, v]) => [parseInt(k.replace(/\D+/g, ""), 10) || 0, v.current])
    .sort((a, b) => b[0] - a[0]);
  return seasons.length ? seasons[0][1] : null;
}

/** Steam-first profile — works for players with no FACEIT account.
    `profile` is the /api/steamprofile/ payload. */
export default function SteamProfileView({ profile }) {
  const navigate = useNavigate();

  // Which provider fills the stats block and the Premier plate.
  //
  // This page has no FACEIT tab to fall back on, and the two sources answer
  // different questions — Leetify derives skill from demos, CSRep reports
  // reputation — so neither is the "right" default and the visitor picks.
  // Leetify leads only because it is what this page has always shown.
  const [source, setSource] = useState("leetify");

  if (!profile) return null;

  const inv = profile.inventory;
  const hasInv = inv && inv.available;

  const hasLeetify = !!profile.leetify?.available;
  const hasCsrep = !!profile.csrep?.available;
  // Fall through to whichever source actually has data, so the block is never
  // empty while the other provider is sitting there with an answer.
  const active = source === "csrep"
    ? (hasCsrep ? "csrep" : "leetify")
    : (hasLeetify ? "leetify" : (hasCsrep ? "csrep" : "leetify"));

  const premier = active === "csrep"
    ? csrepPremier(profile.csrep)
    : profile.leetify?.ranks?.premier;

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
              <span className="acct-badge steam" title="Steam profile (no FACEIT needed)" aria-label="Steam profile"><SteamIcon size={20} /></span>
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
              {/* Sized against the ELO figure a FACEIT profile shows in this
                  same slot — at the 24px default the plate read as a footnote
                  next to a 46px number. */}
              {premier != null ? <PremierBadge rating={premier} height={38} /> : <span className="ph-none">—</span>}
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

      <div className="src-head">
        <div className="section-title" style={{ margin: 0 }}>
          {active === "csrep" ? "Reputation" : "Demo stats"}
        </div>
        {/* Only worth offering when both providers actually answered — a
            toggle with one working side is a dead control. */}
        {hasLeetify && hasCsrep && (
          <div className="src-switch" role="group" aria-label="Data source">
            <button
              type="button"
              className={`src-opt${active === "leetify" ? " on" : ""}`}
              onClick={() => setSource("leetify")}
            >
              Leetify
            </button>
            <button
              type="button"
              className={`src-opt${active === "csrep" ? " on" : ""}`}
              onClick={() => setSource("csrep")}
            >
              CSRep
            </button>
          </div>
        )}
      </div>

      {active === "csrep"
        ? <CsrepView data={profile.csrep} />
        : <LeetifyView data={profile.leetify} />}
    </>
  );
}
