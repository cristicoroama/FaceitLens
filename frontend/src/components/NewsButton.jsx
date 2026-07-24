import { hasActiveIncident } from "../news.js";

// Topbar status indicator next to the theme menu.
//  - active incident  -> amber ⚠️ that blinks
//  - all operational  -> calm green dot
export default function NewsButton({ onClick }) {
  const active = hasActiveIncident();

  return (
    <button
      className="tb-btn news-btn"
      onClick={onClick}
      title={active ? "Active incident — view status" : "System status & incident history"}
    >
      {active ? (
        <span className="news-warn blink" aria-hidden="true">⚠️</span>
      ) : (
        <span className="news-dot" aria-hidden="true" />
      )}
      <span className="news-btn-label">Status</span>
    </button>
  );
}
