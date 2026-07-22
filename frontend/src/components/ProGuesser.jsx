import { useState, useMemo } from "react";
import { PROS } from "../pros-data.js";
import { Flag } from "./RankIcons.jsx";

const KEY = "faceitlens_proguesser";
const MAX_TRIES = 8;

// Deterministic "pro of the day": same for everyone on a given UTC date.
function daySeed() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000);
}
function todayKey() {
  const n = new Date();
  return `${n.getUTCFullYear()}-${n.getUTCMonth() + 1}-${n.getUTCDate()}`;
}

function loadState() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function saveState(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// compare guess attribute vs solution → "hit" | "close" | "miss" (+ arrow)
function cmp(field, guess, sol) {
  if (field === "country") {
    if (guess.country.code === sol.country.code) return { s: "hit" };
    if (guess.region === sol.region) return { s: "close" };
    return { s: "miss" };
  }
  if (field === "region" || field === "role") {
    return { s: guess[field] === sol[field] ? "hit" : "miss" };
  }
  // numeric: majors / age
  const a = guess[field], b = sol[field];
  if (a === b) return { s: "hit" };
  return { s: "miss", arrow: a < b ? "▲" : "▼" }; // arrow points toward the answer
}

const COLS = [
  { key: "country", label: "Country" },
  { key: "region", label: "Region" },
  { key: "role", label: "Role" },
  { key: "majors", label: "Majors" },
  { key: "age", label: "Age" },
];

export default function ProGuesser() {
  const solution = useMemo(() => PROS[daySeed() % PROS.length], []);
  const [saved, setSaved] = useState(loadState);

  const today = todayKey();
  const dayData = saved[today] || { guesses: [], won: false, done: false };
  const [guesses, setGuesses] = useState(dayData.guesses);
  const [done, setDone] = useState(dayData.done);
  const [won, setWon] = useState(dayData.won);
  const [input, setInput] = useState("");

  const remaining = PROS.filter(
    (p) => !guesses.some((g) => g.nickname === p.nickname)
  );
  const matches = input.trim()
    ? remaining.filter((p) => p.nickname.toLowerCase().includes(input.trim().toLowerCase())).slice(0, 6)
    : [];

  function persist(nextGuesses, nextWon, nextDone) {
    const s = { ...saved, [today]: { guesses: nextGuesses, won: nextWon, done: nextDone } };
    if (nextDone) {
      // streak bookkeeping
      const y = new Date(); y.setUTCDate(y.getUTCDate() - 1);
      const ykey = `${y.getUTCFullYear()}-${y.getUTCMonth() + 1}-${y.getUTCDate()}`;
      const prevStreak = s.streak || 0;
      const lastWonDay = s.lastWonDay;
      if (nextWon) s.streak = lastWonDay === ykey ? prevStreak + 1 : 1;
      s.lastWonDay = nextWon ? today : s.lastWonDay;
      if (!nextWon) s.streak = 0;
    }
    setSaved(s); saveState(s);
  }

  function guess(pro) {
    if (done) return;
    const next = [...guesses, pro];
    setGuesses(next);
    setInput("");
    const isWin = pro.nickname === solution.nickname;
    const isDone = isWin || next.length >= MAX_TRIES;
    if (isWin) setWon(true);
    if (isDone) setDone(true);
    persist(next, isWin, isDone);
  }

  const streak = saved.streak || 0;

  function shareResult() {
    const grid = guesses.map((g) => {
      return COLS.map((c) => {
        const r = cmp(c.key, g, solution);
        return r.s === "hit" ? "🟩" : r.s === "close" ? "🟨" : "⬛";
      }).join("");
    }).join("\n");
    const head = `ProGuesser — ${won ? guesses.length + "/" + MAX_TRIES : "X/" + MAX_TRIES}`;
    navigator.clipboard.writeText(`${head}\n${grid}\nfaceit-lens.com/proguesser`);
  }

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-title">
          <div className="panel-ic" style={{ width: 38, height: 38 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 18, height: 18 }}>
              <path d="M12 2a7 7 0 0 0-4 12.7V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3A7 7 0 0 0 12 2Z" /><path d="M9 21h6" />
            </svg>
          </div>
          Pro <em>Guesser</em>
        </div>
        <div className="page-hero-sub">
          Guess the mystery CS pro in {MAX_TRIES} tries. Each guess reveals how close
          you are on country, region, role, majors and age. New legend every day.
        </div>
      </div>

      {streak > 0 && <div className="pg-streak">🔥 Win streak: <b>{streak}</b></div>}

      {!done && (
        <div className="pg-search">
          <input
            type="text"
            placeholder={`Guess a pro… (${MAX_TRIES - guesses.length} left)`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && matches[0] && guess(matches[0])}
          />
          {matches.length > 0 && (
            <div className="pg-suggest">
              {matches.map((p) => (
                <div className="pg-suggest-row" key={p.nickname} onClick={() => guess(p)}>
                  <Flag country={p.country.code} size={18} />
                  {p.nickname}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {done && (
        <div className={`pg-result ${won ? "win" : "lose"}`}>
          <div className="pg-result-title">
            {won ? "🎉 You got it!" : "💀 Out of tries"}
          </div>
          <div className="pg-result-sol">
            The pro was <Flag country={solution.country.code} size={20} /> <b>{solution.nickname}</b>
            {" "}· {solution.role} · {solution.majors} major{solution.majors === 1 ? "" : "s"}
          </div>
          <button className="btn-primary" onClick={shareResult} style={{ marginTop: 14, padding: "12px 22px" }}>
            Copy result
          </button>
          <div className="pg-result-hint">New puzzle tomorrow.</div>
        </div>
      )}

      {guesses.length > 0 && (
        <div className="pg-board">
          <div className="pg-row pg-head">
            <span className="pg-cell pg-name-cell">Player</span>
            {COLS.map((c) => <span className="pg-cell" key={c.key}>{c.label}</span>)}
          </div>
          {guesses.map((g, i) => (
            <div className="pg-row" key={i} style={{ animationDelay: `${i * 0.03}s` }}>
              <span className="pg-cell pg-name-cell">
                <Flag country={g.country.code} size={16} />{g.nickname}
              </span>
              {COLS.map((c) => {
                const r = cmp(c.key, g, solution);
                let val = g[c.key];
                if (c.key === "country") val = g.country.name;
                return (
                  <span className={`pg-cell pg-${r.s}`} key={c.key}>
                    {val}{r.arrow ? <span className="pg-arrow">{r.arrow}</span> : ""}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div className="pg-legend">
        <span><i className="pg-hit" /> exact</span>
        <span><i className="pg-close" /> same region</span>
        <span>▲▼ higher / lower</span>
      </div>
    </>
  );
}
