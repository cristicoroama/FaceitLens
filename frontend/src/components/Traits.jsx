const ICON = {
  star_player: "M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z",
  ghost: "M12 2a8 8 0 0 0-8 8v11l3-2 2.5 2 2.5-2 2.5 2 2.5-2 3 2V10a8 8 0 0 0-8-8z",
  multikill_machine: "M4 6h16M4 12h16M4 18h16",
  mvp_magnet: "M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z",
  headhunter: "M12 3a9 9 0 1 0 9 9M12 8v8M8 12h8",
  hard_to_kill: "M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5z",
  deathwish: "M12 2l10 19H2z",
  metronome: "M12 3l6 18H6zM4 15h16",
  rollercoaster: "M3 17l4-8 4 5 4-10 6 13",
  holds_leads: "M4 20V9m5 11V4m5 16v-7m5 7V11",
  loses_leads: "M4 5v11m5-11v7m5-7v13m5-13v4",
  comeback_kid: "M3 17l5-5 4 4 8-9M21 7h-5m5 0v5",
  overtime_king: "M12 3a9 9 0 1 0 9 9M12 7v5l3 2M12 2v2",
  overtime_choke: "M12 3a9 9 0 1 0 9 9M12 7v5l3 2M4 4l16 16",
  one_trick: "M12 21s-7-5.4-7-11a7 7 0 0 1 14 0c0 5.6-7 11-7 11z",
  plays_every_map: "M9 4L3 7v13l6-3 6 3 6-3V4l-6 3z",
  weekend_warrior: "M7 2v4M17 2v4M3 9h18M4 5h16v16H4z",
  weekday_warrior: "M3 9h18M4 5h16v16H4zM8 14h8",
  bad_days: "M12 3a9 9 0 1 0 9 9M9 15s1-2 3-2 3 2 3 2M9 9h.01M15 9h.01",
  marathon: "M13 2L4 14h7l-1 8 9-12h-7z",
  awper: "M12 3v18M3 12h18M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  clutch_merchant: "M6 11V6a2 2 0 1 1 4 0v5M10 11V4a2 2 0 1 1 4 0v7M14 11V6a2 2 0 1 1 4 0v9a6 6 0 0 1-12 0v-2",
  opening_duelist: "M13 2L4 14h7l-1 8 9-12h-7z",
  first_to_die: "M12 2l10 19H2zM12 9v4M12 17h.01",
};

const FALLBACK = "M12 3a9 9 0 1 0 9 9";

export default function Traits({ traits }) {
  const list = traits?.traits || [];
  if (!list.length) return null;

  return (
    <div className="traits">
      {list.map((t) => (
        <span
          key={t.key}
          className={`trait trait-${t.tone}`}
          title={t.detail ? `${t.label} — ${t.detail}` : t.label}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round"
               strokeLinejoin="round" aria-hidden="true">
            <path d={ICON[t.key] || FALLBACK} />
          </svg>
          <span className="trait-label">{t.label}</span>
          {t.detail && <span className="trait-detail">{t.detail}</span>}
        </span>
      ))}
    </div>
  );
}
