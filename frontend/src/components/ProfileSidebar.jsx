import Activity from "./Activity.jsx";
import BanStatus from "./BanStatus.jsx";
import { SteamIcon, FaceitIcon, TwitchIcon } from "./BrandIcons.jsx";

/**
 * The column that stays put while the tabs change.
 *
 * Everything here answers a question you might have on ANY tab — is this
 * account clean, who do they play with, when are they online — so none of it
 * belongs to a tab. Putting it beside the content instead of inside one means
 * it stops being something you have to go and find.
 *
 * Deliberately not a copy of the tab content it resembles. The Hubs tab has a
 * twelve-column sortable table; this shows five rows and a bar. The sidebar is
 * the glance, the tab is the answer.
 */

function Bar({ pct, tone }) {
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <span className="psb-bar">
      <span className={`psb-bar-fill ${tone || ""}`} style={{ width: `${v}%` }} />
    </span>
  );
}

function Card({ title, count, children }) {
  return (
    <div className="psb-card">
      <div className="psb-head">
        <span className="psb-title">{title}</span>
        {count != null && <span className="psb-count">{count}</span>}
      </div>
      {children}
    </div>
  );
}

export default function ProfileSidebar({ player, onPick }) {
  if (!player) return null;

  const hubs = (player.competitions || []).slice(0, 5);
  const mates = (player.teammates_full || player.best_teammates || []).slice(0, 5);
  const socials = [
    player.faceit_url && { label: "FACEIT", href: player.faceit_url, icon: <FaceitIcon size={14} /> },
    player.steam_id && {
      label: "Steam",
      href: `https://steamcommunity.com/profiles/${player.steam_id}`,
      icon: <SteamIcon size={14} />,
    },
    player.platforms?.twitch && {
      label: "Twitch",
      href: `https://twitch.tv/${encodeURIComponent(player.platforms.twitch)}`,
      icon: <TwitchIcon size={14} />,
    },
  ].filter(Boolean);

  return (
    <aside className="psb">
      {player.activity && (
        <div className="psb-card psb-activity">
          <Activity activity={player.activity} />
        </div>
      )}

      {hubs.length > 0 && (
        <Card title="Top hubs" count={hubs.length}>
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

      {mates.length > 0 && (
        <Card title="Top teammates" count={mates.length}>
          {mates.map((m) => (
            <div
              className={`psb-row ${onPick ? "clickable" : ""}`}
              key={m.nickname}
              onClick={onPick ? () => onPick(m.nickname) : undefined}
              role={onPick ? "button" : undefined}
              tabIndex={onPick ? 0 : undefined}
              onKeyDown={onPick ? (e) => { if (e.key === "Enter") onPick(m.nickname); } : undefined}
            >
              <span className="psb-name" title={m.nickname}>{m.nickname}</span>
              <span className="psb-figs">
                <span className="psb-n">{m.games ?? m.matches}</span>
                <span className={`psb-wr ${m.win_rate >= 50 ? "pos" : "neg"}`}>{m.win_rate}%</span>
              </span>
              <Bar pct={m.win_rate} tone={m.win_rate >= 50 ? "pos" : "neg"} />
            </div>
          ))}
        </Card>
      )}

      <Card title="Security &amp; bans">
        <BanStatus bans={player.bans} steam={player.steam} compact />
      </Card>

      {socials.length > 0 && (
        <Card title="Social">
          <div className="psb-socials">
            {socials.map((sc) => (
              <a
                key={sc.label}
                className="psb-social"
                href={sc.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {sc.icon}
                {sc.label}
              </a>
            ))}
          </div>
        </Card>
      )}
    </aside>
  );
}
