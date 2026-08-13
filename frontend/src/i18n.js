/* Translated titles, descriptions and landing copy.
 *
 * Why these three languages: 74% of the closest competitor's organic traffic
 * comes from Russia, Ukraine and Poland, and the Russian term "фейсит анализ"
 * alone carries ~27k searches a month with nobody ranking well for it. This is
 * the least contested traffic available to this site.
 *
 * Why not the whole UI: Google decides a page's language from its visible
 * content, so a Russian <title> over an English page gets classified English
 * and never ranks for Russian queries. What it does NOT need is every button
 * translated — these communities read English interfaces fine, they just
 * search in their own language. So each locale gets real translated headings
 * and intro copy, and the interface stays English.
 *
 * Register: deliberately the words players actually type. "смурф" not
 * "альтернативный аккаунт", "винрейт" not "процент побед". Searching happens
 * in slang; translating it into textbook prose would miss the query.
 *
 * Codes are ISO 639-1, which is what hreflang requires — Ukrainian is "uk",
 * not "ua" (that's the country code, and Google ignores hreflang tags that
 * use it).
 */

export const DEFAULT_LOCALE = "en";
export const LOCALES = ["ru", "pl", "uk"];
export const ALL_LOCALES = [DEFAULT_LOCALE, ...LOCALES];

export const LOCALE_NAMES = {
  en: "English",
  ru: "Русский",
  pl: "Polski",
  uk: "Українська",
};

/* Prefix for a locale's URLs. English stays at the root so existing links,
   rankings and shares keep working. */
export function localePath(locale, path = "/") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Strip a locale prefix off a path. "/ru/faq" -> { locale: "ru", path: "/faq" } */
export function splitLocale(pathname) {
  const m = String(pathname).match(/^\/(ru|pl|uk)(\/.*)?$/);
  if (!m) return { locale: DEFAULT_LOCALE, path: pathname || "/" };
  return { locale: m[1], path: m[2] || "/" };
}

/* ---------------- Landing copy ---------------- */

export const HERO = {
  en: {
    titleLead: "Scan any",
    titleEm: "CS2 player",
    sub: "ELO, stats and match history for any FACEIT player — plus a trust score that tells you who you're really up against.",
    placeholder: "FACEIT nickname, Steam ID or profile link",
    search: "Search",
    live: "players in CS2 right now",
  },
  ru: {
    titleLead: "Анализ любого",
    titleEm: "игрока CS2",
    sub: "Эло, статистика и история матчей любого игрока FACEIT — плюс оценка аккаунта, которая показывает, кто перед вами на самом деле: смурф, новый аккаунт или честный игрок.",
    placeholder: "Ник FACEIT, Steam ID или ссылка на профиль",
    search: "Найти",
    live: "игроков в CS2 прямо сейчас",
  },
  pl: {
    titleLead: "Sprawdź dowolnego",
    titleEm: "gracza CS2",
    sub: "ELO, statystyki i historia meczów każdego gracza FACEIT — plus ocena konta, która pokazuje, z kim naprawdę grasz: smurf, świeże konto czy uczciwy gracz.",
    placeholder: "Nick FACEIT, Steam ID lub link do profilu",
    search: "Szukaj",
    live: "graczy w CS2 w tej chwili",
  },
  uk: {
    titleLead: "Аналіз будь-якого",
    titleEm: "гравця CS2",
    sub: "Ело, статистика та історія матчів будь-якого гравця FACEIT — плюс оцінка акаунта, яка показує, хто перед вами насправді: смурф, новий акаунт чи чесний гравець.",
    placeholder: "Нік FACEIT, Steam ID або посилання на профіль",
    search: "Пошук",
    live: "гравців у CS2 просто зараз",
  },
};

/* ---------------- Homepage <head> ---------------- */

export const HOME_META = {
  ru: [
    "Фейсит анализ — статистика CS2, Эло и проверка на смурфа",
    "Бесплатный анализ FACEIT для CS2. Смотрите Эло, винрейт, K/D и статистику по картам любого игрока или вставьте ссылку на матчрум, чтобы проверить всех 10 игроков и найти смурфов.",
  ],
  pl: [
    "Analiza FACEIT — statystyki CS2, ELO i wykrywanie smurfów",
    "Darmowa analiza FACEIT dla CS2. Sprawdź ELO, winrate, K/D i statystyki map dowolnego gracza albo wklej link do match roomu, żeby prześwietlić wszystkich 10 graczy i wykryć smurfy.",
  ],
  uk: [
    "Аналіз FACEIT — статистика CS2, Ело та перевірка на смурфа",
    "Безкоштовний аналіз FACEIT для CS2. Дивіться Ело, вінрейт, K/D і статистику по картах будь-якого гравця або вставте посилання на матчрум, щоб перевірити всіх 10 гравців і знайти смурфів.",
  ],
};

