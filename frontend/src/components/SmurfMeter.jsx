import RingGauge from "./RingGauge.jsx";

/**
 * Heuristic "smurf-o-meter". Combines gameplay dominance (HS%, K/D, win rate,
 * streaks) with account signals (few matches at a high level, low CS2 hours vs
 * skill, young Steam account) into a 0-100 smurf likelihood + the reasons.
 * Not proof — smurfing can only be confirmed by demos — but a strong sniff test.
 */
function analyze(data) {
  const s = data.stats || {};
  const steam = data.steam || {};
  const matches = Number(s.matches) || 0;
  const kd = Number(s.avg_kd) || 0;
  const hs = Number(s.avg_hs) || 0;
  const wr = Number(s.win_rate) || 0;
  const level = Number(data.skill_level) || 0;
  const elo = Number(data.elo) || 0;
  const streak = Number(s.longest_win_streak) || 0;
  const hours = steam.hours_cs2 != null ? Number(steam.hours_cs2) : null;
  const created = steam.created ? Number(steam.created) : null;
  const ageYears = created ? (Date.now() / 1000 - created) / (365.25 * 24 * 3600) : null;

  const signals = [];
  let score = 0;
  const add = (pts, label, detail, hit) => {
    if (!hit) return;
    score += pts;
    signals.push({ label, detail, weight: pts });
  };

  // --- FACEIT's own verdict trumps everything ---
  const bans = Array.isArray(data.bans) ? data.bans : [];
  const banText = bans.map((b) => `${b.reason || ""} ${b.type || ""}`).join(" ").toLowerCase();
  const bannedForSmurf = /smurf/.test(banText);
  const banned = bans.length > 0;
  add(100, "Banned by FACEIT for smurfing", "This account has an active smurfing ban — confirmed.", bannedForSmurf);

  // A smurf plays BELOW their true rank on an IMMATURE account. Raw dominance
  // alone is not smurfing — pros crush lobbies legitimately. So the real signal
  // is a MISMATCH: elite performance on a young / low-games / low-hours account
  // that hasn't yet climbed to where it belongs.

  const dominates = hs >= 52 || kd >= 1.2 || wr >= 60;      // clearly above-average play
  const veryDominant = hs >= 58 || kd >= 1.35 || wr >= 66;

  // --- account immaturity (the core of smurf detection) ---
  add(32, "Sky-high rank on almost no games",
    `Level ${level} in only ${matches} matches`,
    dominates && matches > 0 && matches < 60 && level >= 7);
  add(18, "High rank, few games",
    `Level ${level} · ${matches} matches`,
    dominates && matches >= 60 && matches < 180 && (level >= 8 || elo >= 1900));

  if (hours != null) {
    add(28, "Elite skill, very low CS2 hours",
      `${hours}h in CS2 but playing at level ${level}`,
      dominates && hours < 400 && level >= 6);
    add(14, "Modest hours for the skill",
      `${hours}h in CS2`,
      dominates && hours >= 400 && hours < 900 && level >= 8);
  }

  if (ageYears != null) {
    add(16, "Fresh Steam account already stomping",
      `Steam account ~${ageYears.toFixed(1)} yrs old`,
      dominates && ageYears < 1.5 && matches < 300);
  }

  // dominance only *amplifies* once at least one mismatch signal fired
  if (signals.length > 0) {
    add(10, "Elite headshot rate", `${hs}% HS — above the norm for the rank`, hs >= 55);
    add(8, "Crushing K/D", `${kd} K/D`, kd >= 1.35);
    add(6, "Long win streak", `${streak}-game best streak`, streak >= 12);
  }

  // --- legitimacy gates ---
  const verified = !!data.verified;
  const premium = Array.isArray(data.memberships) && data.memberships.some((m) => /premium/i.test(m));
  const vac = !!(steam.vac_banned);
  const established = matches >= 400 || (hours != null && hours >= 1500);
  const maxedRank = level >= 10 || elo >= 2200;

  // Verified (phone-tied) and Premium (paid) accounts are rarely throwaway
  // smurfs — people don't invest in accounts they'll ditch. Strong reducers.
  const legit = [];
  // legit reducers only apply to *unbanned* accounts — a smurfing ban is final
  if (!bannedForSmurf) {
    if (verified) { score -= 18; legit.push("FACEIT verified"); }
    if (premium) { score -= 16; legit.push("FACEIT Premium"); }
    if (established) score = Math.min(score, 12);
    if (maxedRank) score = Math.min(score, 18); // already at the ceiling — nowhere to smurf
  }

  score = Math.max(0, Math.min(100, score));

  // reason to show when clean
  let cleanReason = "Stats and account line up with the rank — no smurf red flags.";
  if (established) cleanReason = `Established account — ${matches} matches${hours != null ? ` · ${hours}h` : ""}. This rank was earned.`;
  else if (maxedRank) cleanReason = `Already at the top of the ladder (level ${level}${elo ? ` · ${elo} ELO` : ""}) — not smurfing.`;
  else if (legit.length) cleanReason = `${legit.join(" + ")} — invested account, unlikely a throwaway smurf.`;

  let tier, color;
  if (bannedForSmurf) { tier = "CONFIRMED SMURF"; color = "#ef4444"; }
  else if (score >= 70) { tier = "TEXTBOOK SMURF"; color = "#ef4444"; }
  else if (score >= 45) { tier = "LIKELY SMURF"; color = "#f59e0b"; }
  else if (score >= 25) { tier = "SOME SMURF SIGNS"; color = "#eab308"; }
  else { tier = "LOOKS LEGIT"; color = "#22c55e"; }

  signals.sort((a, b) => b.weight - a.weight);
  return { score, tier, color, signals, matches, cleanReason, legit, verified, premium };
}

