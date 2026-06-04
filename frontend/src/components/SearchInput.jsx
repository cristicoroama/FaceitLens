import { useState, useEffect, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function SearchInput({ value, onChange, onPick, onEnter, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const timer = useRef(null);

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
        setOpen(true);
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
        onFocus={() => suggestions.length && setOpen(true)}
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
              <span className="suggestion-name">{s.nickname}</span>
              {s.country && <span className="suggestion-country">{s.country.toUpperCase()}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
