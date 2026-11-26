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

import "../styles/stats.css";

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

function lifePct(v) {
  const n = num(v);
  if (n == null) return null;
  return n <= 1 ? n * 100 : n;
}

function perRound(total, rounds) {
  const t = num(total);
  const r = num(rounds);
  if (t == null || !r) return null;
  return t / r;
}

function sumRate(w1, c1, w2, c2) {
  const c = (num(c1) || 0) + (num(c2) || 0);
  if (!c) return null;
  return (((num(w1) || 0) + (num(w2) || 0)) / c) * 100;
}

function careerRows(s, r) {
  return [
    { label: "Entry rate", kind: "pct", now: num(r.entry_rate), then: lifePct(s.entry_rate), better: null, sample: r.entries != null && r.rounds ? `${r.entries} in ${r.rounds} rds` : null },
    { label: "Entry success", kind: "pct", now: num(r.entry_success), then: lifePct(s.entry_success), better: "high", sample: r.entries != null ? `${r.entry_wins ?? 0}/${r.entries}` : null },
    { label: "First kills / match", kind: "dec", now: r.matches ? perRound(r.first_kills, r.matches) : null, then: null, better: "high" },
    { label: "1v1 win rate", kind: "pct", now: num(r.v1_rate), then: lifePct(s.clutch_1v1), better: "high", sample: r.v1_count != null ? `${r.v1_wins ?? 0}/${r.v1_count}` : null },
    { label: "1v2 win rate", kind: "pct", now: num(r.v2_rate), then: lifePct(s.clutch_1v2), better: "high", sample: r.v2_count != null ? `${r.v2_wins ?? 0}/${r.v2_count}` : null },
    { label: "Clutch rate", kind: "pct", now: num(r.clutch_rate), then: sumRate(s.total_1v1_wins, s.total_1v1_count, s.total_1v2_wins, s.total_1v2_count), better: "high" },
    { label: "Flashes / round", kind: "dec", now: perRound(r.flashes, r.rounds), then: num(s.flashes_per_round), better: null },
    { label: "Flash success", kind: "pct", now: num(r.flash_success), then: lifePct(s.flash_success), better: "high" },
    { label: "Enemies flashed / round", kind: "dec", now: perRound(r.enemies_flashed, r.rounds), then: num(s.enemies_flashed_per_round), better: "high" },
    { label: "Utility damage / round", kind: "dec1", now: perRound(r.util_damage, r.rounds), then: num(s.util_damage_per_round), better: "high" },
    { label: "Utility success", kind: "pct", now: num(r.util_success), then: lifePct(s.util_success), better: "high" },
  ].filter((row) => row.now != null);
}

function fmtKind(kind, v) {
  if (v == null) return null;
  if (kind === "pct") return `${Math.round(v)}%`;
  if (kind === "dec1") return v.toFixed(1);
  return v.toFixed(2);
}

function Change({ row }) {
  if (row.now == null || row.then == null) return <span className="nvc-na">—</span>;
  const raw = row.now - row.then;
  const d = row.kind === "pct" ? Math.round(raw) : row.kind === "dec1" ? Math.round(raw * 10) / 10 : Math.round(raw * 100) / 100;
  if (d === 0) {
    return (
      <span className="nvc-delta flat">
        <span aria-hidden="true">= </span>same
      </span>
    );
  }
  const up = d > 0;
  const judged = row.better ? (up ? "good" : "bad") : "flat";
  const shown = row.kind === "pct" ? `${Math.abs(d)} pts` : Math.abs(d).toFixed(row.kind === "dec1" ? 1 : 2);
  return (
    <span className={`nvc-delta ${judged}`}>
      <span aria-hidden="true">{up ? "▲" : "▼"} </span>
      {up ? "+" : "−"}{shown}
      <span className="sr-only">{up ? " higher than career" : " lower than career"}</span>
    </span>
  );
}

function NowVsCareer({ stats, recent }) {
  if (!recent) return null;
  const rows = careerRows(stats || {}, recent);
  if (!rows.length) return null;
  return (
    <div className="nvc">
      <div className="nvc-head">
        <span className="nvc-title" id="nvc-title">Now vs career</span>
        <span className="nvc-sub">last {recent.matches} matches against lifetime, from FACEIT&apos;s own counts</span>
      </div>
      <div className="nvc-scroll">
        <table className="nvc-table" aria-labelledby="nvc-title">
          <thead>
            <tr>
              <th scope="col" className="nvc-l">Stat</th>
              <th scope="col">Last {recent.matches}</th>
              <th scope="col">Career</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="nvc-l">
                  {row.label}
                  {!row.better && <span className="nvc-role" title="A role signal, not better or worse"> · role</span>}
                </th>
                <td>
                  <b>{fmtKind(row.kind, row.now)}</b>
                  {row.sample && <span className="nvc-sample">{row.sample}</span>}
                </td>
                <td className="nvc-then">{fmtKind(row.kind, row.then) ?? "—"}</td>
                <td><Change row={row} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function StatPanels({ stats, recent }) {
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
  if (!live.length) return <NowVsCareer stats={s} recent={recent} />;

  return (
    <>
      <NowVsCareer stats={s} recent={recent} />
      <div className="sp-grid">{live}</div>
    </>
  );
}
