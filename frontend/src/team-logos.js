const CODES = {
  "3dmax": "3dm", "amkal": "amka", "apeks": "apex", "astralis": "astr", "aurora": "aura", "avangar": "avg",
  "b8": "b8", "bb": "bb", "betboom": "bbt", "bestia": "bes", "big": "big", "bne": "bne", "bravado": "bravg",
  "cloud9": "c9", "c9": "c9", "chinggis warriors": "chin", "counter logic gaming": "clg", "complexity": "col",
  "copenhagen flames": "cope", "copenhagen wolves": "cw", "dendele": "dend", "dignitas": "dig", "dreameaters": "drea",
  "ecstatic": "ecst", "ence": "ence", "endpoint": "ent", "epsilon": "eps", "eternal fire": "eter", "evil geniuses": "evl",
  "falcons": "fal", "team falcons": "fal", "faze": "faze", "faze clan": "faze", "flipsid3": "flip", "fluxo": "flux",
  "fnatic": "fntc", "forze": "forz", "flyquest": "fq", "furia": "furi", "fut": "fut", "fut esports": "fut",
  "g2": "g2", "g2 esports": "g2", "gamerlegion": "gl", "gambit": "gamb", "godsent": "god", "gosh": "gosh",
  "bc.game": "gosh", "grayhound": "gray", "heroic": "hero", "hellraisers": "hlr", "the huns": "huns",
  "imperial": "imp", "imperial esports": "imp", "immortals": "imt", "into the breach": "itb", "kinguin": "king",
  "koi": "koi", "lynn vision": "lynn", "lynn vision gaming": "lynn", "ldlc": "ldlc", "legacy": "lgcy",
  "liquid": "liq", "team liquid": "liq", "luminosity": "lumi", "m80": "m80", "metizport": "meti", "mibr": "mibr",
  "the mongolz": "mngz", "mongolz": "mngz", "mouz": "mouz", "mousesports": "mouz", "natus vincere": "navi",
  "navi": "navi", "nemiga": "nemi", "9z": "nine", "9z team": "nine", "ninjas in pyjamas": "nip", "nip": "nip",
  "north": "nor", "nrg": "nrg", "envy": "nv", "envyus": "nv", "og": "og", "the one": "one", "1win": "one",
  "optic": "optc", "optic gaming": "optc", "orbit": "orbit", "outsiders": "out", "pain": "pain", "pain gaming": "pain",
  "passion ua": "psnu", "parivision": "pari", "pvision": "pari", "penta": "penta", "rare atom": "ratm",
  "red canids": "redc", "renegades": "ren", "rogue": "rog", "movistar riders": "ride", "saw": "saw",
  "sharks": "shrk", "sinners": "sinn", "sk": "sk", "sk gaming": "sk", "space soldiers": "spc", "team spirit": "spir",
  "spirit": "spir", "splyce": "splc", "sprout": "spr", "syman": "syma", "thunderpick": "thun",
  "thunderpick world championship": "thun", "100 thieves": "thv", "titan": "tit", "tsm": "tsm", "tyloo": "tyl",
  "vitality": "vita", "team vitality": "vita", "virtus.pro": "vp", "virtus pro": "vp", "vici": "vici",
  "vici gaming": "vici", "vega squadron": "vega", "vexed": "vex", "wildcard": "wcrd", "wildcard gaming": "wcrd",
  "winstrike": "wins", "xapso": "xapso",
};

export function teamLogo(team) {
  if (team?.logo) return team.logo;
  const key = (team?.name || "").trim().toLowerCase();
  const code = CODES[key] || CODES[key.replace(/\s+(esports|gaming|team|clan)$/, "")];
  return code ? `/teams/${code}.svg` : null;
}
