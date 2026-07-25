import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

/** Downscale + square-crop in the browser so we never upload a 5MB phone photo. */
function shrinkToDataUrl(file, size = 512) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a valid image."));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(
          img,
          (img.width - side) / 2, (img.height - side) / 2, side, side,
          0, 0, size, size
        );
        resolve(canvas.toDataURL("image/webp", 0.9));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function VerifiedBadge() {
  return (
    <span className="ps-verified" title="Ownership proven through Steam">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
        <path d="M12 1.5 3.5 5.2v6.1c0 5.3 3.6 10.2 8.5 11.2 4.9-1 8.5-5.9 8.5-11.2V5.2L12 1.5Zm-1.3 15-3.6-3.6 1.5-1.5 2.1 2.1 5.2-5.2 1.5 1.5-6.7 6.7Z" />
      </svg>
      Verified
    </span>
  );
}

/**
 * "Your account" — the handle that owns your public URL, how you appear on it,
 * your picture, and which FACEIT account is yours.
 */
export default function ProfileSettings({ user, onSaved, onOpenProfile }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState({});

  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [faceitNick, setFaceitNick] = useState("");

  const [handleState, setHandleState] = useState(null); // null | "checking" | "free" | "taken"
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/profile/me/`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        const p = j.profile || {};
        setProfile(p);
        setHandle(p.handle || "");
        setDisplayName(p.display_name || "");
        setBio(p.bio || "");
        setIsPublic(p.is_public !== false);
        setFaceitNick(p.faceit_nickname || "");
        setAvatarPreview(p.avatar ? `${API_BASE}${p.avatar}` : null);
      })
      .catch(() => setStatus("Couldn't load your profile."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  // Debounced availability check while the user types a handle.
  useEffect(() => {
    if (!profile) return;
    const clean = handle.trim().toLowerCase();
    if (!clean || clean === profile.handle) { setHandleState(null); return; }
    if (clean.length < 3) { setHandleState("taken"); return; }

    setHandleState("checking");
    const t = setTimeout(() => {
      fetch(`${API_BASE}/api/profile/handle/?h=${encodeURIComponent(clean)}`, {
        credentials: "include",
      })
        .then((r) => r.json())
        .then((j) => setHandleState(j.available ? "free" : "taken"))
        .catch(() => setHandleState(null));
    }, 350);
    return () => clearTimeout(t);
  }, [handle, profile]);

  async function save(e) {
    e?.preventDefault();
    setSaving(true);
    setStatus("");
    setErrors({});
    try {
      const body = {
        handle: handle.trim().toLowerCase(),
        display_name: displayName,
        bio,
        is_public: isPublic,
      };
      // Only send the FACEIT nickname when it's ours to set.
      if (!profile?.faceit_verified) body.faceit_nickname = faceitNick.trim();

      const resp = await fetch(`${API_BASE}/api/profile/me/`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await resp.json();
      if (!resp.ok) {
        setErrors(j.errors || {});
        setStatus(j.errors ? "" : "Couldn't save.");
        return;
      }
      setProfile(j.profile);
      setHandle(j.profile.handle);
      setStatus("Saved");
      onSaved?.(j.profile);
      setTimeout(() => setStatus(""), 2500);
    } catch {
      setStatus("Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file) {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      setStatus("That image is too big (max 12MB).");
      return;
    }
    setAvatarBusy(true);
    setStatus("");
    try {
      const dataUrl = await shrinkToDataUrl(file);
      setAvatarPreview(dataUrl);
      const resp = await fetch(`${API_BASE}/api/profile/avatar/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || "Upload failed.");
      setProfile(j.profile);
      setAvatarPreview(j.profile.avatar ? `${API_BASE}${j.profile.avatar}` : null);
      setStatus("Picture updated");
      onSaved?.(j.profile);
      setTimeout(() => setStatus(""), 2500);
    } catch (err) {
      setStatus(err.message || "Upload failed.");
      setAvatarPreview(profile?.avatar ? `${API_BASE}${profile.avatar}` : null);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    try {
      const resp = await fetch(`${API_BASE}/api/profile/avatar/`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = await resp.json();
      if (resp.ok) {
        setProfile(j.profile);
        setAvatarPreview(null);
        onSaved?.(j.profile);
      }
    } catch { /* ignore */ } finally {
      setAvatarBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="panel ps-wrap">
        <div className="empty-state">
          <div className="empty-ico">◈</div>
          <h3>Sign in to set up your profile</h3>
          <p>Signing in with Steam links your FACEIT account automatically — no codes to paste.</p>
          <a className="btn primary" href={`${API_BASE}/api/auth/steam/login/`}>
            Sign in with Steam
          </a>
        </div>
      </div>
    );
  }

  if (loading) return <div className="panel ps-wrap"><div className="skeleton tall" /></div>;

  const publicUrl = `${window.location.origin}/u/${profile?.handle || handle}`;
  const steamAvatar = user.steam_avatar || null;
  const shownAvatar = avatarPreview || steamAvatar;

  return (
    <form className="ps-wrap" onSubmit={save}>
      <div className="panel ps-card">
        <div className="panel-head">
          <h2 className="panel-title">Your profile</h2>
          {status && <span className="ps-status">{status}</span>}
        </div>

        {/* --- Picture --------------------------------------------------- */}
        <div className="ps-avatar-row">
          <div className={`ps-avatar ${avatarBusy ? "busy" : ""}`}>
            {shownAvatar
              ? <img src={shownAvatar} alt="" />
              : <span className="ps-avatar-ph">{(profile?.name || "?").slice(0, 2).toUpperCase()}</span>}
            {avatarBusy && <div className="ps-avatar-spin" />}
          </div>
          <div className="ps-avatar-actions">
            <div className="ps-label">Profile picture</div>
            <p className="ps-hint">
              Square works best. We resize it to 256px, so anything you upload is fine.
            </p>
            <div className="ps-btn-row">
              <button
                type="button"
                className="btn"
                disabled={avatarBusy}
                onClick={() => fileRef.current?.click()}
              >
                {avatarPreview ? "Change picture" : "Upload picture"}
              </button>
              {avatarPreview && (
                <button type="button" className="btn ghost" disabled={avatarBusy} onClick={removeAvatar}>
                  Remove
                </button>
              )}
            </div>
            {!avatarPreview && steamAvatar && (
              <p className="ps-hint dim">Currently using your Steam picture.</p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(e) => { uploadAvatar(e.target.files?.[0]); e.target.value = ""; }}
            />
          </div>
        </div>

        {/* --- Handle ----------------------------------------------------- */}
        <div className="ps-field">
          <label className="ps-label" htmlFor="ps-handle">Your link</label>
          <div className="ps-handle-input">
            <span className="ps-prefix">faceit-lens.com/u/</span>
            <input
              id="ps-handle"
              className="ps-input"
              value={handle}
              maxLength={30}
              spellCheck="false"
              onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase())}
            />
            {handleState === "checking" && <span className="ps-tag">checking…</span>}
            {handleState === "free" && <span className="ps-tag ok">available</span>}
            {handleState === "taken" && <span className="ps-tag bad">taken</span>}
          </div>
          {errors.handle
            ? <p className="ps-err">{errors.handle}</p>
            : <p className="ps-hint">This never changes on its own — links you share keep working.</p>}
        </div>

        {/* --- Name + bio -------------------------------------------------- */}
        <div className="ps-grid">
          <div className="ps-field">
            <label className="ps-label" htmlFor="ps-name">Display name</label>
            <input
              id="ps-name"
              className="ps-input"
              value={displayName}
              maxLength={40}
              placeholder={profile?.faceit_nickname || "Your name"}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="ps-field">
            <label className="ps-label" htmlFor="ps-bio">Bio</label>
            <input
              id="ps-bio"
              className="ps-input"
              value={bio}
              maxLength={200}
              placeholder="Entry fragger. Hates Mirage."
              onChange={(e) => setBio(e.target.value)}
            />
            <p className="ps-hint">{bio.length}/200</p>
          </div>
        </div>
      </div>

      {/* --- FACEIT link -------------------------------------------------- */}
      <div className="panel ps-card">
        <div className="panel-head">
          <h2 className="panel-title">FACEIT account</h2>
          {profile?.faceit_verified && <VerifiedBadge />}
        </div>

        {profile?.faceit_verified ? (
          <div className="ps-linked">
            <div>
              <div className="ps-linked-nick">{profile.faceit_nickname}</div>
              <p className="ps-hint">
                Linked automatically through Steam. Steam proved you own this account,
                so nobody else can claim it.
              </p>
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => onOpenProfile?.(profile.faceit_nickname)}
            >
              View stats
            </button>
          </div>
        ) : (
          <div className="ps-field">
            <p className="ps-hint">
              We couldn't find a FACEIT account registered to your Steam ID. You can set it
              by hand — but it won't get the verified badge.
            </p>
            <input
              className="ps-input"
              value={faceitNick}
              maxLength={100}
              placeholder="Your FACEIT nickname"
              spellCheck="false"
              onChange={(e) => setFaceitNick(e.target.value)}
            />
            {errors.faceit_nickname && <p className="ps-err">{errors.faceit_nickname}</p>}
          </div>
        )}
      </div>

      {/* --- Visibility ---------------------------------------------------- */}
      <div className="panel ps-card">
        <div className="panel-head"><h2 className="panel-title">Visibility</h2></div>

        <label className="ps-toggle">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          <span className="ps-toggle-track"><span className="ps-toggle-thumb" /></span>
          <span>
            <b>Public profile</b>
            <span className="ps-hint">Anyone with the link can see your page.</span>
          </span>
        </label>

        {isPublic && profile?.handle && (
          <div className="ps-share">
            <code className="ps-url">{publicUrl}</code>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                navigator.clipboard?.writeText(publicUrl);
                setStatus("Link copied");
                setTimeout(() => setStatus(""), 2000);
              }}
            >
              Copy
            </button>
            <a className="btn ghost" href={`/u/${profile.handle}`}>Open</a>
          </div>
        )}
      </div>

      <div className="ps-actions">
        <button className="btn primary" type="submit" disabled={saving || handleState === "taken"}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