export default function SmurfMeter({ data }) {
  const r = analyze(data);
  const enoughData = r.matches >= 5;

  return (
    <div className="panel smurf">
      <div className="panel-head">
        <div className="panel-ic" style={{
          background: `linear-gradient(135deg, ${r.color}33, ${r.color}11)`,
          borderColor: `${r.color}66`, color: r.color,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /><path d="M8 11h6M11 8v6" />
          </svg>
        </div>
        <div className="panel-title">Smurf Detector</div>
        <div className="panel-sub">gameplay + account sniff test</div>
      </div>

      {!enoughData ? (
        <div className="state" style={{ padding: "10px 0" }}>
          Not enough matches to judge yet.
        </div>
      ) : (
        <div className="smurf-body">
          <div className="smurf-gauge">
            <RingGauge
              value={r.score}
              max={100}
              size={140}
              stroke={12}
              color={r.color}
              display={<>{r.score}<span style={{ fontSize: 16, opacity: 0.8 }}>%</span></>}
              sublabel="smurf"
              valueSize={36}
            />
            <div className="smurf-tier" style={{ color: r.color, borderColor: r.color }}>{r.tier}</div>
          </div>

          <div className="smurf-signals">
            {r.signals.length === 0 ? (
              <div className="smurf-clean">✓ {r.cleanReason}</div>
            ) : (
              r.signals.map((sig) => (
                <div className="smurf-sig" key={sig.label}>
                  <span className="smurf-dot" style={{ background: r.color }} />
                  <div className="smurf-sig-main">
                    <div className="smurf-sig-label">{sig.label}</div>
                    <div className="smurf-sig-detail">{sig.detail}</div>
                  </div>
                  <span className="smurf-sig-w">+{sig.weight}</span>
                </div>
              ))
            )}
            {r.legit.length > 0 && (
              <div className="smurf-legit">
                {r.legit.map((l) => (
                  <span className="smurf-legit-badge" key={l}>✓ {l}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="smurf-note">
        Heuristic estimate from public stats — not proof. Real cheating/smurfing can
        only be confirmed from demos. Use it as a quick sniff test.
      </div>
    </div>
  );
}
