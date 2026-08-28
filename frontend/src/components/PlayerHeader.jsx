import CountUp from "./CountUp.jsx";
import LevelProgress from "./LevelProgress.jsx";
import { FaceitLevel, Flag, ChallengerBadge } from "./RankIcons.jsx";
import { SteamIcon, FaceitIcon, TwitchIcon, ExternalIcon } from "./BrandIcons.jsx";
import { Icon } from "../icons.jsx";

/* FACEIT's Challenger badge goes to the top 1,000 of a region's level-10
   pool. It's positional, not an ELO band, so it's derived from the ranking
   position the API gives us rather than from ELO. */
const CHALLENGER_CUTOFF = 1000;

/** Quick-stat cell for the hero strip. */
function PS({ label, value, tone }) {
  return (
    <div className="ps">
      <div className={`ps-val ${tone || ""}`}>{value ?? "—"}</div>
      <div className="ps-label">{label}</div>
    </div>
  );
}

export default function PlayerHeader({ player, children }) {
  const s = player.stats || {};
  // The API's faceit_url is the reliable one (it survives odd nicknames);
  // fall back to building it so older cached payloads still get a link.
  const faceitUrl =
    player.faceit_url ||
    (player.nickname
      ? `https://www.faceit.com/en/players/${encodeURIComponent(player.nickname)}`
      : null);
  const rank = Number(player.ranking) || null;
  const isChallenger =
    Number(player.skill_level) === 10 && rank !== null && rank <= CHALLENGER_CUTOFF;
  const wr = s.win_rate != null ? Number(s.win_rate) : null;
  const kd = s.avg_kd != null ? Number(s.avg_kd) : null;
  const streak = player.streak
    ? `${player.streak.count}${player.streak.type}`
    : s.current_win_streak != null
    ? `${s.current_win_streak}W`
    : null;
  const streakTone = player.streak
    ? player.streak.type === "W"
      ? "pos"
      : "neg"
    : undefined;

  return (
    <div className={`player-hero ${player.cover ? "has-cover" : ""}`}>
      {/* The player's own FACEIT banner. Decorative, so it carries no alt text
          and never blocks the header: if the image 404s it just removes
          itself and the plain card underneath is what's left. */}
      {player.cover && (
        <div className="ph-cover" aria-hidden="true">
          <img
            src={player.cover}
            alt=""
            loading="lazy"
            onError={(e) => { e.currentTarget.parentElement.style.display = "none"; }}
          />
        </div>
      )}

      <div className="ph-top">
        <div className="ph-avatar">
          {player.avatar ? (
            <img src={player.avatar} alt={player.nickname} />
          ) : (
            <div className="ph-avatar-empty" />
          )}
          <div className="ph-lvl">
            <FaceitLevel level={player.skill_level} size={36} />
          </div>
        </div>

        <div className="ph-info">
          <div className="ph-name">
            {player.nickname}
            {/* Icon-only, the way every FACEIT tracker shows these: three small
                marks in a row, no text and no pill. A word-sized "PREMIUM"
                chip next to a nickname reads as a headline; the mark reads as
                a property of the account, which is what it is. */}
            {/* The real marks, as files rather than inline SVG. Both carry
                gradients and filters with fixed ids — "abcd", "filter0_i_6_71"
                — and two of those in one document would collide, with the
                second element silently painting itself with the first one's
                fill. An <img> gives each its own document and can't clash. */}
            {player.verified && (
              <img
                className="acct-badge"
                src="/badges/verified.svg"
                alt="Verified"
                title="Verified FACEIT account"
              />
            )}
            {player.memberships && player.memberships.some((m) => /premium/i.test(m)) && (
              <img
                className="acct-badge"
                src="/badges/premium.svg"
                alt="Premium"
                title="FACEIT Premium member"
              />
            )}
            {/* ESEA rides in the same `memberships` array as Premium — no
                extra call, no extra field. Matched exactly rather than by
                substring: the array also carries entries like
                "ow2_league_pass" and "super_match_token", and a loose test
                would eventually badge one of those as something it isn't. */}
            {player.memberships && player.memberships.some((m) => String(m).toLowerCase() === "esea") && (
              <img
                className="acct-badge"
                src="/badges/esea.png"
                alt="ESEA"
                title="ESEA subscriber"
              />
            )}
          </div>
          <div className="ph-meta">
            <span className="ph-country">
              <Flag country={player.country} />
              {player.country ? player.country.toUpperCase() : "—"}
            </span>
            {/* Outside the top 1,000 the position is just a number, so it
                stays plain text; inside it, the leaderboard pill is the
                recognisable thing and it carries the exact rank itself. */}
            {rank && !isChallenger ? (
              <span className="ph-rank">
                #{rank.toLocaleString()} {player.region || ""}
              </span>
            ) : null}
          </div>

          {/* Straight through to the source profiles. Each only renders when we
              actually have the id — a dead link is worse than no link. */}
          <div className="ph-links">
            {faceitUrl && (
              <a className="ph-link faceit" href={faceitUrl} target="_blank" rel="noopener noreferrer">
                <FaceitIcon />
                FACEIT Profile
                <ExternalIcon />
              </a>
            )}
            {player.steam_id && (
              <a
                className="ph-link steam"
                href={`https://steamcommunity.com/profiles/${player.steam_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <SteamIcon />
                Steam Profile
                <ExternalIcon />
              </a>
            )}
            {/* Twitch comes from FACEIT's `platforms` map — the account the
                player linked themselves. The backend already whitelists the
                platform and rejects anything that isn't a bare handle, so this
                is a handle going into a path, never a URL passed through. */}
            {player.platforms?.twitch && (
              <a
                className="ph-link twitch"
                href={`https://twitch.tv/${encodeURIComponent(player.platforms.twitch)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <TwitchIcon />
                Twitch
                <ExternalIcon />
              </a>
            )}
          </div>
        </div>

        <div className="ph-elo">
          {isChallenger && (
            <div className="ph-challenger" title={`Challenger — #${rank} in ${player.region || "region"}`}>
              <ChallengerBadge position={rank} size={22} />
            </div>
          )}
          <div className="ph-elo-label">Faceit ELO</div>
          <div className="ph-elo-row">
            <FaceitLevel level={player.skill_level} size={46} />
            <div className="ph-elo-value"><CountUp value={player.elo} /></div>
          </div>
        </div>
      </div>

      {/* Quick-stat strip — every figure here is career-long.
          Said out loud because the overview cards a screen below show the same
          names over the last 30 matches, and a K/D of 1.32 here against 1.44
          there reads as one of them being broken. Two windows, two answers,
          both right; the label is what makes that legible. */}
      <div className="ph-strip">
        <div className="ph-strip-tag">All time</div>
        <PS label="Matches" value={s.matches} />
        <PS
          label="Win Rate"
          value={wr != null ? `${wr}%` : null}
          tone={wr != null ? (wr >= 50 ? "pos" : "neg") : undefined}
        />
        <PS
          label="K/D"
          value={kd}
          tone={kd != null ? (kd >= 1 ? "pos" : "neg") : undefined}
        />
        <PS label="HS%" value={s.avg_hs != null ? `${s.avg_hs}%` : null} />
        <PS label="Streak" value={streak} tone={streakTone} />
      </div>

      {/* level progress lives inside the hero now */}
      <div className="ph-progress">
        <LevelProgress
          elo={player.elo}
          level={player.skill_level}
          challenger={isChallenger ? rank : null}
          bare
        />
      </div>

      {children && <div className="ph-actions">{children}</div>}
    </div>
  );
}
