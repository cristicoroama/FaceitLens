import CountUp from "./CountUp.jsx";
import LevelProgress from "./LevelProgress.jsx";
import LiveMatch from "./LiveMatch.jsx";
import { FaceitLevel, Flag, ChallengerBadge } from "./RankIcons.jsx";
import { SteamIcon, FaceitIcon, TwitchIcon } from "./BrandIcons.jsx";
import { DATE_LOCALE, DEFAULT_LOCALE, makeT } from "../i18n.js";
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
function accountAge(iso, lang) {
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
  const loc = DATE_LOCALE[lang] || undefined;
  const when = d.toLocaleDateString(loc, { month: "short", year: "numeric" });
  return { when, age, full: d.toLocaleDateString(loc, { day: "2-digit", month: "long", year: "numeric" }) };
}

/** "2m ago" — how stale the numbers on this page are.
 *
 * Shown next to the refresh button because a refresh control with no age is a
 * button you press hopefully. The profile is server-cached, so a reload can
 * legitimately return the same data; saying when it was fetched is what makes
 * that legible instead of looking broken.
 */
function sinceText(ts, t) {
  if (!ts) return null;
  const secs = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (secs < 60) return t("ph.justNow");
  if (secs < 3600) return t("ph.mAgo", { n: Math.floor(secs / 60) });
  if (secs < 86400) return t("ph.hAgo", { n: Math.floor(secs / 3600) });
  return t("ph.dAgo", { n: Math.floor(secs / 86400) });
}

/** Past names, in a dropdown beside the current one.
 *
 * Collapsed by default: on most accounts there is nothing to show, and on the
 * ones where there is, the old names are context rather than headline. The
 * caret only renders when there is actually something behind it. */
