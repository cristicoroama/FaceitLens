export const TOOL_COPY = {
  discordbot: {
    heading: "A FACEIT bot for your Discord server",
    paras: [
      "Add the Faceit-Lens bot to any Discord server you manage and everyone can look up a FACEIT CS2 player without leaving Discord: /elo for level, ELO and recent form, /stats for the full card with win rate, K/D and headshot rate, and /compare to put two players head to head.",
      "Track your friends with /track add and post the whole table with /elos, sorted by ELO with today's change and the last five results. Point it at a channel with /track channel and the bot posts every finished match of a tracked player: result, map, score, K-D and the ELO change.",
      "Verified level roles give each member a FACEIT Level 1 to 10 role that updates by itself. Members sign in on faceit-lens.com, link their FACEIT account and type /verify with a one-time code, so nobody can claim someone else's level.",
    ],
    faq: [
      ["Is the bot free?", "Yes. There is no paid tier and no premium commands."],
      ["What permissions does it need?", "View Channels, Send Messages, Embed Links and Use Slash Commands. Manage Roles is only needed for level roles; the bot's own role has to sit above the FACEIT Level roles."],
      ["Does it read my server's messages?", "No. It only answers slash commands and posts in the channel you choose. It does not request the message content intent."],
    ],
  },
  matchroom: {
    heading: "How the FACEIT match room analyser works",
    paras: [
      "Paste the link of any FACEIT CS2 match room and Faceit-Lens scouts all ten players at once: FACEIT level and ELO, win rate and K/D over their recent matches, their best and worst maps, and an account trust score built from Steam account age, CS2 hours, bans and reputation data.",
      "It also shows FACEIT's own win probability for each side, the skill spread of both rosters and who is a stand-in, so you can see before the veto whether the lobby is even, which map the other team is most comfortable on and whether someone looks like a smurf.",
      "Nothing is installed and nothing is sent to FACEIT on your behalf. The analyser reads the same public match data the FACEIT website shows, from FACEIT's official Data API.",
    ],
    faq: [
      ["Where do I find the match room link?", "Open your match on faceit.com and copy the address from the browser bar. It looks like faceit.com/en/cs2/room/1-xxxxxxxx. You can paste it during the veto, while the match is live or after it has finished."],
      ["How is the trust score calculated?", "It combines Steam account age, CS2 hours, Steam level, inventory size, FACEIT and VAC bans and community reputation. A low score is a signal to look closer, not proof that someone is cheating or smurfing."],
      ["Is the win prediction accurate?", "It is FACEIT's own forecast for the match, based on the ELO of both teams. Upsets happen in about a third of matches, so treat it as the starting point, not the result."],
    ],
  },
  pickem: {
    heading: "CS2 Major Pick'em with your friends",
    paras: [
      "Faceit-Lens Pick'em follows the Swiss format of the CS2 Major. Simulate every round of a stage by clicking the team you think wins each match; the bracket builds the next round's pairings by itself, exactly like the real Swiss system, and your two 3-0 teams, two 0-3 teams and six advancing teams are filled in automatically.",
      "Create a private league, send the invite link to your friends or your Discord server and race them on a live leaderboard as results come in. Picks lock when each stage starts, and every correct pick is worth one point.",
      "The sticker tab shows every team and autograph sticker of the Major in paper, holo, foil and gold, so you can see what your favourite team's capsule looks like before you buy it.",
    ],
    faq: [
      ["Is it the same as Valve's in-game Pick'em?", "No. It is a separate, free game on Faceit-Lens with private leagues between friends. Your in-game Pick'em and viewer pass are not affected."],
      ["When do picks lock?", "When the first match of each stage starts. You can change your bracket as often as you like until then."],
      ["How are points counted?", "One point for each team you placed correctly: 3-0, 0-3, or advancing. A team you picked to advance also counts if it goes 3-0."],
    ],
  },
  compare: {
    heading: "Compare FACEIT players side by side",
    paras: [
      "Put up to five FACEIT CS2 players next to each other and compare ELO, level, win rate, K/D, ADR, headshot rate and map performance on one screen. The ELO chart overlays everyone's recent curve, so it is easy to see who is climbing and who is stuck.",
      "Use it to settle who carries in your premade, to check a new teammate before you invite them, or to see how far you are from a friend's level.",
    ],
    faq: [
      ["Can I compare players from different regions?", "Yes. Any FACEIT CS2 account can be compared, whatever its region or level."],
      ["Which matches are counted?", "Lifetime stats come straight from FACEIT. Recent averages use the last 30 FACEIT CS2 matches."],
    ],
  },
  leaderboard: {
    heading: "FACEIT CS2 leaderboards by region and country",
    paras: [
      "The FACEIT CS2 ranking for Europe, North America, South America, Southeast Asia and Oceania, ordered by ELO, with each player's level and country. Filter any region by country to see the best players from your own country, or open the world map to compare countries by how many players they have among FACEIT's top 1000.",
      "The top 1000 of each region are FACEIT Challengers. Click any player to open their full stats, match history and map performance.",
    ],
    faq: [
      ["How often is the leaderboard updated?", "Every few minutes, straight from FACEIT's official ranking."],
      ["What ELO do you need for Level 10?", "Level 10 starts at 2001 ELO. Level 9 is 1751 to 2000, Level 8 is 1531 to 1750 and Level 1 is 100 to 500. Challenger is not a separate level: it is the top 1000 Level 10 players of a region."],
    ],
  },
  bans: {
    heading: "Recent FACEIT bans",
    paras: [
      "A feed of FACEIT CS2 bans spotted among players looked up on Faceit-Lens, with the ban type and when it was detected. Bans come from FACEIT's official data; Faceit-Lens does not decide or judge them.",
      "Check any player's own ban history on their profile, and use the match room analyser to see whether anyone in your lobby has been banned before.",
    ],
    faq: [
      ["Why isn't every FACEIT ban listed?", "FACEIT does not publish a global ban list. This feed only shows bans found on players that someone has searched on Faceit-Lens."],
    ],
  },
  prosettings: {
    heading: "CS2 pro settings, sensitivity and gear",
    paras: [
      "Sensitivity, DPI, eDPI, zoom sensitivity, resolution, aspect ratio and scaling for professional CS2 players, plus their mouse, monitor, keyboard, headset and mousepad. Sort by eDPI to see where your own sensitivity sits compared to the pros.",
      "Most CS2 pros play between 600 and 1200 eDPI. Copying a pro's sensitivity rarely helps on its own; use it as a range to experiment in, then give yourself a few hundred matches before changing again.",
    ],
    faq: [
      ["What is eDPI?", "Mouse DPI multiplied by in-game sensitivity. It lets you compare sensitivity between players who use different DPI settings."],
    ],
  },
};
