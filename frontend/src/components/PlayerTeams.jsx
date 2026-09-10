import { useState, useEffect } from "react";
import { Icon } from "../icons.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

function initials(name) {
  return (name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

function day(ts) {
  if (!ts) return null;
  const d = new Date(ts * 1000);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** Teams and tournaments, fetched together and rendered only if either has
 *  anything.
 *
 *  One component for both because they answer the same question — what this
 *  player does outside solo queue — and because most accounts have neither,
 *  in which case the whole block should disappear rather than leave two empty
 *  headings on every profile.
 *
 *  Both endpoints are best-effort on the backend, so a failure arrives here as
 *  an empty list and the section simply does not render.
 */
export default function PlayerTeams({ nickname }) {
  const [teams, setTeams] = useState([]);
  const [tourneys, setTourneys] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!nickname) return;
    let cancelled = false;
    setLoaded(false);
    setTeams([]);
    setTourneys([]);

    const get = (path) =>
      fetch(`${API_BASE}/api/player/${encodeURIComponent(nickname)}/${path}/`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

    Promise.all([get("teams"), get("tournaments")]).then(([t, tr]) => {
      if (cancelled) return;
      setTeams(t?.items || []);
      setTourneys(tr?.items || []);
      setLoaded(true);
    });

    return () => { cancelled = true; };
  }, [nickname]);

  if (!loaded || (!teams.length && !tourneys.length)) return null;

  return (
    <>
      {teams.length > 0 && (
        <>
          <div className="section-title">
            FACEIT teams <span className="section-count">{teams.length}</span>
          </div>
          {/* Named precisely, because the obvious reading is wrong. These are
              premade squads the player is a member of — created by anyone,
              named anything, and never automatically left. A team called
              "Natus Vincere" here is not a roster spot at NAVI, and the list
              is a history rather than a current affiliation. */}
          <p className="pteam-note">
            Premade squads this player belongs to on FACEIT. Team names are
            chosen by whoever created them and membership is not removed
            automatically, so these are not roster spots or current teams.
          </p>
          <div className="pteam-grid">
            {teams.map((t) => (
              <a
                className="pteam"
                key={t.team_id}
                href={t.faceit_url || undefined}
                target="_blank"
                rel="noopener noreferrer"
              >
                {/* The logo ships with the team from FACEIT — no separate
                    artwork to maintain. Initials stand in when a team never
                    uploaded one. */}
                {t.avatar ? (
                  <img className="pteam-logo" src={t.avatar} alt="" loading="lazy" />
                ) : (
                  <span className="pteam-logo ph">{initials(t.name)}</span>
                )}
                <div className="pteam-main">
                  <div className="pteam-name">{t.name || "—"}</div>
                  <div className="pteam-meta">
                    {t.type && <span className="pteam-type">{t.type}</span>}
                    {t.game && <span>{t.game}</span>}
                  </div>
                </div>
                <span className="pteam-go">{Icon.boxArrowUpRight}</span>
              </a>
            ))}
          </div>
        </>
      )}

      {tourneys.length > 0 && (
        <>
          <div className="section-title">
            Tournaments <span className="section-count">{tourneys.length}</span>
          </div>
          <div className="ptourn-list">
            {tourneys.map((t) => (
              <a
                className="ptourn"
                key={t.tournament_id}
                href={t.faceit_url || undefined}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="ptourn-name">{t.name || "—"}</span>
                {t.status && (
                  <span className={`ptourn-status s-${String(t.status).toLowerCase()}`}>
                    {t.status}
                  </span>
                )}
                <span className="ptourn-meta">
                  {t.region && <span>{t.region}</span>}
                  {t.players > 0 && <span>{t.players} players</span>}
                  {day(t.started_at) && <span>{day(t.started_at)}</span>}
                </span>
              </a>
            ))}
          </div>
        </>
      )}
    </>
  );
}
