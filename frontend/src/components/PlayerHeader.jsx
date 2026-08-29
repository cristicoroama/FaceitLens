import CountUp from "./CountUp.jsx";
import LevelProgress from "./LevelProgress.jsx";
import { FaceitLevel, Flag, ChallengerBadge } from "./RankIcons.jsx";
import { SteamIcon, FaceitIcon, TwitchIcon } from "./BrandIcons.jsx";
import { ResultChip } from "./FormStrip.jsx";
import { useState } from "react";

/* FACEIT's Challenger badge goes to the top 1,000 of a region's level-10
   pool. It's positional, not an ELO band, so it's derived from the ranking
   position the API gives us rather than from ELO. */
const CHALLENGER_CUTOFF = 1000;

/** "Jul 2013 · 13y" — when the account was made, and how long ago that was.
 *
 * The date alone makes you do arithmetic; the age alone loses the fact that
 * this is a 2013 account, which is the part people find interesting. Both, in
 * that order, because the date is the fact and the age is the gloss on it.
 *
 * Returns null rather than a placeholder when the timestamp is missing: it
 * comes from an undocumented endpoint that may simply stop answering, and an
 * empty slot is better than a dash pretending to be data.
 */
function accountAge(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;

  const now = new Date();
  if (d > now) return null;   // a clock skew shouldn't render "-0y"

  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  const years = Math.floor(months / 12);

  // Under a year, months are the meaningful unit; a brand-new account would
  // otherwise read "0y", which says less than nothing.
  const age = years >= 1 ? `${years}y` : `${Math.max(0, months)}mo`;
  const when = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  return { when, age, full: d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) };
}

/** "2m ago" — how stale the numbers on this page are.
 *
 * Shown next to the refresh button because a refresh control with no age is a
 * button you press hopefully. The profile is server-cached, so a reload can
 * legitimately return the same data; saying when it was fetched is what makes
 * that legible instead of looking broken.
 */
