/**
 * Five 0-100 skill ratings, scored on the backend in tracker/skills.py.
 *
 * A rating is a position between two fixed reference points, not a percentile,
 * and the note at the bottom says so — "38/100" is otherwise read as "better
 * than 38% of players", which nothing here measures.
 *
 * Ratings whose inputs FACEIT never recorded for this account come back null
 * and render as an explicit "no data" row rather than a zero, which would look
 * like the player is bad at something instead of unmeasured.
 */

function band(score) {
  if (score >= 65) return "high";
  if (score >= 40) return "mid";
  return "low";
}

function Bar({ r }) {
  const missing = r.score == null;
  return (
    <div className={`sr-row ${missing ? "missing" : ""}`}>
      <div className="sr-top">
        <span className="sr-label">{r.label}</span>
        {r.detail && <span className="sr-detail">{r.detail}</span>}
        <span className={`sr-score ${missing ? "" : band(r.score)}`}>
          {missing ? "n/a" : r.score}
        </span>
      </div>
      <div className="sr-track">
        {!missing && (
          <i className={band(r.score)} style={{ width: `${Math.max(2, r.score)}%` }} />
        )}
      </div>
    </div>
  );
}

export default function SkillRatings({ skills }) {
  if (!skills || !skills.ratings?.length) return null;

  const byKey = Object.fromEntries(skills.ratings.map((r) => [r.key, r]));
  const strengths = (skills.strengths || []).map((k) => byKey[k]).filter(Boolean);
  const weaknesses = (skills.weaknesses || []).map((k) => byKey[k]).filter(Boolean);

  return (
    <div className="panel sr">
      <div className="panel-head">
        <div className="panel-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 20h18" /><path d="M6 20V10M12 20V4M18 20v-7" />
          </svg>
        </div>
        <div className="panel-title">Skill Ratings</div>
        <div className={`sr-overall ${band(skills.overall)}`}>
          {skills.overall}<span>/100</span>
        </div>
      </div>

      <div className="sr-body">
        <div className="sr-bars">
          {skills.ratings.map((r) => <Bar r={r} key={r.key} />)}
        </div>

        {(strengths.length > 0 || weaknesses.length > 0) && (
          <div className="sr-verdict">
            {strengths.length > 0 && (
              <div className="sr-group">
                <div className="sr-group-head good">Strengths</div>
                {strengths.map((r) => (
                  <div className="sr-item" key={r.key}>
                    <span className="sr-item-label">{r.label}</span>
                    <span className="sr-item-detail">{r.detail}</span>
                  </div>
                ))}
              </div>
            )}
            {weaknesses.length > 0 && (
              <div className="sr-group">
                <div className="sr-group-head bad">Areas to improve</div>
                {weaknesses.map((r) => (
                  <div className="sr-item" key={r.key}>
                    <span className="sr-item-label">{r.label}</span>
                    <span className="sr-item-detail">{r.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="sr-note">
        Scored 0-100 between two fixed reference points per stat — not
        percentiles, and not an official FACEIT number.
        {skills.rated < skills.ratings.length &&
          " Ratings marked n/a need CS2 stats FACEIT didn't record for this account."}
      </p>
    </div>
  );
}
