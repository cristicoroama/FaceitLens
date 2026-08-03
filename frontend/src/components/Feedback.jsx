import { useState, useEffect, useCallback } from "react";

import { DISCORD_INVITE } from "../links.js";

const API_BASE = import.meta.env.VITE_API_URL || "";

const KIND_META = {
  bug: { label: "Bug", cls: "bug", icon: "!" },
  idea: { label: "Idea", cls: "idea", icon: "✦" },
  question: { label: "Question", cls: "question", icon: "?" },
};

const STATUS_META = {
  open: { label: "Open", cls: "open" },
  planned: { label: "Planned", cls: "planned" },
  in_progress: { label: "In progress", cls: "progress" },
  done: { label: "Done", cls: "done" },
  declined: { label: "Declined", cls: "declined" },
  duplicate: { label: "Duplicate", cls: "declined" },
};

function timeAgo(iso) {
  const secs = (Date.now() - new Date(iso).getTime()) / 1000;
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Avatar({ author, size = 26 }) {
  const src = author?.avatar
    ? (author.avatar.startsWith("http") ? author.avatar : `${API_BASE}${author.avatar}`)
    : null;
  if (src) {
    return <img className="fb-av" src={src} alt="" width={size} height={size} />;
  }
  return (
    <span className="fb-av ph" style={{ width: size, height: size }}>
      {(author?.name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

function VoteButton({ item, onVoted, canVote }) {
  const [busy, setBusy] = useState(false);

  async function toggle(e) {
    e.stopPropagation();
    if (!canVote || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/feedback/${item.id}/vote/`, {
        method: "POST", credentials: "include",
      });
      const j = await r.json();
      if (r.ok) onVoted(item.id, j.votes, j.voted);
    } catch { /* leave the count as it was */ } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={`fb-vote ${item.voted ? "on" : ""} ${canVote ? "" : "locked"}`}
      onClick={toggle}
      disabled={busy}
      title={canVote ? (item.voted ? "Remove your vote" : "Upvote") : "Sign in to vote"}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
           strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 14 6-6 6 6" />
      </svg>
      <span>{item.votes}</span>
    </button>
  );
}

function PostForm({ onPosted, onCancel }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("idea");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const r = await fetch(`${API_BASE}/api/feedback/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, kind }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErrors(j.errors || { _: j.error || "Couldn't post." });
        return;
      }
      onPosted(j.item);
      setTitle(""); setBody("");
    } catch {
      setErrors({ _: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel fb-form" onSubmit={submit}>
      <div className="panel-head"><h2 className="panel-title">Post something</h2></div>

      <div className="fb-kinds">
        {Object.entries(KIND_META).map(([k, m]) => (
          <button
            type="button"
            key={k}
            className={`fb-kind-pick ${kind === k ? "on" : ""}`}
            onClick={() => setKind(k)}
          >
            <span className={`fb-kind ${m.cls}`}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      <input
        className="ps-input"
        placeholder={kind === "bug" ? "What went wrong?" : "What should it do?"}
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
      />
      {errors.title && <p className="ps-err">{errors.title}</p>}

      <textarea
        className="ps-input fb-textarea"
        rows={5}
        maxLength={4000}
        placeholder={kind === "bug"
          ? "What did you do, what did you expect, and what happened instead? Which browser?"
          : "Why would this help? The more concrete, the better."}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {errors.body && <p className="ps-err">{errors.body}</p>}
      {errors._ && <p className="ps-err">{errors._}</p>}

      <div className="fb-form-actions">
        <span className="ps-hint">{body.length}/4000</span>
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        )}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}

function Thread({ item, authenticated, onCommented }) {
  const [detail, setDetail] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/feedback/${item.id}/`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setDetail(j.item))
      .catch(() => setDetail({ comment_list: [] }));
  }, [item.id]);

  async function send(e) {
    e.preventDefault();
    if (text.trim().length < 2) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/feedback/${item.id}/comment/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const j = await r.json();
      if (r.ok) {
        setDetail((d) => ({ ...d, comment_list: [...(d?.comment_list || []), j.comment] }));
        setText("");
        onCommented?.(item.id);
      }
    } catch { /* ignore */ } finally {
      setBusy(false);
    }
  }

  const comments = detail?.comment_list || [];

  return (
    <div className="fb-thread">
      {item.body && <p className="fb-body">{item.body}</p>}

      {comments.length > 0 && (
        <div className="fb-comments">
          {comments.map((c) => (
            <div className={`fb-comment ${c.staff_reply ? "staff" : ""}`} key={c.id}>
              <Avatar author={c.author} size={24} />
              <div className="fb-comment-main">
                <div className="fb-comment-head">
                  <span className="fb-comment-name">{c.author?.name}</span>
                  {c.staff_reply && <span className="fb-staff-tag">Dev</span>}
                  <time className="fb-comment-time">{timeAgo(c.created_at)}</time>
                </div>
                <p className="fb-comment-body">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {authenticated ? (
        <form className="fb-reply" onSubmit={send}>
          <input
            className="ps-input"
            placeholder="Add a comment…"
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn" type="submit" disabled={busy || text.trim().length < 2}>
            {busy ? "…" : "Reply"}
          </button>
        </form>
      ) : (
        <p className="ps-hint">Sign in with Steam to join the discussion.</p>
      )}
    </div>
  );
}

function Item({ item, authenticated, onVoted, onCommented }) {
  const [open, setOpen] = useState(false);
  const kind = KIND_META[item.kind] || KIND_META.idea;
  const status = STATUS_META[item.status] || STATUS_META.open;

  return (
    <div className={`fb-item ${open ? "open" : ""} ${item.pinned ? "pinned" : ""}`}>
      <div className="fb-row" onClick={() => setOpen((o) => !o)}>
        <VoteButton item={item} onVoted={onVoted} canVote={authenticated} />

        <div className="fb-main">
          <div className="fb-title-row">
            <span className={`fb-kind ${kind.cls}`} title={kind.label}>{kind.icon}</span>
            <span className="fb-title">{item.title}</span>
            {item.pinned && <span className="fb-pin">Pinned</span>}
          </div>
          <div className="fb-meta">
            <span className={`fb-status ${status.cls}`}>{status.label}</span>
            <span>{item.author?.name}</span>
            <span>·</span>
            <span>{timeAgo(item.created_at)}</span>
            {item.comments > 0 && (
              <>
                <span>·</span>
                <span>{item.comments} {item.comments === 1 ? "reply" : "replies"}</span>
              </>
            )}
          </div>
        </div>

        <span className="fb-chev">▾</span>
      </div>

      {open && (
        <Thread item={item} authenticated={authenticated} onCommented={onCommented} />
      )}
    </div>
  );
}

/** The whole /feedback board. */
export default function Feedback({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("top");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ sort });
    if (kind) qs.set("kind", kind);
    if (status) qs.set("status", status);
    fetch(`${API_BASE}/api/feedback/?${qs}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { setItems(j.items || []); setAuthenticated(!!j.authenticated); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [kind, status, sort]);

  useEffect(() => { load(); }, [load]);

  function onVoted(id, votes, voted) {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, votes, voted } : i)));
  }

  function onCommented(id) {
    setItems((list) =>
      list.map((i) => (i.id === id ? { ...i, comments: (i.comments || 0) + 1 } : i))
    );
  }

  const signedIn = authenticated || !!user;

  return (
    <>
      <div className="page-hero">
        <h1 className="page-title">Feedback</h1>
        <p className="page-sub">
          Found a bug or want something added? Post it here and vote on what
          matters — no GitHub account needed. Prefer talking it through?{" "}
          <a
            className="page-sub-link"
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
          >
            Join the Discord
          </a>.
        </p>
      </div>

      <div className="fb-toolbar">
        <div className="fb-filters">
          <select className="fb-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
            <option value="closed">Closed</option>
          </select>
          <select className="fb-select" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All types</option>
            <option value="bug">Bugs</option>
            <option value="idea">Ideas</option>
            <option value="question">Questions</option>
          </select>
          <select className="fb-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="top">Most voted</option>
            <option value="new">Newest</option>
            <option value="discussed">Most discussed</option>
          </select>
        </div>

        {signedIn ? (
          <button className="btn primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Close" : "New post"}
          </button>
        ) : (
          <a className="btn primary" href={`${API_BASE}/api/auth/steam/login/`}>
            Sign in to post
          </a>
        )}
      </div>

      {showForm && signedIn && (
        <PostForm
          onPosted={(item) => { setItems((l) => [item, ...l]); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="panel"><div className="skeleton tall" /></div>
      ) : items.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-ico">✦</div>
            <h3>Nothing here yet</h3>
            <p>
              {status !== "active" || kind
                ? "Nothing matches those filters."
                : "Be the first to post — bugs, ideas, questions, all welcome."}
            </p>
          </div>
        </div>
      ) : (
        <div className="panel fb-list">
          {items.map((i) => (
            <Item
              key={i.id}
              item={i}
              authenticated={signedIn}
              onVoted={onVoted}
              onCommented={onCommented}
            />
          ))}
        </div>
      )}
    </>
  );
}