/* ---------------- Per-page <head> ---------------- */

export const PAGE_META_I18N = {
  ru: {
    leaderboard: ["Таблица лидеров FACEIT CS2 — топ игроков по Эло",
      "Живой рейтинг FACEIT CS2: игроки с самым высоким Эло, их уровень, винрейт и текущая форма."],
    worldmap: ["Карта мира CS2 — в каких странах лучшие игроки FACEIT",
      "Интерактивная карта пула Challenger в FACEIT CS2: сколько топовых игроков у каждой страны, их средний Эло и кто их возглавляет."],
    watchlist: ["Список наблюдения — следите за игроками FACEIT",
      "Держите под наблюдением любого игрока FACEIT CS2. Отслеживайте изменения Эло, последние матчи и форму всего списка."],
    matchroom: ["Анализ матчрума FACEIT — проверьте своё лобби",
      "Вставьте ссылку на матчрум FACEIT и мгновенно проверьте всех 10 игроков: Эло, уровень, оценку аккаунта на смурфа и текущую форму."],
    compare: ["Сравнение игроков FACEIT — статистика CS2 один на один",
      "Поставьте до 5 игроков FACEIT CS2 рядом: Эло, K/D, HS%, винрейт и статистика по картам."],
    squad: ["Статистика состава — проверьте свою команду CS2",
      "Проверьте всю команду CS2 сразу. Введите ники и получите Эло и статистику каждого игрока на одной странице."],
    competitions: ["Чемпионаты и турниры CS2 на FACEIT",
      "Открытые чемпионаты и турниры CS2: сетки, финальные таблицы и организаторы."],
    teams: ["Команды FACEIT — составы, результаты и статистика по картам",
      "Найдите любую команду FACEIT CS2: состав, винрейт, лучшие карты и статистика каждого игрока."],
    hubs: ["Хабы FACEIT — найдите сообщество CS2",
      "Ищите хабы FACEIT по названию, смотрите, кто там играет, и открывайте статистику любого участника. Найдите активное сообщество CS2 для игры."],
    proguesser: ["ProGuesser — угадай про игрока CS2",
      "Сможете угадать про игрока CS2 по его статистике? Ежедневная игра на угадывание для фанатов Counter-Strike."],
    prosettings: ["Настройки про игроков CS2 — прицел, сенса и конфиг",
      "Коды прицелов, сенса, DPI, разрешение и настройки видео профессиональных игроков CS2."],
    games: ["Мини-игры CS2 — квизы и викторины",
      "Проверьте свои знания Counter-Strike: квизы по экономике, викторины по коллаутам и другие мини-игры CS2."],
    bans: ["Последние баны FACEIT — читеры и смурфы CS2",
      "Живая лента последних банов в FACEIT CS2. Смотрите, кого забанили, когда и за что."],
    faceitstatus: ["Статус FACEIT — работает ли FACEIT прямо сейчас?",
      "Живой статус серверов FACEIT. Проверьте сбои и аварии, прежде чем встать в очередь."],
    steamstatus: ["Статус Steam и CS2 — не лежит ли CS2 прямо сейчас?",
      "Живой статус серверов Steam и Counter-Strike 2, онлайн игроков и текущие сбои."],
    docs: ["Документация API Faceit-Lens",
      "Бесплатное REST API для статистики игроков FACEIT CS2, истории Эло и оценки аккаунтов. Эндпоинты, примеры и лимиты."],
    news: ["Новости статуса CS2 и FACEIT",
      "Последние сбои, аварии и обновления сервисов FACEIT и Counter-Strike 2."],
    whatsnew: ["Что нового — список изменений Faceit-Lens",
      "Последние функции, исправления и улучшения Faceit-Lens."],
    feedback: ["Обратная связь — Faceit-Lens",
      "Сообщите об ошибке, предложите функцию или расскажите, что улучшить в Faceit-Lens."],
    settings: ["Настройки — Faceit-Lens", null],
    faq: ["FAQ — как работает Faceit-Lens",
      "Как считается оценка аккаунта и рейтинги навыка, насколько свежая статистика, какие данные хранятся и почему история Эло — это оценка."],
    privacy: ["Политика конфиденциальности",
      "Что Faceit-Lens хранит, чего не хранит и как удалить свои данные. Без трекинговых куки и рекламных сетей."],
    terms: ["Условия использования",
      "Условия использования Faceit-Lens: честное использование, лимиты API и почему оценки аккаунтов — это предположения, а не обвинения."],
  },

  pl: {
    leaderboard: ["Ranking FACEIT CS2 — najlepsi gracze według ELO",
      "Ranking FACEIT CS2 na żywo: gracze z najwyższym ELO, ich poziom, winrate i aktualna forma."],
    worldmap: ["Mapa świata CS2 — które kraje mają najlepszych graczy FACEIT",
      "Interaktywna mapa puli Challenger w FACEIT CS2: ilu najlepszych graczy ma każdy kraj, ich średnie ELO i kto im przewodzi."],
    watchlist: ["Lista obserwowanych — śledź graczy FACEIT",
      "Miej na oku dowolnego gracza FACEIT CS2. Śledź zmiany ELO, ostatnie mecze i formę całej listy."],
    matchroom: ["Analiza match roomu FACEIT — prześwietl swoje lobby",
      "Wklej link do match roomu FACEIT i natychmiast sprawdź wszystkich 10 graczy: ELO, poziom, ocenę konta pod kątem smurfów i aktualną formę."],
    compare: ["Porównaj graczy FACEIT — statystyki CS2 jeden na jednego",
      "Zestaw do 5 graczy FACEIT CS2 obok siebie: ELO, K/D, HS%, winrate i statystyki map."],
    squad: ["Statystyki składu — sprawdź swoją drużynę CS2",
      "Sprawdź całą drużynę CS2 naraz. Wpisz nicki i zobacz ELO oraz statystyki każdego gracza na jednej stronie."],
    competitions: ["Mistrzostwa i turnieje CS2 na FACEIT",
      "Otwarte mistrzostwa i turnieje CS2: drabinki, końcowe wyniki i organizatorzy."],
    teams: ["Drużyny FACEIT — składy, wyniki i statystyki map",
      "Znajdź dowolną drużynę FACEIT CS2: skład, winrate, najlepsze mapy i statystyki każdego gracza."],
    hubs: ["Huby FACEIT — znajdź społeczność CS2",
      "Szukaj hubów FACEIT po nazwie, zobacz kto tam gra i otwórz statystyki dowolnego członka. Znajdź aktywną społeczność CS2 do gry."],
    proguesser: ["ProGuesser — zgadnij gracza pro CS2",
      "Rozpoznasz zawodowca CS2 po jego statystykach? Codzienna gra w zgadywanie dla fanów Counter-Strike'a."],
    prosettings: ["Ustawienia pro CS2 — celownik, czułość i config",
      "Kody celowników, czułość, DPI, rozdzielczość i ustawienia grafiki zawodowych graczy CS2."],
    games: ["Minigry CS2 — quizy i ciekawostki",
      "Sprawdź swoją wiedzę o Counter-Strike: quizy ekonomiczne, ciekawostki o calloutach i inne minigry CS2."],
    bans: ["Ostatnie bany FACEIT — cheaterzy i smurfy CS2",
      "Lista ostatnich banów w FACEIT CS2 na żywo. Zobacz kogo zbanowano, kiedy i za co."],
    faceitstatus: ["Status FACEIT — czy FACEIT działa w tej chwili?",
      "Status serwerów FACEIT na żywo. Sprawdź awarie i incydenty, zanim wejdziesz do kolejki."],
    steamstatus: ["Status Steam i CS2 — czy CS2 nie działa?",
      "Status serwerów Steam i Counter-Strike 2 na żywo, liczba graczy i aktualne awarie."],
    docs: ["Dokumentacja API Faceit-Lens",
      "Darmowe API REST do statystyk graczy FACEIT CS2, historii ELO i ocen kont. Endpointy, przykłady i limity."],
    news: ["Newsy o statusie CS2 i FACEIT",
      "Najnowsze awarie, incydenty i aktualizacje usług FACEIT oraz Counter-Strike 2."],
    whatsnew: ["Co nowego — lista zmian Faceit-Lens",
      "Najnowsze funkcje, poprawki i ulepszenia Faceit-Lens."],
    feedback: ["Opinie — Faceit-Lens",
      "Zgłoś błąd, zaproponuj funkcję albo powiedz, co poprawić w Faceit-Lens."],
    settings: ["Ustawienia — Faceit-Lens", null],
    faq: ["FAQ — jak działa Faceit-Lens",
      "Jak liczona jest ocena konta i oceny umiejętności, jak świeże są statystyki, jakie dane są przechowywane i dlaczego historia ELO to szacunek."],
    privacy: ["Polityka prywatności",
      "Co Faceit-Lens przechowuje, czego nie, i jak usunąć swoje dane. Bez ciasteczek śledzących i sieci reklamowych."],
    terms: ["Regulamin",
      "Zasady korzystania z Faceit-Lens: uczciwe użycie, limity API i dlaczego oceny kont to szacunki, a nie oskarżenia."],
  },

  uk: {
    leaderboard: ["Таблиця лідерів FACEIT CS2 — топ гравців за Ело",
      "Живий рейтинг FACEIT CS2: гравці з найвищим Ело, їхній рівень, вінрейт і поточна форма."],
    worldmap: ["Карта світу CS2 — у яких країнах найкращі гравці FACEIT",
      "Інтерактивна карта пулу Challenger у FACEIT CS2: скільки топових гравців має кожна країна, їхнє середнє Ело і хто їх очолює."],
    watchlist: ["Список спостереження — стежте за гравцями FACEIT",
      "Тримайте під наглядом будь-якого гравця FACEIT CS2. Відстежуйте зміни Ело, останні матчі та форму всього списку."],
    matchroom: ["Аналіз матчруму FACEIT — перевірте своє лобі",
      "Вставте посилання на матчрум FACEIT і миттєво перевірте всіх 10 гравців: Ело, рівень, оцінку акаунта на смурфа та поточну форму."],
    compare: ["Порівняння гравців FACEIT — статистика CS2 один на один",
      "Поставте до 5 гравців FACEIT CS2 поруч: Ело, K/D, HS%, вінрейт і статистика по картах."],
    squad: ["Статистика складу — перевірте свою команду CS2",
      "Перевірте всю команду CS2 одразу. Введіть ніки й отримайте Ело та статистику кожного гравця на одній сторінці."],
    competitions: ["Чемпіонати та турніри CS2 на FACEIT",
      "Відкриті чемпіонати й турніри CS2: сітки, фінальні таблиці та організатори."],
    teams: ["Команди FACEIT — склади, результати та статистика по картах",
      "Знайдіть будь-яку команду FACEIT CS2: склад, вінрейт, найкращі карти та статистику кожного гравця."],
    hubs: ["Хаби FACEIT — знайдіть спільноту CS2",
      "Шукайте хаби FACEIT за назвою, дивіться, хто там грає, і відкривайте статистику будь-якого учасника. Знайдіть активну спільноту CS2 для гри."],
    proguesser: ["ProGuesser — вгадай про гравця CS2",
      "Впізнаєте професіонала CS2 за його статистикою? Щоденна гра на вгадування для фанатів Counter-Strike."],
    prosettings: ["Налаштування про гравців CS2 — приціл, сенса та конфіг",
      "Коди прицілів, сенса, DPI, роздільна здатність і налаштування відео професійних гравців CS2."],
    games: ["Міні-ігри CS2 — квізи та вікторини",
      "Перевірте свої знання Counter-Strike: квізи з економіки, вікторини про коллаути та інші міні-ігри CS2."],
    bans: ["Останні бани FACEIT — чітери та смурфи CS2",
      "Жива стрічка останніх банів у FACEIT CS2. Дивіться, кого забанили, коли і за що."],
    faceitstatus: ["Статус FACEIT — чи працює FACEIT просто зараз?",
      "Живий статус серверів FACEIT. Перевірте збої та аварії, перш ніж ставати в чергу."],
    steamstatus: ["Статус Steam і CS2 — чи не лежить CS2 зараз?",
      "Живий статус серверів Steam і Counter-Strike 2, онлайн гравців і поточні збої."],
    docs: ["Документація API Faceit-Lens",
      "Безкоштовне REST API для статистики гравців FACEIT CS2, історії Ело та оцінок акаунтів. Ендпоінти, приклади та ліміти."],
    news: ["Новини статусу CS2 і FACEIT",
      "Останні збої, аварії та оновлення сервісів FACEIT і Counter-Strike 2."],
    whatsnew: ["Що нового — список змін Faceit-Lens",
      "Останні функції, виправлення та покращення Faceit-Lens."],
    feedback: ["Зворотний зв'язок — Faceit-Lens",
      "Повідомте про помилку, запропонуйте функцію або розкажіть, що покращити у Faceit-Lens."],
    settings: ["Налаштування — Faceit-Lens", null],
    faq: ["FAQ — як працює Faceit-Lens",
      "Як рахується оцінка акаунта та рейтинги навички, наскільки свіжа статистика, які дані зберігаються і чому історія Ело — це оцінка."],
    privacy: ["Політика конфіденційності",
      "Що Faceit-Lens зберігає, чого не зберігає і як видалити свої дані. Без трекінгових куки та рекламних мереж."],
    terms: ["Умови використання",
      "Умови використання Faceit-Lens: чесне використання, ліміти API і чому оцінки акаунтів — це припущення, а не звинувачення."],
  },
};

