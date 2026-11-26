export const LEADERBOARD_REGIONS = ["EU", "NA", "SA", "SEA", "OCE"];

const REGION_NAMES = {
  en: { EU: "Europe", NA: "North America", SA: "South America", SEA: "Southeast Asia", OCE: "Oceania" },
  ru: { EU: "Европа", NA: "Северная Америка", SA: "Южная Америка", SEA: "Юго-Восточная Азия", OCE: "Океания" },
  pl: { EU: "Europa", NA: "Ameryka Północna", SA: "Ameryka Południowa", SEA: "Azja Południowo-Wschodnia", OCE: "Oceania" },
  uk: { EU: "Європа", NA: "Північна Америка", SA: "Південна Америка", SEA: "Південно-Східна Азія", OCE: "Океанія" },
};

const TEMPLATES = {
  en: (r, code) => [
    `FACEIT CS2 Leaderboard ${code} — Top ${r} Players by ELO`,
    `Live FACEIT CS2 leaderboard for ${r}: the highest ELO players in the ${code} region ranked, with level, win rate and recent form.`,
  ],
  ru: (r, code) => [
    `Таблица лидеров FACEIT CS2 ${code} — лучшие игроки (${r}) по Эло`,
    `Живой рейтинг FACEIT CS2 для региона ${r}: игроки ${code} с самым высоким Эло, их уровень, винрейт и текущая форма.`,
  ],
  pl: (r, code) => [
    `Ranking FACEIT CS2 ${code} — najlepsi gracze (${r}) według ELO`,
    `Ranking FACEIT CS2 na żywo dla regionu ${r}: gracze ${code} z najwyższym ELO, ich poziom, winrate i aktualna forma.`,
  ],
  uk: (r, code) => [
    `Таблиця лідерів FACEIT CS2 ${code} — найкращі гравці (${r}) за Ело`,
    `Живий рейтинг FACEIT CS2 для регіону ${r}: гравці ${code} з найвищим Ело, їхній рівень, вінрейт і поточна форма.`,
  ],
};

export function leaderboardRegionMeta(locale, region) {
  const code = String(region || "").toUpperCase();
  if (!LEADERBOARD_REGIONS.includes(code)) return null;
  const names = REGION_NAMES[locale] || REGION_NAMES.en;
  const template = TEMPLATES[locale] || TEMPLATES.en;
  return template(names[code], code);
}
