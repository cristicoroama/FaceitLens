import { useState, useEffect, useRef } from "react";
import { Flag, FaceitLevel } from "./RankIcons.jsx";
import { getJson, isAbort } from "../api.js";
import useListNav from "../hooks/useListNav.js";

export default function SearchInput({ value, onChange, onPick, onEnter, placeholder, label, autoFocus }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const focused = useRef(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      getJson(`/api/search/?q=${encodeURIComponent(q)}`, { ttl: 30000, signal: ctrl.signal, retry: 0 })
        .then((json) => {
          setSuggestions(json.items || []);
          if (focused.current) setOpen(true);
        })
        .catch((err) => { if (!isAbort(err)) setSuggestions([]); });
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const shown = open && suggestions.length > 0;

  function pick(s) {
    setOpen(false);
    setQuery("");
    onPick(s.nickname);
  }

  const nav = useListNav({
    count: shown ? suggestions.length : 0,
    initial: -1,
    enabled: shown,
    onSelect: (i, e) => {
      if (shown && i >= 0 && suggestions[i]) {
        e.preventDefault();
        pick(suggestions[i]);
        return;
      }
      setOpen(false);
      onEnter();
    },
    onEscape: (e) => {
      if (shown) {
        e.preventDefault();
        setOpen(false);
      }
    },
  });

  return (
    <div className="autocomplete" ref={boxRef}>
      <input
        type="text"
        role="combobox"
        aria-label={label || placeholder}
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={nav.listId}
        aria-activedescendant={shown ? nav.activeId : undefined}
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setQuery(e.target.value);
        }}
        onFocus={() => {
          focused.current = true;
          if (suggestions.length) setOpen(true);
        }}
        onBlur={() => {
          focused.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !shown && suggestions.length) {
            e.preventDefault();
            setOpen(true);
            return;
          }
          nav.onKeyDown(e);
        }}
      />
      <div
        className="suggestions"
        role="listbox"
        id={nav.listId}
        ref={nav.listRef}
        hidden={!shown}
        aria-label={label || placeholder}
      >
        {shown && suggestions.map((s, i) => (
          <div
            className={`suggestion ${i === nav.active ? "active" : ""}`}
            key={s.nickname}
            id={nav.optionId(i)}
            role="option"
            aria-selected={i === nav.active}
            data-nav-index={i}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => nav.setActive(i)}
            onClick={() => pick(s)}
          >
            {s.avatar ? (
              <img src={s.avatar} alt="" />
            ) : (
              <div className="suggestion-noimg" />
            )}
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
    </div>
  );
}