/* A short paragraph that gets prerendered into the page body. It exists so the
   visible content is in the same language as the <title> — without it Google
   reads an English page and files the translation under English, which is the
   whole reason the translation would have been worthless. */
export const PAGE_INTRO = {
  ru: (title, desc) => ({ heading: title, body: desc }),
  pl: (title, desc) => ({ heading: title, body: desc }),
  uk: (title, desc) => ({ heading: title, body: desc }),
};

/* Player pages are generated per request by api/render.js, so their copy is a
   template rather than a fixed string. `stats` is already-formatted text like
   "62% винрейт, 1.34 K/D" or empty when the backend didn't answer in time. */
export const PLAYER_META = {
  en: (name, stats) => [
    `${name} — FACEIT CS2 Stats, ELO & Trust Score`,
    stats
      ? `FACEIT CS2 stats for ${name}: ${stats}, map performance and an account trust score.`
      : `FACEIT CS2 stats for ${name}: ELO, win rate, K/D, map performance, match history and an account trust score to spot smurfing.`,
  ],
  ru: (name, stats) => [
    `${name} — статистика FACEIT CS2, Эло и оценка аккаунта`,
    stats
      ? `Статистика FACEIT CS2 игрока ${name}: ${stats}, статистика по картам и оценка аккаунта.`
      : `Статистика FACEIT CS2 игрока ${name}: Эло, винрейт, K/D, статистика по картам, история матчей и оценка аккаунта на смурфа.`,
  ],
  pl: (name, stats) => [
    `${name} — statystyki FACEIT CS2, ELO i ocena konta`,
    stats
      ? `Statystyki FACEIT CS2 gracza ${name}: ${stats}, statystyki map i ocena konta.`
      : `Statystyki FACEIT CS2 gracza ${name}: ELO, winrate, K/D, statystyki map, historia meczów i ocena konta pod kątem smurfów.`,
  ],
  uk: (name, stats) => [
    `${name} — статистика FACEIT CS2, Ело та оцінка акаунта`,
    stats
      ? `Статистика FACEIT CS2 гравця ${name}: ${stats}, статистика по картах та оцінка акаунта.`
      : `Статистика FACEIT CS2 гравця ${name}: Ело, вінрейт, K/D, статистика по картах, історія матчів і оцінка акаунта на смурфа.`,
  ],
};

