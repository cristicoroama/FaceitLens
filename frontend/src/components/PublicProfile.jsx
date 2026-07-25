import { useState, useEffect } from "react";
import EloProgress from "./EloProgress.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

const LEVEL_COLORS = {
  1: "#EEEEEE", 2: "#1CE400", 3: "#1CE400", 4: "#FFC800", 5: "#FFC800",
  6: "#FFC800", 7: "#FFC800", 8: "#FF6309", 9: "#FF6309", 10: "#FE1F00",
};

function VerifiedBadge() {
  return (
    <span className="pp-verified" title="Ownership proven through Steam">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
        <path d="M12 1.5 3.5 5.2v6.1c0 5.3 3.6 10.2 8.5 11.2 4.9-1 8.5-5.9 8.5-11.2V5.2L12 1.5Zm-1.3 15-3.6-3.6 1.5-1.5 2.1 2.1 5.2-5.2 1.5 1.5-6.7 6.7Z" />
      </svg>
      Verified
    </span>
  );
}

function ReportDialog({ handle, onClose }) {
  const [reason, setReason] = useState("avatar");
  const [detail, setDetail] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    try {
      await fetch(`${API_BASE}/api/profile/report/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, reason, detail }),
      });
    } catch { /* reporting is best-effort */ }
    setSent(true);
    setTimeout(onClose, 1600);
  }

  return (
    <div className="pp-modal-back" onClick={onClose}>
      <div className="panel pp-modal" onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <div className="pp-report-done">
            <div className="empty-ico">✓</div>
            <h3>Thanks — we'll take a look.</h3>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="panel-head"><h2 className="panel-title">Report this profile</h2></div>
            <div className="pp-report-opts">
              {[
                ["avatar", "Inappropriate picture"],
                ["name", "Inappropriate name or bio"],
                ["impersonation", "Pretending to be someone else"],
                ["other", "Something else"],
              ].map(([val, label]) => (
                <label key={val} className={`pp-radio ${reason === val ? "on" : ""}`}>
                  <input
                    type="radio"
                    name="reason"
                    value={val}
                    checked={reason === val}
                    onChange={() => setReason(val)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <input
              className="ps-input"
              placeholder="Anything else we should know? (optional)"
              maxLength={300}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
            <div className="pp-modal-actions">
              <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn primary">Send report</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** The page behind faceit-lens.com/u/<handle>. */
export default function PublicProfile({ handle, onPick, onEdit, currentUser }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setProfile(null);

    fetch(`${API_BASE}/api/profile/${encodeURIComponent(handle)}/`, {
      credentials: "include",
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Profile not found.");
        return j;
      })
      .then((j) => {
        if (cancelled) return;
        // /u/<faceit-nickname> resolves to the owner's real handle.
        if (j.redirect) {
          window.history.replaceState(null, "", `/u/${j.redirect}`);
        }
        setProfile(j.profile);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [handle]);

  if (loading) {
    return <div className="panel"><div className="skeleton tall" /></div>;
  }

  if (error) {
    return (
      <div className="panel">
        <div className="empty-state">
          <div className="empty-ico">◌</div>
          <h3>{error}</h3>
          <p>This profile doesn't exist, or its owner has made it private.</p>
        </div>
      </div>
    );
  }

  const f = profile.faceit;
  const url = `${window.location.origin}/u/${profile.handle}`;
  const levelColor = LEVEL_COLORS[f?.level] || "var(--accent)";
  const isOwner = profile.is_owner;

  return (
    <div className="pp-wrap">
      <div className="panel pp-hero">
        <div className="pp-hero-glow" />

        <div className="pp-identity">
          <div className="pp-avatar" style={{ "--lvl": levelColor }}>
            {profile.avatar || f?.avatar ? (
              <img
                src={profile.avatar ? `${API_BASE}${profile.avatar}` : f.avatar}
                alt={profile.name}
              />
            ) : (
              <span className="pp-avatar-ph">{(profile.name || "?").slice(0, 2).toUpperCase()}</span>
            )}
          </div>

          <div className="pp-meta">
            <div className="pp-name-row">
              <h1 className="pp-name">{profile.name}</h1>
              {profile.faceit_verified && <VerifiedBadge />}
            </div>
            <div className="pp-handle">@{profile.handle}</div>
            {profile.bio && <p className="pp-bio">{profile.bio}</p>}
            <div className="pp-joined">Joined {profile.joined}</div>
          </div>

          <div className="pp-hero-actions">
            <button
              className="btn"
              onClick={() => {
                navigator.clipboard?.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? "Copied!" : "Share"}
            </button>
            {isOwner ? (
              <button className="btn ghost" onClick={onEdit}>Edit profile</button>
            ) : (
              <button className="btn ghost pp-report" onClick={() => setReporting(true)}>
                Report
              </button>
            )}
          </div>
        </div>
      </div>

      {/* --- Live FACEIT stats ------------------------------------------- */}
      {f ? (
        <div className="panel pp-faceit">
          <div className="panel-head">
            <h2 className="panel-title">FACEIT</h2>
            <button className="btn ghost sm" onClick={() => onPick?.(f.nickname)}>
              Full stats →
            </button>
          </div>

          <div className="pp-stat-grid">
            <div className="pp-stat">
              <div className="pp-stat-val" style={{ color: levelColor }}>{f.level ?? "—"}</div>
              <div className="pp-stat-lbl">Level</div>
            </div>
            <div className="pp-stat">
              <div className="pp-stat-val">{f.elo?.toLocaleString() ?? "—"}</div>
              <div className="pp-stat-lbl">ELO</div>
            </div>
            <div className="pp-stat">
              <div className="pp-stat-val">{f.stats?.winrate ? `${f.stats.winrate}%` : "—"}</div>
              <div className="pp-stat-lbl">Win rate</div>
            </div>
            <div className="pp-stat">
              <div className="pp-stat-val">{f.stats?.kd ?? "—"}</div>
              <div className="pp-stat-lbl">K/D</div>
            </div>
            <div className="pp-stat">
              <div className="pp-stat-val">{f.stats?.hs ? `${f.stats.hs}%` : "—"}</div>
              <div className="pp-stat-lbl">Headshots</div>
            </div>
            <div className="pp-stat">
              <div className="pp-stat-val">{f.stats?.matches ?? "—"}</div>
              <div className="pp-stat-lbl">Matches</div>
            </div>
          </div>

          <button className="pp-nick-row" onClick={() => onPick?.(f.nickname)}>
            {f.avatar && <img className="pp-nick-av" src={f.avatar} alt="" />}
            <span className="pp-nick">{f.nickname}</span>
            {f.country && <span className="pp-country">{f.country.toUpperCase()}</span>}
            <span className="pp-go">→</span>
          </button>
        </div>
      ) : (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-ico">◈</div>
            <h3>No FACEIT account linked yet</h3>
            {isOwner ? (
              <>
                <p>
                  Sign in with FACEIT to link your account — stats only appear once
                  ownership is proven, so nobody can put someone else's name here.
                </p>
                <a className="btn faceit-login" href={`${API_BASE}/api/auth/faceit/login/`}>
                  Sign in with FACEIT
                </a>
              </>
            ) : (
              <p>This player hasn't linked a FACEIT account.</p>
            )}
          </div>
        </div>
      )}

      {/* --- Real ELO history (members are snapshotted daily) ------------- */}
      {profile.faceit_nickname && (
        <EloProgress handle={profile.handle} isOwner={isOwner} />
      )}

      {/* --- Who they follow --------------------------------------------- */}
      {profile.favorites?.length > 0 && (
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">Following</h2></div>
          <div className="pp-follows">
            {profile.favorites.map((n) => (
              <button key={n} className="pp-follow" onClick={() => onPick?.(n)}>{n}</button>
            ))}
          </div>
        </div>
      )}

      {reporting && (
        <ReportDialog handle={profile.handle} onClose={() => setReporting(false)} />
      )}
    </div>
  );
}
