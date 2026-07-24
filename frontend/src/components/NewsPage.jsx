import { INCIDENTS, SYSTEM_STATUS } from "../news.js";

const STATUS_META = {
  investigating: { label: "Investigating" },
  identified: { label: "Identified" },
  monitoring: { label: "Monitoring" },
  resolved: { label: "Resolved" },
};

const IMPACT_META = {
  minor: "Minor",
  major: "Major",
  critical: "Critical",
  maintenance: "Maintenance",
};

const BANNER = {
  operational: "System operational",
  degraded: "Degraded performance",
  outage: "Service outage",
  maintenance: "Under maintenance",
};

// Full date + time, 24h, timezone-safe (renders in the viewer's locale).
function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function fmtTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export default function NewsPage() {
  return (
    <>
      <div className="page-hero">
        <div className="page-hero-title">
          <div className="panel-ic" style={{ width: 38, height: 38 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 18, height: 18 }}>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          System <em>Status</em>
        </div>
        <div className="page-hero-sub">
          Live service status and a full incident history for FaceitLens and its
          upstream dependencies (FACEIT Data API, Steam). All times shown in your
          local timezone.
        </div>
      </div>

      <div className={`sys-banner ${SYSTEM_STATUS.state}`}>
        <span className="sys-banner-dot" />
        <span className="sys-banner-text">
          {BANNER[SYSTEM_STATUS.state] || SYSTEM_STATUS.text}
        </span>
        <span className="sys-banner-time">
          Updated {fmtDateTime(SYSTEM_STATUS.updated)}
        </span>
      </div>

      <div className="section-title">Incident history</div>

      {INCIDENTS.length === 0 ? (
        <div className="state">No incidents recorded. All systems nominal.</div>
      ) : (
        <div className="inc-list">
          {INCIDENTS.map((inc) => (
            <article key={inc.id} className={`inc-card status-${inc.status}`}>
              <div className="inc-head">
                <span className={`inc-status status-${inc.status}`}>
                  {STATUS_META[inc.status]?.label || inc.status}
                </span>
                <span className={`inc-impact impact-${inc.impact}`}>
                  {IMPACT_META[inc.impact] || inc.impact}
                </span>
                <span className="inc-component">
                  {inc.component}
                  {inc.endpoint ? ` · ${inc.endpoint}` : ""}
                </span>
              </div>

              <h3 className="inc-title">{inc.title}</h3>

              <div className="inc-window">
                <span>Started {fmtDateTime(inc.started)}</span>
                {inc.resolved && <span> · Resolved {fmtDateTime(inc.resolved)}</span>}
              </div>

              <div className="inc-timeline">
                {inc.updates.map((u, i) => (
                  <div key={i} className={`inc-update status-${u.status}`}>
                    <span className="inc-up-marker" />
                    <div className="inc-up-body">
                      <div className="inc-up-meta">
                        <span className={`inc-up-status status-${u.status}`}>
                          {STATUS_META[u.status]?.label || u.status}
                        </span>
                        <time className="inc-up-time">{fmtTime(u.at)}</time>
                      </div>
                      <p className="inc-up-text">{u.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