/* Labels for the numbers in a player description, so "62% win rate" reads as
   "62% винрейт" rather than staying English inside a Russian sentence. */
export const STAT_LABELS = {
  en: { wr: (v) => `${v}% win rate`, kd: (v) => `${v} K/D`, hs: (v) => `${v}% HS`, m: (v) => `${v} matches` },
  ru: { wr: (v) => `${v}% винрейт`, kd: (v) => `${v} K/D`, hs: (v) => `${v}% HS`, m: (v) => `${v} матчей` },
  pl: { wr: (v) => `${v}% winrate`, kd: (v) => `${v} K/D`, hs: (v) => `${v}% HS`, m: (v) => `${v} meczów` },
  uk: { wr: (v) => `${v}% вінрейт`, kd: (v) => `${v} K/D`, hs: (v) => `${v}% HS`, m: (v) => `${v} матчів` },
};

/**
 * Title and description for a page in a locale, falling back to English so a
 * missing translation degrades to a working page rather than an empty one.
 */
export function metaFor(locale, page, englishMeta, englishDefault) {
  if (locale === DEFAULT_LOCALE) return englishMeta || englishDefault;

  if (!page) {
    const home = HOME_META[locale];
    return home || englishDefault;
  }

  const t = PAGE_META_I18N[locale]?.[page];
  if (!t) return englishMeta || englishDefault;

  // A null description means "same as the homepage's" — only /settings uses it,
  // and it is never prerendered anyway.
  return [t[0], t[1] || (HOME_META[locale]?.[1] ?? englishDefault[1])];
}
