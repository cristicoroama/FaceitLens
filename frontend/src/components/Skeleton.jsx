export default function Skeleton({ label }) {
  return (
    <div className="skeleton-wrap" aria-busy="true" aria-live="polite" aria-label={label}>
      <div className="sk sk-head" />
      <div className="sk-grid">
        <div className="sk sk-card" />
        <div className="sk sk-card" />
        <div className="sk sk-card" />
        <div className="sk sk-card" />
        <div className="sk sk-card" />
        <div className="sk sk-card" />
      </div>
      <div className="sk sk-chart" />
    </div>
  );
}

export function ProfileSkeleton({ label }) {
  return (
    <div className="sh-psk" aria-busy="true" aria-live="polite" aria-label={label}>
      <div className="sh-psk-hero sk">
        <div className="sh-psk-avatar sh-psk-block" />
        <div className="sh-psk-id">
          <div className="sh-psk-line w60" />
          <div className="sh-psk-line w40" />
          <div className="sh-psk-chips">
            <span className="sh-psk-dot" /><span className="sh-psk-dot" /><span className="sh-psk-dot" />
          </div>
        </div>
        <div className="sh-psk-elo sh-psk-block" />
      </div>
      <div className="sh-psk-strip">
        {[0, 1, 2, 3, 4].map((i) => <div className="sk sh-psk-stat" key={i} />)}
      </div>
      <div className="prof-layout">
        <div className="sh-psk-side">
          <div className="sk sh-psk-card tall" />
          <div className="sk sh-psk-card" />
          <div className="sk sh-psk-card" />
        </div>
        <div>
          <div className="sh-psk-tabs">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => <span className="sk sh-psk-tab" key={i} />)}
          </div>
          <div className="sk-grid">
            <div className="sk sk-card" />
            <div className="sk sk-card" />
            <div className="sk sk-card" />
          </div>
          <div className="sk sk-chart" />
        </div>
      </div>
    </div>
  );
}
