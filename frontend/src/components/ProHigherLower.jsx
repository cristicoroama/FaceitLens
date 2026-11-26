import { useCallback, useEffect, useRef, useState } from "react";
import { PRO_SETTINGS } from "../prosettings-data.js";
import { teamLogo } from "../team-logos.js";
import { Flag } from "./RankIcons.jsx";
import "../styles/community.css";

const KEY = "faceitlens_prohigherlower";
const POOL = PRO_SETTINGS
  .map((p) => ({ ...p, edpi: Math.round(Number(p.dpi) * Number(p.sens)) }))
  .filter((p) => Number.isFinite(p.edpi) && p.edpi > 0);

function loadBest() {
  try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; }
}
function saveBest(v) {
  try { localStorage.setItem(KEY, String(v)); } catch { return; }
}

function pickNext(exclude) {
  if (POOL.length < 2) return POOL[0];
  let p;
  do { p = POOL[Math.floor(Math.random() * POOL.length)]; } while (p.nick === exclude?.nick || p.edpi === exclude?.edpi);
  return p;
}

function ProCard({ pro, reveal, result }) {
  const logo = teamLogo({ name: pro.team });
  return (
    <div className={`hl-card${result ? ` ${result}` : ""}`}>
      {logo && <img className="hl-logo" src={logo} alt="" aria-hidden="true" />}
      <div className="hl-nick"><Flag country={pro.country} size={18} /> {pro.nick}</div>
      <div className="hl-team">{pro.team || "Free agent"} · {pro.role}</div>
      <div className="hl-value" aria-live="polite">{reveal ? pro.edpi : "?"}</div>
      <div className="hl-sub">{reveal ? `${pro.dpi} DPI × ${pro.sens}` : "eDPI"}</div>
    </div>
  );
}

export default function ProHigherLower() {
  const [left, setLeft] = useState(() => pickNext(null));
  const [right, setRight] = useState(() => pickNext(left));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(loadBest);
  const [phase, setPhase] = useState("guess");
  const [verdict, setVerdict] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const restart = useCallback(() => {
    clearTimeout(timer.current);
    const l = pickNext(null);
    setLeft(l);
    setRight(pickNext(l));
    setScore(0);
    setVerdict(null);
    setPhase("guess");
  }, []);

  function guess(higher) {
    if (phase !== "guess") return;
    const ok = higher ? right.edpi >= left.edpi : right.edpi <= left.edpi;
    setVerdict(ok ? "right" : "wrong");
    setPhase("reveal");
    const nextScore = ok ? score + 1 : score;
    if (ok) setScore(nextScore);
    if (nextScore > best) { setBest(nextScore); saveBest(nextScore); }
    timer.current = setTimeout(() => {
      if (!ok) { setPhase("over"); return; }
      setLeft(right);
      setRight(pickNext(right));
      setVerdict(null);
      setPhase("guess");
    }, 1100);
  }

  if (POOL.length < 2) return <div className="state">Pro data is unavailable right now.</div>;

  return (
    <div className="hl">
      <div className="page-hero">
        <div className="page-hero-title">Higher or <em>Lower</em></div>
        <div className="page-hero-sub">
          Does the next pro play with a higher or lower eDPI (DPI × in-game sensitivity)? One miss ends the run.
        </div>
      </div>

      <div className="hl-hud">
        <span>Streak <b>{score}</b></span>
        <span>Best <b>{best}</b></span>
      </div>

      <div className="hl-board">
        <ProCard pro={left} reveal />
        <div className="hl-vs">
          {phase === "guess" ? (
            <>
              <button type="button" className="act-btn hl-btn" onClick={() => guess(true)}>▲ Higher</button>
              <span className="hl-or">or</span>
              <button type="button" className="act-btn hl-btn" onClick={() => guess(false)}>▼ Lower</button>
            </>
          ) : (
            <span className={`hl-verdict ${verdict}`}>{verdict === "right" ? "Correct" : "Wrong"}</span>
          )}
        </div>
        <ProCard pro={right} reveal={phase !== "guess"} result={phase === "guess" ? null : verdict} />
      </div>

      {phase === "over" && (
        <div className="game-end hl-end">
          <div className="game-end-score">{score}</div>
          <div className="game-end-label">{score === best && score > 0 ? "New personal best" : `Best ${best}`}</div>
          <div className="game-again">
            <button type="button" className="act-btn" onClick={restart}>Play again</button>
          </div>
        </div>
      )}
      <div className="cm-foot">Settings from public pro config lists; they change often, so treat them as a snapshot.</div>
    </div>
  );
}
