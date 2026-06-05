function dateFrom(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-GB", { year: "numeric", month: "short" });
}

export default function SteamInfo({ steam }) {
  if (!steam) {
    return (
      <div className="state">
        Steam data not available. The site owner needs to set a Steam API key
        (or the profile is private).
      </div>
    );
  }
  return (
    <>
      <div className="section-title">Steam</div>
      <div className="ravg" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="ravg-cell">
          <div className="ravg-value">{steam.hours_cs2 ?? "—"}</div>
          <div className="ravg-label">CS2 Hours</div>
        </div>
        <div className="ravg-cell">
          <div className="ravg-value" style={{ color: steam.vac_banned ? "var(--loss)" : "var(--win)" }}>
            {steam.vac_banned ? "VAC" : "Clean"}
          </div>
          <div className="ravg-label">{steam.vac_count ? `${steam.vac_count} ban(s)` : "VAC Status"}</div>
        </div>
        <div className="ravg-cell">
          <div className="ravg-value" style={{ fontSize: 16 }}>{dateFrom(steam.created)}</div>
          <div className="ravg-label">Account Created</div>
        </div>
      </div>
      {steam.profile_url && (
        <a className="act-btn" href={steam.profile_url} target="_blank" rel="noopener noreferrer">
          Open Steam profile →
        </a>
      )}
    </>
  );
}
