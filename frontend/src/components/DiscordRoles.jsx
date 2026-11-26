import { useEffect, useState } from "react";
import { DiscordIcon } from "./BrandIcons.jsx";
import { DISCORD_INVITE } from "../links.js";

const API_BASE = import.meta.env.VITE_API_URL || "";

async function call(method) {
  const r = await fetch(`${API_BASE}/api/discord/code/`, { method, credentials: "include" });
  let j = null;
  try { j = await r.json(); } catch { /* empty */ }
  if (!r.ok) throw new Error(j?.error || `Error ${r.status}`);
  return j;
}

export default function DiscordRoles() {
  const [state, setState] = useState(null);
  const [code, setCode] = useState(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => { call("GET").then(setState).catch(() => setState({ linked: false, faceit_verified: false })); }, []);

  async function getCode() {
    setErr("");
    try { setCode(await call("POST")); } catch (e) { setErr(e.message); }
  }

  async function unlink() {
    setErr("");
    try { setState(await call("DELETE")); setCode(null); } catch (e) { setErr(e.message); }
  }

  if (!state) return null;
  const cmd = code ? `/verify ${code.code}` : "";

  return (
    <div className="panel ps-card">
      <div className="panel-head">
        <h2 className="panel-title">Discord level role</h2>
        {state.linked && <span className="dr-on">Linked</span>}
      </div>
      <p className="ps-hint">
        Get a verified FACEIT level role (Level 1–10) in our Discord and in any server that uses the FaceitLens bot.
        It updates by itself when you level up.
      </p>

      {!state.faceit_verified ? (
        <>
          <p className="ps-hint dim">Link your FACEIT account above first. Roles are only given to verified accounts.</p>
          {state.linked && (
            <div className="ps-btn-row">
              <button type="button" className="btn ghost" onClick={unlink}>Unlink Discord</button>
            </div>
          )}
        </>
      ) : (
        <>
          {code ? (
            <div className="dr-code">
              <span className="ps-hint">In Discord, type:</span>
              <div className="dr-cmd">
                <code>{cmd}</code>
                <button type="button" className="btn ghost" onClick={() => {
                  navigator.clipboard?.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
                }}>{copied ? "Copied" : "Copy"}</button>
              </div>
              <span className="ps-hint dim">The code works once and expires in 15 minutes.</span>
            </div>
          ) : null}
          <div className="ps-btn-row">
            <button type="button" className="btn primary" onClick={getCode}>
              {state.linked ? "Link another Discord account" : code ? "New code" : "Get my code"}
            </button>
            <a className="btn dr-join" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
              <DiscordIcon size={15} /> Join our Discord
            </a>
            {state.linked && <button type="button" className="btn ghost" onClick={unlink}>Unlink</button>}
          </div>
        </>
      )}
      {err && <p className="ps-err">{err}</p>}
    </div>
  );
}
