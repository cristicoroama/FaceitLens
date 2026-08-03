import { useEffect, useState } from "react";
import { FaceitLevel } from "./RankIcons.jsx";
import { Icon } from "../icons.jsx";

/** Build the slide list from a player summary. Skips slides with no data. */
function buildSlides(p) {
  const s = p.stats || {};
  const ex = p.elo_extremes || {};
  const topMap = (p.map_stats || [])[0];
  const bestMate = (p.best_teammates || [])[0];
  const nemesis = (p.nemeses || [])[0];
  const slides = [];

  slides.push({
    kind: "intro",
    title: `${p.nickname}`,
    sub: "Your CS2 career, wrapped.",
  });
  if (s.matches) {
    slides.push({
      kind: "big",
      pre: "You played",
      big: `${s.matches}`,
      post: "matches played",
    });
  }
  if (s.win_rate != null) {
    slides.push({
      kind: "big",
      pre: "You won",
      big: `${s.win_rate}%`,
      post: "of them",
      tone: Number(s.win_rate) >= 50 ? "good" : "bad",
    });
  }
  if (ex.high) {
    slides.push({
      kind: "big",
      pre: "Your peak was",
      big: `${ex.high}`,
      post: "ELO — your mountaintop",
    });
  }
  if (topMap) {
    slides.push({
      kind: "map",
      pre: "Your home map",
      map: topMap.map,
      big: `${topMap.win_rate}%`,
      post: `win rate on ${(topMap.map || "").replace(/^de_/, "")}`,
    });
  }
  if (s.avg_kd) {
    slides.push({
      kind: "big",
      pre: "You fragged at",
      big: `${s.avg_kd}`,
      post: "K/D on average",
      tone: Number(s.avg_kd) >= 1 ? "good" : "bad",
    });
  }
  if (bestMate) {
    slides.push({
      kind: "person",
      pre: "Your duo",
      name: bestMate.nickname,
      avatar: bestMate.avatar,
      big: `${bestMate.win_rate}%`,
      post: `win rate together · ${bestMate.games} games`,
      tone: "good",
    });
  }
  if (nemesis) {
    slides.push({
      kind: "person",
      pre: "Your nemesis",
      name: nemesis.nickname,
      avatar: nemesis.avatar,
      big: `${nemesis.win_rate}%`,
      post: `your win rate vs them · ${nemesis.games} clashes`,
      tone: "bad",
    });
  }
  slides.push({
    kind: "outro",
    title: `Level ${p.skill_level ?? "?"} · ${p.elo ?? "?"} ELO`,
    sub: "See you on the server.",
    level: p.skill_level,
  });
  return slides;
}

function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

export default function Wrapped({ player, onClose }) {
  const slides = buildSlides(player);
  const [i, setI] = useState(0);
  const [key, setKey] = useState(0); // remount to replay animation
  const cur = slides[i];

  const next = () => {
    if (i < slides.length - 1) { setI(i + 1); setKey((k) => k + 1); }
    else onClose();
  };
  const prev = () => { if (i > 0) { setI(i - 1); setKey((k) => k + 1); } };

  // auto-advance every 3.5s; keyboard nav
  useEffect(() => {
    const timer = setTimeout(next, 3500);
    function onKey(e) {
      if (e.key === "ArrowRight" || e.key === " ") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(timer); window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  return (
    <div className="wrap-backdrop">
      {/* progress bars */}
      <div className="wrap-bars">
        {slides.map((_, idx) => (
          <div className="wrap-bar" key={idx}>
            <div className={`wrap-bar-fill ${idx < i ? "done" : idx === i ? "run" : ""}`} />
          </div>
        ))}
      </div>

      <button className="wrap-close" onClick={onClose} title="Close (Esc)">{Icon.xLg}</button>

      {/* tap zones */}
      <div className="wrap-tap left" onClick={prev} />
      <div className="wrap-tap right" onClick={next} />

      <div className={`wrap-slide k-${cur.kind}`} key={key}>
        {cur.kind === "intro" && (
          <>
            <div className="wrap-brand">FaceitLens · Wrapped</div>
            <div className="wrap-title">{cur.title}</div>
            <div className="wrap-sub">{cur.sub}</div>
          </>
        )}

        {cur.kind === "big" && (
          <>
            <div className="wrap-pre">{cur.pre}</div>
            <div className={`wrap-big ${cur.tone || ""}`}>{cur.big}</div>
            <div className="wrap-post">{cur.post}</div>
          </>
        )}

        {cur.kind === "map" && (
          <>
            <div className="wrap-pre">{cur.pre}</div>
            <div className="wrap-map-thumb">
              <img src={`/maps/${(cur.map || "").toLowerCase().replace(/^(de|cs)_/, "").replace(/\s+/g, "_")}.webp`}
                alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            </div>
            <div className="wrap-big good">{cur.big}</div>
            <div className="wrap-post">{cur.post}</div>
          </>
        )}

        {cur.kind === "person" && (
          <>
            <div className="wrap-pre">{cur.pre}</div>
            <div className="wrap-person">
              {cur.avatar ? <img src={cur.avatar} alt="" /> : <span className="wrap-person-ph">{initials(cur.name)}</span>}
            </div>
            <div className="wrap-name">{cur.name}</div>
            <div className={`wrap-big ${cur.tone || ""}`}>{cur.big}</div>
            <div className="wrap-post">{cur.post}</div>
          </>
        )}

        {cur.kind === "outro" && (
          <>
            {cur.level && <div className="wrap-outro-lvl"><FaceitLevel level={cur.level} size={80} /></div>}
            <div className="wrap-title">{cur.title}</div>
            <div className="wrap-sub">{cur.sub}</div>
            <div className="wrap-brand" style={{ marginTop: 24 }}>faceit-lens.com</div>
          </>
        )}
      </div>
    </div>
  );
}
