function dateFrom(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-GB", { year: "numeric", month: "short" });
}

const IC = {
  hours: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />
    </svg>
  ),
  vac: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 5.5v5.1c0 4.9 3.4 9.5 8 10.9 4.6-1.4 8-6 8-10.9V5.5L12 2Z" />
    </svg>
  ),
  created: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  ),
};

export default function SteamInfo({ steam }) {
  if (!steam) {
    return (
      <div className="state">
        Steam data not available. The site owner needs to set a Steam API key
        (or the profile is private).
      </div>
    );
  }
  const clean = !steam.vac_banned;
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" /><circle cx="15" cy="9" r="2.5" /><path d="M3.4 14.5 9 17a2.8 2.8 0 1 0 3.4-3.9l3-2.8" />
          </svg>
        </div>
        <div className="panel-title">Steam Account</div>
      </div>

      <div className="steam-grid">
        <div className="scard">
          <div className="scard-ic">{IC.hours}</div>
          <div className="scard-val">{steam.hours_cs2 ?? "—"}</div>
          <div className="scard-label">CS2 Hours</div>
        </div>
        <div className="scard">
          <div
            className="scard-ic"
            style={{
              color: clean ? "var(--win)" : "var(--loss)",
              borderColor: clean ? "color-mix(in srgb, var(--win) 40%, transparent)" : "color-mix(in srgb, var(--loss) 40%, transparent)",
              background: clean
                ? "color-mix(in srgb, var(--win) 12%, transparent)"
                : "color-mix(in srgb, var(--loss) 12%, transparent)",
            }}
          >
            {IC.vac}
          </div>
          <div className="scard-val" style={{ color: clean ? "var(--win)" : "var(--loss)" }}>
            {clean ? "Clean" : "VAC"}
          </div>
          <div className="scard-label">{steam.vac_count ? `${steam.vac_count} ban(s)` : "VAC Status"}</div>
        </div>
        <div className="scard">
          <div className="scard-ic">{IC.created}</div>
          <div className="scard-val" style={{ fontSize: 19 }}>{dateFrom(steam.created)}</div>
          <div className="scard-label">Account Created</div>
        </div>
      </div>

      {steam.profile_url && (
        <a className="act-btn" href={steam.profile_url} target="_blank" rel="noopener noreferrer">
          Open Steam profile →
        </a>
      )}
    </div>
  );
}
