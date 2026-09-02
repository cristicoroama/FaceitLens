import { useState, useEffect, useRef } from "react";
import { API_BASE } from "../api.js";
import { Icon } from "../icons.jsx";

const CATEGORIES = [
  ["support", "Support"],
  ["bug", "Bug report"],
  ["api", "API access"],
  ["data", "Data correction"],
  ["other", "Other"],
];

const STATUS_LABEL = {
  open: "Open",
  waiting: "Waiting on you",
  progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

function when(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

async function post(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error || `Error ${r.status}`);
  return json;
}

function NewTicket({ initialCategory, onCreated }) {
  const openedAt = useRef(Date.now());
  const [category, setCategory] = useState(initialCategory || "support");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [useCase, setUseCase] = useState("");
  const [rpm, setRpm] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await post("/api/support/ticket/", {
        category, email, subject, body, website,
        started_at: openedAt.current,
        api_use_case: useCase,
        api_expected_rpm: rpm,
        api_project_url: projectUrl,
      });
      onCreated(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="sup-form" onSubmit={submit}>
      <div className="sup-cats">
        {CATEGORIES.map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`sup-cat ${category === k ? "on" : ""}`}
            onClick={() => setCategory(k)}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="sup-field">
        <span>Your email</span>
        <input
          type="email"
          value={email}
          required
          placeholder="name@example.com"
          onChange={(e) => setEmail(e.target.value)}
        />
        <i>We only use it to reply. Keep your ticket code — it's how you check back.</i>
      </label>

      <label className="sup-field">
        <span>Subject</span>
        <input
          type="text"
          value={subject}
          required
          maxLength={160}
          placeholder={category === "api" ? "API access for my Discord bot" : "Short summary"}
          onChange={(e) => setSubject(e.target.value)}
        />
      </label>

      <label className="sup-field">
        <span>{category === "bug" ? "What happened, and what did you expect?" : "Details"}</span>
        <textarea
          rows={6}
          value={body}
          required
          maxLength={5000}
          placeholder={
            category === "bug"
              ? "Which page, which player, what you clicked, what went wrong."
              : "As much detail as you can give."
          }
          onChange={(e) => setBody(e.target.value)}
        />
      </label>

      {category === "api" && (
        <div className="sup-api">
          <label className="sup-field">
            <span>What are you building?</span>
            <textarea
              rows={3}
              value={useCase}
              maxLength={5000}
              placeholder="A Discord bot that posts my team's ELO every morning."
              onChange={(e) => setUseCase(e.target.value)}
            />
          </label>
          <div className="sup-row">
            <label className="sup-field">
              <span>Requests per minute (estimate)</span>
              <input
                type="number"
                min="1"
                max="100000"
                value={rpm}
                placeholder="30"
                onChange={(e) => setRpm(e.target.value)}
              />
            </label>
            <label className="sup-field">
              <span>Project link (optional)</span>
              <input
                type="url"
                value={projectUrl}
                placeholder="https://github.com/you/project"
                onChange={(e) => setProjectUrl(e.target.value)}
              />
            </label>
          </div>
        </div>
      )}

      <input
        className="sup-hp"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        aria-hidden="true"
      />

      {error && <div className="state error">{error}</div>}

      <button className="sup-submit" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Open ticket"}
      </button>
    </form>
  );
}

function TicketView({ ticket, onReply }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const closed = ticket.status === "resolved" || ticket.status === "rejected";

  async function send(e) {
    e.preventDefault();
    if (busy || reply.trim().length < 2) return;
    setBusy(true);
    setError("");
    try {
      await post("/api/support/reply/", { ref: ticket.ref, email: ticket.email, body: reply });
      setReply("");
      onReply();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sup-ticket">
      <div className="sup-ticket-head">
        <div>
          <div className="sup-ref">{ticket.ref}</div>
          <div className="sup-subject">{ticket.subject}</div>
        </div>
        <span className={`sup-status ${ticket.status}`}>{STATUS_LABEL[ticket.status] || ticket.status}</span>
      </div>

      <div className="sup-thread">
        <div className="sup-msg">
          <div className="sup-msg-who">You · {when(ticket.created_at)}</div>
          <div className="sup-msg-body">{ticket.body}</div>
        </div>
        {(ticket.messages || []).map((m, i) => (
          <div className={`sup-msg ${m.from_staff ? "staff" : ""}`} key={i}>
            <div className="sup-msg-who">
              {m.from_staff ? "FaceitLens" : "You"} · {when(m.created_at)}
            </div>
            <div className="sup-msg-body">{m.body}</div>
          </div>
        ))}
      </div>

      {(ticket.api_keys || []).length > 0 && (
        <div className="sup-keys">
          <div className="sup-keys-head">Your API key{ticket.api_keys.length > 1 ? "s" : ""}</div>
          {ticket.api_keys.map((k) => (
            <div className="sup-key" key={k.key}>
              <code>{k.key}</code>
              <button type="button" onClick={() => navigator.clipboard?.writeText(k.key)}>
                Copy
              </button>
              <i>{k.rate_per_minute} req/min</i>
            </div>
          ))}
          <p className="sup-keys-note">
            Send it as the <code>X-API-Key</code> header. Treat it like a password —
            anyone who has it uses your quota.
          </p>
        </div>
      )}

      {closed ? (
        <div className="state">This ticket is closed. Open a new one if you need more.</div>
      ) : (
        <form className="sup-reply" onSubmit={send}>
          <textarea
            rows={3}
            value={reply}
            placeholder="Add a reply…"
            maxLength={5000}
            onChange={(e) => setReply(e.target.value)}
          />
          {error && <div className="state error">{error}</div>}
          <button type="submit" disabled={busy || reply.trim().length < 2}>
            {busy ? "Sending…" : "Reply"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function Support({ initialCategory }) {
  const [tab, setTab] = useState("new");
  const [created, setCreated] = useState(null);
  const [lookupRef, setLookupRef] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [ticket, setTicket] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialCategory === "api") setTab("new");
  }, [initialCategory]);

  async function find(e) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        `${API_BASE}/api/support/lookup/?ref=${encodeURIComponent(lookupRef)}&email=${encodeURIComponent(lookupEmail)}`
      );
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || `Error ${r.status}`);
      setTicket({ ...json, email: lookupEmail });
    } catch (err) {
      setTicket(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-hero">
        <h1 className="page-title">Support</h1>
        <p className="page-sub">
          Bugs, wrong data, or a request for API access. Every ticket gets a code —
          keep it, it's how you check back without an account.
        </p>
      </div>

      <div className="sup-tabs">
        <button className={tab === "new" ? "on" : ""} onClick={() => { setTab("new"); setCreated(null); }}>
          New ticket
        </button>
        <button className={tab === "find" ? "on" : ""} onClick={() => setTab("find")}>
          Check a ticket
        </button>
      </div>

      {tab === "new" && !created && (
        <NewTicket initialCategory={initialCategory} onCreated={setCreated} />
      )}

      {tab === "new" && created && (
        <div className="sup-done">
          <div className="sup-done-ic">{Icon.checkLg}</div>
          <h2>Ticket opened</h2>
          <p>
            Your reference is <strong className="sup-ref">{created.ref}</strong>. Write it down —
            with your email it's the only way to reopen this thread.
          </p>
          <p className="sup-done-note">
            There's no email notification yet, so check back here for a reply.
          </p>
          <button
            className="sup-submit"
            onClick={() => {
              setLookupRef(created.ref);
              setTab("find");
            }}
          >
            Go to this ticket
          </button>
        </div>
      )}

      {tab === "find" && (
        <>
          <form className="sup-lookup" onSubmit={find}>
            <input
              type="text"
              value={lookupRef}
              placeholder="FL-A1B2C3"
              onChange={(e) => setLookupRef(e.target.value)}
            />
            <input
              type="email"
              value={lookupEmail}
              placeholder="the email you used"
              onChange={(e) => setLookupEmail(e.target.value)}
            />
            <button type="submit" disabled={busy || !lookupRef.trim() || !lookupEmail.trim()}>
              {busy ? "Looking…" : "Find"}
            </button>
          </form>
          {error && <div className="state error">{error}</div>}
          {ticket && <TicketView ticket={ticket} onReply={find} />}
        </>
      )}
    </>
  );
}