function NicknameMenu({ history, t, lang }) {
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
        aria-label={t("ph.prevNicks", { n: past.length })}
        title={t("ph.prevNicks", { n: past.length })}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true"
             stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <span className="ph-nicklist" role="list">
          <span className="ph-nicklist-head">{t("ph.prevKnown")}</span>
          {past.map((h) => (
            <span className="ph-nickrow" role="listitem" key={h.nickname}>
              <b>{h.nickname}</b>
              <i>
                {t("ph.matchesN", { n: h.matches })}
                {h.date_to ? ` · ${t("ph.last", { date: new Date(h.date_to * 1000).toLocaleDateString(DATE_LOCALE[lang], { month: "short", year: "numeric" }) })}` : ""}
              </i>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/** Quick-stat cell for the hero strip. */
function PS({ label, value, tone, title }) {
  return (
    <div className="ps" title={title}>
      <div className={`ps-val ${tone || ""}`}>{value ?? "—"}</div>
      <div className="ps-label">{label}</div>
    </div>
  );
}

export default function PlayerHeader({ player, children, onRefresh, refreshing, lang = DEFAULT_LOCALE }) {
  const t = makeT(lang);
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
  /* Absent until the region's population has been measured by the
     refresh_region_population command — a missing line, never a wrong one. */
  const pct = player.percentile || null;
  const isChallenger =
    Number(player.skill_level) === 10 && rank !== null && rank <= CHALLENGER_CUTOFF;
  const wr = s.win_rate != null ? Number(s.win_rate) : null;
  const kd = s.avg_kd != null ? Number(s.avg_kd) : null;
  const streak = player.streak
    ? `${player.streak.count}${player.streak.type}`
    : s.current_win_streak != null
    ? `${s.current_win_streak}W`
    : null;
  const age = accountAge(player.created_at, lang);
  const fetched = sinceText(player.fetched_at, t);
  const where = player.region || t("ph.region");
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
            <h1 className="sh-ph-nick">{player.nickname}</h1>
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
                alt={t("ph.verified")}
                title={t("ph.verified")}
              />
            )}
            {player.memberships && player.memberships.some((m) => /premium/i.test(m)) && (
              <img
                className="acct-badge"
                src="/badges/premium.svg"
                alt={t("ph.premium")}
                title={t("ph.premium")}
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
                alt={t("ph.esea")}
                title={t("ph.esea")}
              />
            )}
            {/* No team crest here, deliberately.
                FACEIT's teams for a player are premade squads anyone can name
                anything — s1mple's list holds two called "Natus Vincere" — and
                the API publishes nothing that says which, if any, he currently
                plays for. A crest in this row sits among verified and ESEA,
                marks that mean something exact, and would be read as "plays
                for NAVI". It does not say that, so it is not shown.
                The Overview section lists them for what they are. */}
            <NicknameMenu history={player.nickname_history} t={t} lang={lang} />
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
              <span className="ph-rank" title={t("ph.rankIn", { n: rank.toLocaleString(lang), where })}>
                {player.region === "EU" && (
                  <img className="ph-rank-flag" src="/flags/eu.svg" alt="" loading="lazy" />
                )}
                #{rank.toLocaleString()}
                <i>{player.region || ""}</i>
              </span>
            ) : null}
            {/* What that rank actually means.
                "#52,240" is unreadable on its own — the same number is elite
                in one region and mid-table in another. The percentage is the
                part people can act on, so it leads, and the raw counts sit in
                the tooltip for whoever wants to check the arithmetic. */}
            {pct && (
              <span
                className="ph-pct"
                title={t("ph.pctTitle", { pos: pct.position.toLocaleString(lang), pop: pct.population.toLocaleString(lang), where })}
              >
                {t("ph.top", { n: pct.top_percent < 1 ? pct.top_percent : Math.round(pct.top_percent) })}
              </span>
            )}
            {countryRank ? (
              <span
                className="ph-rank ph-rank-country"
                title={t("ph.rankIn", { n: countryRank.toLocaleString(lang), where: (player.country || "").toUpperCase() })}
              >
                <Flag country={player.country} size={14} />
                #{countryRank.toLocaleString()}
              </span>
            ) : null}
            {/* An old account is context for everything else on the page — a
                1.35 K/D over eleven years is a different claim than the same
                number over eleven months. */}
            {age && (
              <span className="ph-age" title={t("ph.created", { date: age.full })}>
                {t("ph.since", { when: age.when })}
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
                title={t("ph.faceitProfile")}
                aria-label={t("ph.faceitProfile")}
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
                title={t("ph.steamProfile")}
                aria-label={t("ph.steamProfile")}
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
                aria-label={t("ph.twitch")}
              >
                <TwitchIcon />
              </a>
            )}
          </div>
        </div>

        <div className="ph-elo">
          {children && (
            <div className="sh-ph-quick" role="group" aria-label={t("ph.actions")}>{children}</div>
          )}
          {isChallenger && (
            <div className="ph-challenger" title={t("ph.challenger", { n: rank, where })}>
              <ChallengerBadge position={rank} size={22} />
            </div>
          )}
          <div className="ph-elo-label">{t("ph.faceitElo")}</div>
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
      {onRefresh && (
        <div className="ph-bar">
          {(
            <div className="ph-sync">
              {fetched && <span className="ph-sync-when">{t("ph.updated", { when: fetched })}</span>}
              <button
                type="button"
                className={`ph-refresh ${refreshing ? "spinning" : ""}`}
                onClick={onRefresh}
                disabled={refreshing}
                title={t("ph.fetchFresh")}
                aria-label={t("ph.refresh")}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true"
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
        <div className="ph-strip-tag">{t("ph.allTime")}</div>
        {/* Every match on the account, both Counter-Strikes. The rest of this
            strip is CS2 — the Game history panel in the sidebar splits the
            total back out per title, and the tabs below are CS2 throughout. */}
        <PS
          label={t("ph.matches")}
          value={player.total_matches ?? s.matches}
          title={
            player.total_matches && (player.game_history || []).length > 1
              ? (player.game_history || [])
                  .filter((g) => g.matches)
                  .map((g) => `${g.label} ${g.matches.toLocaleString(lang)}`)
                  .join(" · ")
              : undefined
          }
        />
        <PS
          label={t("ph.winRate")}
          value={wr != null ? `${wr}%` : null}
          tone={wr != null ? (wr >= 50 ? "pos" : "neg") : undefined}
        />
        <PS
          label={t("ph.kd")}
          value={kd}
          tone={kd != null ? (kd >= 1 ? "pos" : "neg") : undefined}
        />
        <PS label={t("ph.hs")} value={s.avg_hs != null ? `${s.avg_hs}%` : null} />
        <PS label={t("ph.streak")} value={streak} tone={streakTone} />
      </div>

      {/* Above the level bar, below the identity block: the one thing on this
          card that is true only right now belongs next to the numbers it
          explains, not floating over them as an alert. */}
      {/* Mounted unconditionally: it polls, so a match that starts while the
          profile is open appears without a reload. It renders nothing when
          the player is not in one, and .ph-live carries only side padding, so
          the empty slot takes no height. */}
      <div className="ph-live">
        <LiveMatch
          playerId={player.player_id}
          initial={player.live}
          nickname={player.nickname}
        />
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
          percentile={pct}
          region={player.region}
        />
      </div>

    </div>
  );
}
