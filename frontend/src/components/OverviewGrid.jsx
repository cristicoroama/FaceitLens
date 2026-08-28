import { useState } from "react";
import CountUp from "./CountUp.jsx";
import FormStrip from "./FormStrip.jsx";
import { Icon } from "../icons.jsx";

/* Card icons — Solar, Linear weight.
 *
 * These seven used to be hand-drawn inline SVGs, which made them a third icon
 * style on a page that already runs Bootstrap Icons everywhere else. Solar's
 * Linear weight is the same thin-stroke language as Bootstrap but tidier
 * geometry, so swapping only these takes the page from three styles to two
 * that agree. The small Bootstrap glyphs in chips and table headers stay: at
 * 13-16px the difference is invisible and churning them buys nothing.
 *
 * Imported per icon rather than from the package root so the bundle carries
 * seven components instead of 1,269.
 *
 * Icons are CC BY 4.0 by 480 Design — credited in the site footer, which is a
 * condition of the licence and not a courtesy. */
import { GraphUpIcon } from "@solar-icons/react/linear/graph-up";
import { TargetIcon } from "@solar-icons/react/linear/target";
import { CupStarIcon } from "@solar-icons/react/linear/cup-star";
import { BoltIcon } from "@solar-icons/react/linear/bolt";
import { StarIcon } from "@solar-icons/react/linear/star";
import { ClockCircleIcon } from "@solar-icons/react/linear/clock-circle";
import { FireIcon } from "@solar-icons/react/linear/fire";

const IC = {
  rating: <GraphUpIcon />,
  kd: <TargetIcon />,
  wr: <CupStarIcon />,
  adr: <BoltIcon />,
  elo: <StarIcon />,
  session: <ClockCircleIcon />,
  mk: <FireIcon />,
};

/* How far back each card looks.
 *
 * These cards sit side by side and cover three different windows: Rating, K/D
 * and ADR are the last 30 matches, Win Rate and Matches are the whole career,
 * Last Session is today. Unlabelled, that reads as contradiction — a K/D of
 * 1.51 next to 7,219 matches invites you to multiply them, and the answer is
 * wrong because the two numbers are not about the same games.
 *
 * The period belongs on the card, not in a footnote nobody reaches. */
