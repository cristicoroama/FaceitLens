import { useState } from "react";
import CompareView from "./CompareView.jsx";
import { getJson } from "../api.js";

/**
 * Compare, scoped to the profile you're already looking at.
 *
 * The /compare tool page starts from nothing and asks for up to five names.
 * From inside a profile the first name is already settled, so this asks for
 * one thing: who to compare against. Same table underneath.
 *
 * This exists because the tab originally rendered `<CompareView players={nickname} />`
 * — a string where an array of player objects was expected. CompareView calls
 * `players.filter(...)`, strings have no `.filter`, and the whole page went
 * white. Passing the right shape is this component's entire job.
 */
export default function ProfileCompare({ player, onPick }) {
  const [name, setName] = useState("");
  const [other, setOther] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(e) {
    e?.preventDefault();
    const nick = name.trim();
    if (!nick || loading) return;
    if (nick.toLowerCase() === (player.nickname || "").toLowerCase()) {
      setError("That's the same player. Pick someone else.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setOther(await getJson(`/api/player/${encodeURIComponent(nick)}/`));
    } catch (err) {
      setOther(null);
      setError(err.message || "Couldn't load that player.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="section-title">
        Compare with {player.nickname}
        <span className="pcmp-note">head to head</span>
      </div>

      <form className="pcmp-form" onSubmit={run}>
        <input
          type="text"
          className="compare-input"
          placeholder="Enter a FACEIT nickname"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          aria-label="Nickname to compare against"
        />
        <button type="submit" className="pcmp-go" disabled={!name.trim() || loading}>
          {loading ? "Loading…" : "Compare"}
        </button>
        {other && (
          <button
            type="button"
            className="pcmp-clear"
            onClick={() => { setOther(null); setName(""); setError(""); }}
          >
            Clear
          </button>
        )}
      </form>

      {error && <div className="state error">{error}</div>}

      {/* An array of two player objects — the shape CompareView actually wants. */}
      {other && <CompareView players={[player, other]} onPick={onPick} />}

      {!other && !error && !loading && (
        <div className="state">
          Type a nickname above to put the two profiles side by side.
        </div>
      )}
    </>
  );
}
