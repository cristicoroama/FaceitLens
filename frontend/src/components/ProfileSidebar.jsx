import Activity from "./Activity.jsx";
import BanStatus from "./BanStatus.jsx";
import { FaceitLevel } from "./RankIcons.jsx";
import { DEFAULT_LOCALE, makeT } from "../i18n.js";

function Bar({ pct, tone }) {
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <span className="psb-bar" aria-hidden="true">
      <span className={`psb-bar-fill ${tone || ""}`} style={{ width: `${v}%` }} />
    </span>
  );
}

function Card({ title, count, more, children, className = "" }) {
  return (
    <section className={`psb-card ${className}`} aria-label={title}>
      <div className="psb-head">
        <span className="psb-title">{title}</span>
        {count != null && <span className="psb-count">{count}</span>}
        {more}
      </div>
      {children}
    </section>
  );
}

export default function ProfileSidebar({ player, onPick, onTab, gameView = "cs2", onGameView, lang = DEFAULT_LOCALE }) {
  const t = makeT(lang);
  if (!player) return null;

  const hubs = (player.competitions || []).slice(0, 3);
  const mates = (player.teammates_full || player.best_teammates || []).slice(0, 3);
  const seeAll = (tab, label) => onTab ? (
    <button type="button" className="sh-psb-more" onClick={() => onTab(tab)} aria-label={`${t("psb.seeAll")}: ${label}`}>
      {t("psb.seeAll")} <span aria-hidden="true">→</span>
    </button>
  ) : null;

  return (
    <aside className="psb">
      {player.activity && (
        <div className="psb-card psb-activity">
          <Activity activity={player.activity} />
          {onTab && <div className="sh-psb-foot">{seeAll("activity", t("psb.activity"))}</div>}
        </div>
      )}

      {(player.game_history || []).length > 1 && (
        <Card title={t("psb.gameHistory")}>
          <div className="psb-games">
            {player.game_history.map((g) => (
              <button
                type="button"
                className={`psb-game ${gameView === g.game ? "on" : ""}`}
                key={g.game}
                onClick={onGameView ? () => onGameView(g.game) : undefined}
                aria-pressed={gameView === g.game}
              >
                <img className="psb-game-ic" src={`/games/${g.game}.png`} alt="" loading="lazy" />
                <div className="psb-game-body">
                  <span className="psb-game-name">{g.label}</span>
                  <span className="psb-game-sub">
                    {g.matches != null
                      ? t("psb.matchesN", { n: g.matches.toLocaleString(lang) })
                      : t("psb.noLifetime")}
                  </span>
                </div>
                {g.level != null && <FaceitLevel level={g.level} size={20} />}
              </button>
            ))}
          </div>
        </Card>
      )}

      {hubs.length > 0 && gameView !== "csgo" && (
        <Card title={t("psb.topHubs")} more={seeAll("hubs", t("psb.topHubs"))}>
          {hubs.map((h) => (
            <div className="psb-row" key={h.competition_id || h.name}>
              <span className="psb-name" title={h.name}>{h.name}</span>
              <span className="psb-figs">
                <span className="psb-n">{h.matches}</span>
                <span className={`psb-wr ${h.win_rate >= 50 ? "pos" : "neg"}`}>{h.win_rate}%</span>
              </span>
              <Bar pct={h.win_rate} tone={h.win_rate >= 50 ? "pos" : "neg"} />
            </div>
          ))}
        </Card>
      )}

      {mates.length > 0 && gameView !== "csgo" && (
        <Card title={t("psb.topMates")} more={seeAll("teammates", t("psb.topMates"))}>
          {mates.map((m) => (
            <button
              type="button"
              className={`psb-row sh-psb-rowbtn ${onPick ? "clickable" : ""}`}
              key={m.nickname}
              onClick={onPick ? () => onPick(m.nickname) : undefined}
              disabled={!onPick}
            >
              <span className="psb-name" title={m.nickname}>{m.nickname}</span>
              <span className="psb-figs">
                <span className="psb-n">{m.games ?? m.matches}</span>
                <span className={`psb-wr ${m.win_rate >= 50 ? "pos" : "neg"}`}>{m.win_rate}%</span>
              </span>
              <Bar pct={m.win_rate} tone={m.win_rate >= 50 ? "pos" : "neg"} />
            </button>
          ))}
        </Card>
      )}

      <Card title={t("psb.security")} more={gameView !== "csgo" ? seeAll("bans", t("psb.security")) : null}>
        <BanStatus bans={player.bans} steam={player.steam} compact />
      </Card>
    </aside>
  );
}