function sinceText(ts) {
  if (!ts) return null;
  const secs = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

/** Past names, in a dropdown beside the current one.
 *
 * Collapsed by default: on most accounts there is nothing to show, and on the
 * ones where there is, the old names are context rather than headline. The
 * caret only renders when there is actually something behind it. */
function NicknameMenu({ history }) {
  const [open, setOpen] = useState(false);
  const past = (history || []).filter((h) => !h.is_current);
  if (!past.length) return null;

  return (
    <span className="ph-nickmenu">
      <button
        type="button"
        className={`ph-nickcaret ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${past.length} previous nickname${past.length === 1 ? "" : "s"}`}
        title={`${past.length} previous nickname${past.length === 1 ? "" : "s"}`}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
             stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <span className="ph-nicklist" role="list">
          <span className="ph-nicklist-head">Previously known as</span>
          {past.map((h) => (
            <span className="ph-nickrow" role="listitem" key={h.nickname}>
              <b>{h.nickname}</b>
              <i>
                {h.matches} match{h.matches === 1 ? "" : "es"}
                {h.date_to ? ` · last ${new Date(h.date_to * 1000).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : ""}
              </i>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/** Quick-stat cell for the hero strip. */
function PS({ label, value, tone }) {
  return (
    <div className="ps">
      <div className={`ps-val ${tone || ""}`}>{value ?? "—"}</div>
      <div className="ps-label">{label}</div>
    </div>
  );
}

export default function PlayerHeader({ player, children, onRefresh, refreshing }) {
  const s = player.stats || {};
  // The API's faceit_url is the reliable one (it survives odd nicknames);
  // fall back to building it so older cached payloads still get a link.
  const faceitUrl =
    player.faceit_url ||
    (player.nickname
      ? `https://www.faceit.com/en/players/${encodeURIComponent(player.nickname)}`
      : null);
  const rank = Number(player.ranking) || null;
  const countryRank = Number(player.ranking_country) || null;
  const isChallenger =
    Number(player.skill_level) === 10 && rank !== null && rank <= CHALLENGER_CUTOFF;
  const wr = s.win_rate != null ? Number(s.win_rate) : null;
  const kd = s.avg_kd != null ? Number(s.avg_kd) : null;
  const streak = player.streak
    ? `${player.streak.count}${player.streak.type}`
    : s.current_win_streak != null
    ? `${s.current_win_streak}W`
    : null;
  const age = accountAge(player.created_at);
  // Newest first, five of them — the ticker in the reference reads left to
  // right as most-recent to oldest, which is the order recent_matches is
  // already sorted in.
  const form = (player.recent_matches || []).slice(0, 5);
  const fetched = sinceText(player.fetched_at);
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
            {/* Flag first, the way every tracker in this space puts it. It
                reads as a property of the name rather than a separate fact
                filed on the line below, which is how a nationality actually
                works. Still carries a title, so a flag nobody recognises is
                one hover away from being named. */}
            {player.country && (
              <span className="ph-name-flag" title={player.country.toUpperCase()}>
                <Flag country={player.country} size={22} />
              </span>
            )}
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
            <NicknameMenu history={player.nickname_history} />
          </div>
          <div className="ph-meta">
            {/* Region rank.

                Europe gets the EU flag; every other region gets no mark at
                all, because none of them has one that isn't a lie — there is
                no flag for "North America" or "South East Asia", and using a
                member country's would be worse than nothing. The region code
                carries the meaning in all cases.

                Hidden for Challengers: the badge over by the ELO already
                carries the exact position. The country rank has no such
                duplicate, so that one always shows. */}
            {rank && !isChallenger ? (
              <span className="ph-rank" title={`#${rank.toLocaleString()} in ${player.region || "region"}`}>
                {player.region === "EU" && (
                  <img className="ph-rank-flag" src="/flags/eu.svg" alt="" loading="lazy" />
                )}
                #{rank.toLocaleString()}
                <i>{player.region || ""}</i>
              </span>
            ) : null}
            {countryRank ? (
              <span
                className="ph-rank ph-rank-country"
                title={`#${countryRank.toLocaleString()} in ${(player.country || "").toUpperCase()}`}
              >
                <Flag country={player.country} size={14} />
                #{countryRank.toLocaleString()}
              </span>
            ) : null}
            {/* An old account is context for everything else on the page — a
                1.35 K/D over eleven years is a different claim than the same
                number over eleven months. */}
            {age && (
              <span className="ph-age" title={`FACEIT account created ${age.full}`}>
                Since {age.when}
                <i>{age.age}</i>
              </span>
            )}
          </div>

          {/* Straight through to the source profiles. Each only renders when we
              actually have the id — a dead link is worse than no link. */}
          <div className="ph-links">
            {faceitUrl && (
              <a
                className="ph-link faceit"
                href={faceitUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="FACEIT profile"
                aria-label="FACEIT profile"
              >
                <FaceitIcon />
              </a>
            )}
            {player.steam_id && (
              <a
                className="ph-link steam"
                href={`https://steamcommunity.com/profiles/${player.steam_id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Steam profile"
                aria-label="Steam profile"
              >
                <SteamIcon />
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
                title={`Twitch — ${player.platforms.twitch}`}
                aria-label="Twitch channel"
              >
                <TwitchIcon />
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
      {/* Last five results and how fresh the page is, on one line above the
          career strip. Both answer "is this worth reading right now" — one
          about the player, one about the data. */}
      {(form.length > 0 || onRefresh) && (
        <div className="ph-bar">
          {form.length > 0 && (
            <div className="ph-form" title="Last 5 matches, newest first">
              <span className="ph-form-label">Last 5</span>
              {form.map((m, i) => (
                <ResultChip
                  key={m.match_id || i}
                  won={m.won}
                  title={m.finished_at
                    ? new Date(m.finished_at * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                    : undefined}
                />
              ))}
            </div>
          )}
          {onRefresh && (
            <div className="ph-sync">
              {fetched && <span className="ph-sync-when">Updated {fetched}</span>}
              <button
                type="button"
                className={`ph-refresh ${refreshing ? "spinning" : ""}`}
                onClick={onRefresh}
                disabled={refreshing}
                title="Fetch fresh data"
                aria-label="Refresh player data"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
                     stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

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
        {/* No `challenger` prop: the badge is already up beside the ELO, and
            rendering it here too put the same "#236" twice on one card, two
            rows apart. LevelProgress falls back to its normal current-level
            tick without it. */}
        <LevelProgress
          elo={player.elo}
          level={player.skill_level}
          bare
        />
      </div>

      {children && <div className="ph-actions">{children}</div>}
    </div>
  );
}
