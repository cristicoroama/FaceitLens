import { useEffect, useState } from "react";
import { FaceitLevel } from "./RankIcons.jsx";

export default function MiniHeader({ player, tabs, active, onTab }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = document.querySelector(".player-hero");
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [player?.player_id]);

  if (!player) return null;
  return (
    <div className={`mini-head ${show ? "on" : ""}`} aria-hidden={!show}>
      <div className="mini-head-row">
        {player.avatar ? <img src={player.avatar} alt="" /> : <span className="mini-head-ph" />}
        <span className="mini-head-name">{player.nickname}</span>
        <FaceitLevel level={player.skill_level || 1} size={22} />
        <span className="mini-head-elo">{player.elo ?? "—"}</span>
        <button type="button" className="mini-head-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top">↑</button>
      </div>
      {tabs?.length > 0 && (
        <div className="mini-head-tabs">
          {tabs.map(([k, label]) => (
            <button key={k} type="button" className={active === k ? "on" : ""}
              onClick={() => {
                onTab(k);
                const el = document.querySelector(".ptabs");
                if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 130, behavior: "smooth" });
              }}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
