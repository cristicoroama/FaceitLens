import { useState, useEffect } from "react";
import { WEAPONS, TRIVIA } from "../games-data.js";

const API_BASE = import.meta.env.VITE_API_URL || "";
const ROUND = 10;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build 10 questions for the chosen game.
function buildQuestions(game) {
  if (game === "trivia") {
    return shuffle(TRIVIA).slice(0, ROUND).map((t) => ({
      prompt: t.q,
      options: t.options,
      answer: t.answer,
    }));
  }
  // price: show weapon, 4 price options
  return shuffle(WEAPONS).slice(0, ROUND).map((w) => {
    const wrong = shuffle(WEAPONS.filter((x) => x.price !== w.price))
      .slice(0, 3)
      .map((x) => x.price);
    const options = shuffle([w.price, ...wrong]);
    return {
      prompt: `How much does the ${w.name} cost?`,
      options: options.map((p) => `$${p}`),
      answer: options.indexOf(w.price),
    };
  });
}

function Leaderboard({ game, refresh }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    fetch(`${API_BASE}/api/games/leaderboard/?game=${game}`)
      .then((r) => r.json())
      .then((j) => setItems(j.items || []))
      .catch(() => setItems([]));
  }, [game, refresh]);

  return (
    <div className="gl">
      <div className="gl-title">Top 10</div>
      {items.length === 0 ? (
        <div className="state" style={{ padding: "16px 0" }}>No scores yet — be the first!</div>
      ) : (
        items.map((r, i) => (
          <div className="gl-row" key={i}>
            <span className="gl-rank">#{i + 1}</span>
            <span className="gl-name">{r.name}</span>
            <span className="gl-score">{r.score}</span>
          </div>
        ))
      )}
    </div>
  );
}

export default function Games() {
  const [game, setGame] = useState(null); // null | "price" | "trivia"
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [refresh, setRefresh] = useState(0);

  function start(g) {
    setGame(g);
    setQuestions(buildQuestions(g));
    setIdx(0);
    setScore(0);
    setPicked(null);
    setDone(false);
    setSubmitted(false);
    setName("");
  }

  function pick(i) {
    if (picked !== null) return;
    setPicked(i);
    const correct = i === questions[idx].answer;
    if (correct) setScore((s) => s + 10);
    setTimeout(() => {
      if (idx + 1 >= questions.length) {
        setDone(true);
      } else {
        setIdx((x) => x + 1);
        setPicked(null);
      }
    }, 800);
  }

  async function submit() {
    try {
      await fetch(`${API_BASE}/api/games/score/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, name: name.trim() || "Anonymous", score }),
      });
      setSubmitted(true);
      setRefresh((r) => r + 1);
    } catch {
      setSubmitted(true);
    }
  }

  // Game picker
  if (!game) {
    return (
      <div className="games-pick">
        <div className="game-card" onClick={() => start("price")}>
          <div className="game-card-icon">💰</div>
          <div className="game-card-title">Guess the Price</div>
          <div className="game-card-desc">How well do you know the CS2 buy menu?</div>
        </div>
        <div className="game-card" onClick={() => start("trivia")}>
          <div className="game-card-icon">🧠</div>
          <div className="game-card-title">CS Trivia</div>
          <div className="game-card-desc">Test your Counter-Strike knowledge.</div>
        </div>
        <div className="games-boards">
          <div>
            <div className="section-title">Guess the Price</div>
            <Leaderboard game="price" refresh={refresh} />
          </div>
          <div>
            <div className="section-title">CS Trivia</div>
            <Leaderboard game="trivia" refresh={refresh} />
          </div>
        </div>
      </div>
    );
  }

  // End screen
  if (done) {
    return (
      <div className="game-end">
        <div className="game-end-score">{score}</div>
        <div className="game-end-label">
          {score / 10} / {questions.length} correct
        </div>
        {!submitted ? (
          <div className="game-submit">
            <input
              type="text"
              maxLength={24}
              placeholder="Your name for the leaderboard"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button onClick={submit}>Submit</button>
          </div>
        ) : (
          <div className="state" style={{ padding: "10px 0" }}>Score submitted! 🎉</div>
        )}
        <Leaderboard game={game} refresh={refresh} />
        <div className="game-again">
          <button className="act-btn" onClick={() => start(game)}>Play again</button>
          <button className="act-btn" onClick={() => setGame(null)}>Back to games</button>
        </div>
      </div>
    );
  }

  // Active question
  const q = questions[idx];
  return (
    <div className="game-play">
      <div className="game-hud">
        <span>Question {idx + 1}/{questions.length}</span>
        <span className="game-score">Score: {score}</span>
      </div>
      <div className="game-prompt">{q.prompt}</div>
      <div className="game-options">
        {q.options.map((opt, i) => {
          let cls = "game-opt";
          if (picked !== null) {
            if (i === q.answer) cls += " correct";
            else if (i === picked) cls += " wrong";
          }
          return (
            <button key={i} className={cls} onClick={() => pick(i)} disabled={picked !== null}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
