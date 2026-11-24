import { DISCORD_BOT_INVITE, DISCORD_INVITE } from "../links.js";
import { DiscordIcon } from "./BrandIcons.jsx";

const COMMANDS = [
  ["/elo nickname", "Level, ELO, win rate and the last 10 results of any FACEIT player."],
  ["/stats nickname", "Full stats card with the generated profile image."],
  ["/season nickname", "Season report and placement progress."],
  ["/compare a b", "Two players head to head, stat by stat."],
  ["/roast nickname", "Let the AI roast someone's stats."],
  ["/elos", "ELO table of everyone tracked in the server, with today's change."],
  ["/track add · remove · list", "Choose which players the server follows (up to 25)."],
  ["/track channel #channel", "Post every finished match of tracked players in a channel."],
  ["/verify code", "Verified FACEIT Level 1–10 role, updated automatically."],
  ["/pickem code", "Standings of a Faceit-Lens Major Pick'em league."],
];

function Preview() {
  return (
    <div className="db-preview" aria-hidden="true">
      <div className="db-msg">
        <span className="db-ava"><DiscordIcon size={18} /></span>
        <div className="db-msg-body">
          <div className="db-msg-head"><b>FaceitLens</b><span className="db-tag">BOT</span><span className="db-time">Today at 21:04</span></div>
          <div className="db-embed win">
            🟩 <b>krabeni</b> won on <b>Mirage</b> 13 / 9 · 24-15 · ELO 2104 → <b>2129</b> (+25)
          </div>
          <div className="db-embed">
            <div className="db-embed-title">FACEIT ELO</div>
            <div className="db-row"><code>1</code><b>krabeni</b> · Lvl 10 · <b>2129</b> (+25 today) 🟩🟩🟥🟩🟩</div>
            <div className="db-row"><code>2</code><b>dan1zerra</b> · Lvl 7 · <b>1411</b> 🟥🟩🟩🟥🟩</div>
            <div className="db-row"><code>3</code><b>yourfriend</b> · Lvl 5 · <b>1122</b> (−25 today) 🟥🟥🟩🟥🟥</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DiscordBot() {
  return (
    <>
      <div className="db-hero">
        <div className="db-hero-txt">
          <div className="db-eyebrow">Free Discord bot</div>
          <h1 className="db-title">FACEIT stats in your Discord</h1>
          <p className="db-sub">
            ELO and stats on demand, a live ELO table of your friends, automatic match results in a channel and
            verified FACEIT level roles. No premium tier.
          </p>
          <div className="db-ctas">
            <a className="db-add" href={DISCORD_BOT_INVITE} target="_blank" rel="noopener noreferrer">
              <DiscordIcon size={18} /> Add to Discord
            </a>
            <a className="act-btn" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">Join our server</a>
          </div>
        </div>
        <Preview />
      </div>

      <div className="section-title">Commands</div>
      <div className="db-cmds">
        {COMMANDS.map(([c, d]) => (
          <div className="db-cmd" key={c}>
            <code>{c}</code>
            <span>{d}</span>
          </div>
        ))}
      </div>

      <div className="section-title">Set up in 2 minutes</div>
      <ol className="db-steps">
        <li><b>Add the bot</b> with the button above and pick your server. You need the Manage Server permission.</li>
        <li><b>Track your friends</b>: <code>/track add nickname</code> for each one, then <code>/elos</code> to post the table.</li>
        <li><b>Match feed</b>: <code>/track channel #faceit</code> and every finished match shows up there.</li>
        <li>
          <b>Level roles</b>: in Server Settings → Roles, drag the FaceitLens role above the “FACEIT Level” roles.
          Members get their code on <a href="/settings">faceit-lens.com/settings</a> after linking FACEIT, then type <code>/verify</code>.
          Create a <code>#level-ups</code> channel to announce promotions.
        </li>
      </ol>
    </>
  );
}
