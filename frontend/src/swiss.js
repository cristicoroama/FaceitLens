export const ROUNDS = 5;

function recordOf(st, id) {
  return st[id] || { w: 0, l: 0, opp: [] };
}

function difficulty(st, id) {
  return recordOf(st, id).opp.reduce((a, o) => a + recordOf(st, o).w - recordOf(st, o).l, 0);
}

function pairGroup(ids, st, seedOf) {
  const sorted = [...ids].sort((a, b) => difficulty(st, b) - difficulty(st, a) || seedOf[a] - seedOf[b]);
  const played = (a, b) => recordOf(st, a).opp.includes(b);
  function solve(left) {
    if (left.length < 2) return [];
    const [a, ...rest] = left;
    for (let j = rest.length - 1; j >= 0; j--) {
      if (played(a, rest[j])) continue;
      const sub = solve(rest.filter((_, i) => i !== j));
      if (sub) return [[a, rest[j]], ...sub];
    }
    return null;
  }
  const best = solve(sorted);
  if (best) return best;
  const pairs = [];
  const left = [...sorted];
  while (left.length >= 2) pairs.push([left.shift(), left.pop()]);
  return pairs;
}

export function simulate(teams, winners) {
  const ids = [...teams].sort((a, b) => (a.seed || 99) - (b.seed || 99)).map((t) => t.id);
  const seedOf = Object.fromEntries(ids.map((id, i) => [id, i + 1]));
  const st = Object.fromEntries(ids.map((id) => [id, { w: 0, l: 0, opp: [] }]));
  const rounds = [];
  let complete = true;

  for (let r = 1; r <= ROUNDS && complete; r++) {
    const active = ids.filter((id) => st[id].w < 3 && st[id].l < 3);
    const groups = {};
    for (const id of active) {
      const k = `${st[id].w}-${st[id].l}`;
      (groups[k] = groups[k] || []).push(id);
    }
    const round = { r, groups: [] };
    const keys = Object.keys(groups).sort((x, y) => {
      const [aw, al] = x.split("-").map(Number);
      const [bw, bl] = y.split("-").map(Number);
      return (bw - bl) - (aw - al);
    });
    for (const k of keys) {
      let pairs;
      if (r === 1) {
        const half = ids.length / 2;
        pairs = ids.slice(0, half).map((id, i) => [id, ids[i + half]]);
      } else {
        pairs = pairGroup(groups[k], st, seedOf);
      }
      round.groups.push({
        record: k,
        matches: pairs.map(([a, b]) => {
          const key = `${r}:${Math.min(a, b)}-${Math.max(a, b)}`;
          const w = winners[key];
          return { key, a, b, winner: w === a || w === b ? w : null };
        }),
      });
    }
    rounds.push(round);
    for (const g of round.groups) {
      for (const m of g.matches) {
        if (!m.winner) { complete = false; continue; }
        const loser = m.winner === m.a ? m.b : m.a;
        st[m.winner].w += 1;
        st[loser].l += 1;
        st[m.a].opp.push(m.b);
        st[m.b].opp.push(m.a);
      }
    }
  }

  const outcome = {};
  for (const id of ids) {
    const s = st[id];
    if (s.w === 3) outcome[id] = s.l === 0 ? "3-0" : `3-${s.l}`;
    else if (s.l === 3) outcome[id] = s.w === 0 ? "0-3" : `${s.w}-3`;
  }
  const done = complete && rounds.length === ROUNDS;
  const picks = done ? {
    "30": ids.filter((id) => outcome[id] === "3-0"),
    "03": ids.filter((id) => outcome[id] === "0-3"),
    adv: ids.filter((id) => outcome[id] === "3-1" || outcome[id] === "3-2"),
  } : null;
  return { rounds, outcome, picks, done, seedOf, records: st };
}

export function cleanWinners(teams, winners) {
  const { rounds } = simulate(teams, winners);
  const keep = {};
  for (const r of rounds) for (const g of r.groups) for (const m of g.matches) if (m.winner) keep[m.key] = m.winner;
  return keep;
}

export function fillRound(teams, winners, r, mode) {
  let next = { ...winners };
  const { rounds, seedOf } = simulate(teams, next);
  const round = rounds.find((x) => x.r === r);
  if (!round) return next;
  for (const g of round.groups) {
    for (const m of g.matches) {
      if (m.winner) continue;
      if (mode === "seed") next[m.key] = seedOf[m.a] <= seedOf[m.b] ? m.a : m.b;
      else next[m.key] = Math.random() < 0.5 ? m.a : m.b;
    }
  }
  return next;
}

export function fillAll(teams, winners, mode) {
  let w = { ...winners };
  for (let r = 1; r <= ROUNDS; r++) w = fillRound(teams, w, r, mode);
  return w;
}

export function resetFrom(teams, winners, r) {
  const keep = {};
  for (const [k, v] of Object.entries(winners)) if (Number(k.split(":")[0]) < r) keep[k] = v;
  return cleanWinners(teams, keep);
}
