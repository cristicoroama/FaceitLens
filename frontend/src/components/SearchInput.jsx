import { useState, useEffect, useRef } from "react";
import { Flag, FaceitLevel } from "./RankIcons.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function SearchInput({ value, onChange, onPick, onEnter, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const timer = useRef(null);
  // Several SearchInputs can share the same bound value (topbar + home hero);
  // only the focused one should pop its suggestion dropdown.
  const focused = useRef(false);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!value || value.length < 2) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/search/?q=${encodeURIComponent(value)}`);
        const json = await resp.json();
        setSuggestions(json.items || []);
        if (focused.current) setOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [value]);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="autocomplete" ref={boxRef}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          focused.current = true;
          if (suggestions.length) setOpen(true);
        }}
        onBlur={() => {
          focused.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setOpen(false);
            onEnter();
          }
        }}
      />
      {open && suggestions.length > 0 && (
        <div className="suggestions">
          {suggestions.map((s) => (
            <div
              className="suggestion"
              key={s.nickname}
              onClick={() => {
                setOpen(false);
                onPick(s.nickname);
              }}
            >
              {s.avatar ? (
                <img src={s.avatar} alt="" />
              ) : (
                <div className="suggestion-noimg" />
              )}
              {/* Flag beside the name, level on the right — the same reading
                  order the profile header uses, so a player looks the same
                  wherever they appear. */}
              {s.country && <Flag country={s.country} size={16} />}
              <span className="suggestion-name">{s.nickname}</span>
              {s.verified && (
                <img
                  className="suggestion-verified"
                  src="/badges/verified.svg"
                  alt="Verified"
                  title="Verified FACEIT account"
                />
              )}
              {s.elo != null && (
                <span className="suggestion-elo">{s.elo.toLocaleString()}</span>
              )}
              {s.level != null && <FaceitLevel level={s.level} size={22} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