function Card({ label, approx, period, value, color, trend, subs, ic }) {
  return (
    <div className="ov-card">
      {ic && <div className="ov-ic">{ic}</div>}
      <div className="ov-card-label">
        {label}
        {approx && <span className="ov-approx">*</span>}
        {period && <span className="ov-window">{period}</span>}
      </div>
      <div className="ov-card-value" style={color ? { color } : undefined}>
        {value}
        {trend && trend !== "flat" && (
          <span className={`trend ${trend === "up" ? "up" : "down"}`}>
            {trend === "up" ? "▲" : "▼"}
          </span>
        )}
      </div>
      {subs && (
        <div className="ov-card-subs">
          {subs.map((s) => (
            <div className="ov-sub" key={s.label}>
              <span>{s.label}</span>
              <span className="ov-sub-val">{s.value ?? "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OverviewGrid({ data, maps, mapFilter, onMapFilter }) {
  const s = data.stats || {};
  const ra = data.recent_avg || {};
  const h = data.hltv || {};
  const ex = data.elo_extremes || {};
  const mk = data.multikills;
  const sess = data.last_session;

  /* One window for the whole grid, chosen by the reader.
   *
   * These cards used to mix spans silently: K/D and ADR over the last 30
   * matches sitting beside a career win rate, same names, different questions.
   * Labelling each card helped, but the honest fix is to stop mixing — pick a
   * window and answer every card in it.
   *
   * Not every card has both. Rating 2.0 and its parts only exist over recent
   * matches, ELO is a present-tense number and the session card is today; those
   * keep their own label whatever is selected, because pretending otherwise
   * would be the same lie in a different place.
   */
  const [period, setPeriod] = useState("recent");
  const recent = period === "recent";
  const win = recent ? "last 30" : "all time";

  /* FACEIT's lifetime block sends ADR as a two-decimal string, "91.02", while
     our recent average is already rounded. Printed side by side across a
     toggle that is meant to change only the window, the extra decimals read as
     a different metric rather than the same one over more games. Damage per
     round is not meaningful to a hundredth either way. */
  const round1 = (v) => (v == null || v === "" ? null : Math.round(Number(v)));

  const kd = recent ? ra.kd : s.avg_kd;
  const adr = recent ? ra.adr : round1(s.adr);
  const kr = recent ? ra.kr : s.avg_kr;
  const hs = recent ? ra.hs : s.avg_hs;
  const winRate = recent ? ra.win_rate : s.win_rate;
  const matches = recent ? ra.matches : s.matches;

  function ratingColor(r) {
    if (r == null) return undefined;
    if (r >= 1.15) return "var(--win)";
    if (r < 0.95) return "var(--loss)";
    return "var(--accent)";
  }

  return (
    <>
      {sess && sess.tilt && (
        <div className="tilt-warn">{Icon.exclamationTriangle} Tilt warning — {sess.losses} losses this session, take a break</div>
      )}

      <div className="ov-head">
        <div className="section-title" style={{ margin: 0 }}>
          Overview {mapFilter ? `· ${mapFilter.replace("de_", "")}` : ""}
        </div>
        {/* Both filters in one group, hard right. `.ov-head` is a
            space-between flex, so a third child lands stranded in the middle
            of the row instead of beside the control it belongs with. */}
        <div className="ov-filters">
          <select
            className="map-filter"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Time window"
          >
            <option value="recent">Last 30 matches</option>
            <option value="all">All time</option>
          </select>
          {maps && maps.length > 0 && (
            <select className="map-filter" value={mapFilter || ""} onChange={(e) => onMapFilter(e.target.value || null)}>
              <option value="">All maps</option>
              {maps.map((m) => <option key={m} value={m}>{m.replace("de_", "")}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Above the cards: the last ten results are the first thing anyone
          scouting a player looks for, and the card grid only ever showed them
          summed into a "6-4" buried in the session card's third sub-row. */}
      <FormStrip matches={data.recent_matches} />

      <div className="ov-grid">
        <Card
          ic={IC.rating}
          label="Rating 2.0" approx period="last 30" value={h.rating ?? "—"} color={ratingColor(h.rating)}
          subs={[
            { label: "KPR", value: h.kpr },
            { label: "DPR", value: h.dpr },
            { label: "KAST*", value: h.kast != null ? `${h.kast}%` : null },
          ]}
        />
        <Card
          ic={IC.kd}
          label="K/D" period={win} value={kd ?? "—"} trend={recent ? data.kd_trend : undefined}
          subs={[
            { label: recent ? "Kills / match" : "Total kills", value: recent ? ra.kills : s.total_kills },
            { label: "Deaths", value: recent ? ra.deaths : null },
            { label: "Assists", value: recent ? ra.assists : null },
          ]}
        />
        <Card
          ic={IC.wr}
          label="Win Rate" period={win} value={winRate != null ? `${winRate}%` : "—"}
          subs={
            /* Streaks are career-long and have no thirty-match counterpart, so
               on the recent window they are replaced rather than shown under a
               heading that says "last 30". The record is derived from the two
               figures above it — 30 matches at 57% is 17-13 — which is the same
               fact stated in the form people actually quote. */
            recent
              ? [
                  { label: "Matches", value: matches },
                  {
                    label: "Record",
                    value:
                      matches != null && winRate != null
                        ? `${Math.round((matches * winRate) / 100)}W-${
                            matches - Math.round((matches * winRate) / 100)
                          }L`
                        : null,
                  },
                ]
              : [
                  { label: "Matches", value: matches },
                  { label: "Best streak", value: s.longest_win_streak },
                  { label: "Current", value: s.current_win_streak },
                ]
          }
        />
        <Card
          ic={IC.adr}
          label="ADR" period={win} value={adr ?? "—"}
          subs={[
            { label: "K/R", value: kr },
            { label: "HS%", value: hs != null ? `${hs}%` : null },
            { label: "Impact*", value: recent ? h.impact : null },
          ]}
        />
        <Card
          ic={IC.elo}
          label="ELO" period="current" value={<CountUp value={data.elo} />} color="var(--accent)"
          subs={[
            { label: "Highest", value: ex.high },
            { label: "Lowest", value: ex.low },
            { label: "Average", value: ex.avg },
          ]}
        />
        {sess && (
          <Card
            ic={IC.session}
            label="Last Session" period="today" value={`${sess.wins}-${sess.losses}`}
            color={sess.elo_change >= 0 ? "var(--win)" : "var(--loss)"}
            subs={[
              { label: "ELO", value: `${sess.elo_change >= 0 ? "+" : ""}${sess.elo_change}` },
              { label: "Streak", value: data.streak ? `${data.streak.count}${data.streak.type}` : "—" },
              { label: "Last 10", value: data.form },
            ]}
          />
        )}
        {mk && (
          <Card
            ic={IC.mk}
            label="Multi-Kills" period="last 50" value={mk.triple_total}
            subs={[
              { label: "Triple", value: mk.triple_total },
              { label: "Quad", value: mk.quadro_total },
              { label: "Ace (5K)", value: mk.penta_total },
            ]}
          />
        )}
      </div>
    </>
  );
}
