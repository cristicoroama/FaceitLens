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

  const signals = [];
  let score = 0;
  const add = (pts, label, detail, hit) => {
    if (!hit) return;
    score += pts;
    signals.push({ label, detail, weight: pts });
  };

  // --- gameplay dominance ---
  add(26, "Elite headshot rate", `${hs}% HS — way above the average for this rank`, hs >= 55);
  add(12, "High headshot rate", `${hs}% HS`, hs >= 48 && hs < 55);

  add(22, "Crushing K/D", `${kd} K/D — dominating lobbies`, kd >= 1.3);
  add(11, "Strong K/D", `${kd} K/D`, kd >= 1.15 && kd < 1.3);

  add(16, "Very high win rate", `${wr}% wins`, wr >= 65);
  add(8, "High win rate", `${wr}% wins`, wr >= 58 && wr < 65);

  add(8, "Long win streak", `${streak}-game best streak`, streak >= 10);

  // --- account / progression mismatch ---
  add(22, "Climbed on very few games", `Level ${level} in only ${matches} matches`, matches > 0 && matches < 100 && level >= 7);
  add(12, "High rank, low games", `${matches} matches`, matches >= 100 && matches < 250 && (level >= 8 || elo >= 2000));

  if (hours != null) {
    add(20, "Low CS2 hours for the skill", `${hours}h in CS2 but performing at level ${level}`, hours < 500 && level >= 6);
    add(10, "Modest hours, high skill", `${hours}h in CS2`, hours >= 500 && hours < 1000 && level >= 9);
  }

  if (created) {
    const ageYears = (Date.now() / 1000 - created) / (365.25 * 24 * 3600);
    add(12, "Young Steam account", `Steam account ~${ageYears.toFixed(1)} yrs old`, ageYears < 1.5);
    add(6, "Fairly new Steam account", `~${ageYears.toFixed(1)} yrs old`, ageYears >= 1.5 && ageYears < 3);
  }

  score = Math.max(0, Math.min(100, score));

  let tier, color;
  if (score >= 70) { tier = "TEXTBOOK SMURF"; color = "#ef4444"; }
  else if (score >= 45) { tier = "LIKELY SMURF"; color = "#f59e0b"; }
  else if (score >= 25) { tier = "SOME SMURF SIGNS"; color = "#eab308"; }
  else { tier = "LOOKS LEGIT"; color = "#22c55e"; }

  // sort signals by weight (strongest first)
  signals.sort((a, b) => b.weight - a.weight);
  return { score, tier, color, signals, matches };
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
              <div className="smurf-clean">
                ✓ No smurf red flags — stats and account line up with the rank.
              </div>
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
