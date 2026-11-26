import { useEffect, useState } from "react";
import { FaceitLevel } from "./RankIcons.jsx";
import { DEFAULT_LOCALE, makeT } from "../i18n.js";

export default function MiniHeader({ player, tabs, active, activeLabel, onTab, lang = DEFAULT_LOCALE }) {
  const [show, setShow] = useState(false);
  const t = makeT(lang);

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

  const list = tabs || [];
  const shown = list.length > 0 && active && !list.some(([k]) => k === active) && activeLabel
    ? [...list, [active, activeLabel]]
    : list;

  return (
    <div className={`mini-head ${show ? "on" : ""}`} {...(show ? {} : { inert: "" })}>
      <div className="mini-head-row">
        {player.avatar ? <img src={player.avatar} alt="" /> : <span className="mini-head-ph" />}
        <span className="mini-head-name">{player.nickname}</span>
        <FaceitLevel level={player.skill_level || 1} size={22} />
        <span className="mini-head-elo">{player.elo ?? "—"}</span>
        <button
          type="button"
          className="mini-head-top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label={t("mini.top")}
        >
          <span aria-hidden="true">↑</span>
        </button>
      </div>
      {shown.length > 0 && (
        <div className="mini-head-tabs" role="navigation" aria-label={t("mini.tabs")}>
          {shown.map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={active === k ? "on" : ""}
              aria-current={active === k ? "page" : undefined}
              onClick={() => {
                onTab(k);
                const el = document.querySelector(".ptabs");
                if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 130, behavior: "smooth" });
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
