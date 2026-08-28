/**
 * The raw lifetime numbers behind the skill ratings: combat, entry fragging,
 * clutches and utility.
 *
 * Skill Ratings answers "how good", these answer "on what evidence" — so a
 * rating nobody agrees with can at least be argued with. Every value comes
 * straight from FACEIT's lifetime block; nothing here is modelled.
 *
 * A panel with no data at all doesn't render. A single missing row inside a
 * panel shows a dash, because "FACEIT never recorded this" is worth seeing
 * next to the rows it did record.
 */

const num = (v) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

/* FACEIT reports rates as 0-1 on some accounts and 0-100 on others. Anything
   at or below 1 can only be the fraction form. */
function pct(v, dp = 0) {
  const n = num(v);
  if (n == null) return null;
  const scaled = n <= 1 ? n * 100 : n;
  return `${scaled.toFixed(dp)}%`;
}

function dec(v, dp = 2) {
  const n = num(v);
  return n == null ? null : n.toFixed(dp);
}

function count(v) {
  const n = num(v);
  return n == null ? null : Math.round(n).toLocaleString();
}

/** "262 / 693" — a rate is easier to trust with the sample beside it. */
function ratio(wins, total) {
  const w = count(wins);
  const t = count(total);
  if (w == null || t == null) return w;
  return `${w} / ${t}`;
}

function Panel({ title, rows }) {
  const shown = rows.filter(([, v]) => v !== undefined);
  if (!shown.length || shown.every(([, v]) => v == null)) return null;

  return (
    <div className="sp">
      <div className="sp-title">{title}</div>
      {shown.map(([label, value]) => (
        <div className="sp-row" key={label}>
          <span className="sp-k">{label}</span>
          <span className={`sp-v ${value == null ? "none" : ""}`}>{value ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

export default function StatPanels({ stats }) {
  if (!stats) return null;
  const s = stats;

  const panels = [
    {
      title: "Combat",
      rows: [
        ["Average K/D", dec(s.avg_kd)],
        ["Average K/R", dec(s.avg_kr)],
        ["Headshots", pct(s.avg_hs)],
        ["ADR", dec(s.adr, 1)],
        /* Labelled, because the two numbers on this page cover different
           universes and read as a contradiction otherwise.
           FACEIT's "Matches" for CS2 carries the account's CS:GO history too —
           7,218 on the profile this was checked against, where FACEIT's own
           page splits it 2,478 CS2 and 4,747 CS:GO. "Total Kills with extended
           stats" only counts matches that have the advanced block, so it is
           CS2-only. Side by side and unlabelled they implied six kills a match
           for a player who averages twenty. */
        ["Total kills (CS2)", count(s.total_kills)],
      ],
    },
    {
      title: "Entry fragging",
      rows: [
        ["Entry rate", pct(s.entry_rate)],
        ["Entry success", pct(s.entry_success)],
        ["Entries won", ratio(s.total_entry_wins, s.total_entry_count)],
      ],
    },
    {
      title: "Clutches",
      rows: [
        ["1v1 win rate", pct(s.clutch_1v1)],
        ["1v2 win rate", pct(s.clutch_1v2)],
        ["1v1 won", ratio(s.total_1v1_wins, s.total_1v1_count)],
        ["1v2 won", ratio(s.total_1v2_wins, s.total_1v2_count)],
      ],
    },
    {
      title: "Utility",
      rows: [
        ["Damage / round", dec(s.util_damage_per_round)],
        ["Utility success", pct(s.util_success)],
        ["Flashes / round", dec(s.flashes_per_round)],
        ["Flash success", pct(s.flash_success)],
        ["Enemies flashed / round", dec(s.enemies_flashed_per_round)],
        ["Sniper kill rate", pct(s.sniper_kill_rate)],
      ],
    },
  ];

  const live = panels
    .map((p) => <Panel title={p.title} rows={p.rows} key={p.title} />)
    .filter(Boolean);

  // All four gone means a pre-CS2 account with none of these stats — no point
  // in a heading over an empty grid.
  if (!live.length) return null;

  return <div className="sp-grid">{live}</div>;
}
