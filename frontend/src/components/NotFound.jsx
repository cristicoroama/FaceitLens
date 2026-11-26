import { useEffect, useState } from "react";
import SearchInput from "./SearchInput.jsx";
import { FaceitLevel } from "./RankIcons.jsx";
import { Icon } from "../icons.jsx";
import { DEFAULT_LOCALE, localePath, makeT } from "../i18n.js";
import { getJson, isAbort } from "../api.js";
import { isPlainClick } from "../shell-utils.js";

function SearchBox({ nickname, setNickname, onSearch, onPick, t }) {
  return (
    <div className="nf-search">
      <div className="search">
        <SearchInput
          value={nickname}
          onChange={setNickname}
          onPick={onPick}
          onEnter={onSearch}
          placeholder={t("nf.placeholder")}
          label={t("nf.placeholder")}
        />
        <button onClick={onSearch}>{t("nf.search")}</button>
      </div>
    </div>
  );
}

export default function NotFound({ nickname, setNickname, onSearch, onPick, onNav, lang = DEFAULT_LOCALE }) {
  const t = makeT(lang);
  const go = (page) => (e) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    onNav(page);
  };

  return (
    <div className="nf">
      <div className="nf-code" aria-hidden="true">404</div>
      <h1 className="nf-title">{t("nf.title")}</h1>
      <p className="nf-sub">{t("nf.sub")}</p>

      <SearchBox nickname={nickname} setNickname={setNickname} onSearch={onSearch} onPick={onPick} t={t} />

      <div className="nf-links">
        <a className="nf-link" href={localePath(lang, "/")} onClick={go("single")}>
          {Icon.search}
          <span><b>{t("nf.home")}</b>{t("nf.homeSub")}</span>
        </a>
        <a className="nf-link" href={localePath(lang, "/leaderboard/EU")} onClick={go("leaderboard")}>
          {Icon.trophy}
          <span><b>{t("nf.lb")}</b>{t("nf.lbSub")}</span>
        </a>
        <a className="nf-link" href={localePath(lang, "/prosettings")} onClick={go("prosettings")}>
          {Icon.crosshair}
          <span><b>{t("nf.pro")}</b>{t("nf.proSub")}</span>
        </a>
        <a className="nf-link" href={localePath(lang, "/faq")} onClick={go("faq")}>
          {Icon.patchCheckFill}
          <span><b>{t("nf.faq")}</b>{t("nf.faqSub")}</span>
        </a>
      </div>
    </div>
  );
}

export function PlayerNotFound({ query, message, nickname, setNickname, onSearch, onPick, lang = DEFAULT_LOCALE }) {
  const t = makeT(lang);
  const [similar, setSimilar] = useState(null);

  useEffect(() => {
    const q = (query || "").trim();
    if (q.length < 2) {
      setSimilar([]);
      return undefined;
    }
    const ctrl = new AbortController();
    setSimilar(null);
    getJson(`/api/search/?q=${encodeURIComponent(q.slice(0, 32))}`, { ttl: 30000, signal: ctrl.signal, retry: 0 })
      .then((j) => setSimilar((j.items || []).filter((s) => s.nickname?.toLowerCase() !== q.toLowerCase()).slice(0, 6)))
      .catch((err) => { if (!isAbort(err)) setSimilar([]); });
    return () => ctrl.abort();
  }, [query]);

  return (
    <div className="nf sh-pnf" role="alert">
      <div className="nf-code" aria-hidden="true">404</div>
      <h1 className="nf-title">{t("pnf.title")}</h1>
      <p className="nf-sub">{t("pnf.sub", { name: query })}</p>
      {message && !/not found/i.test(message) && <p className="nf-sub sh-pnf-msg">{message}</p>}

      <SearchBox nickname={nickname} setNickname={setNickname} onSearch={onSearch} onPick={onPick} t={t} />

      {similar && similar.length > 0 && (
        <div className="sh-pnf-sugg">
          <div className="sh-pnf-label">{t("pnf.didYouMean")}</div>
          <div className="sh-pnf-list">
            {similar.map((s) => (
              <button type="button" key={s.nickname} className="sh-pnf-item" onClick={() => onPick(s.nickname)}>
                {s.avatar ? <img src={s.avatar} alt="" /> : <span className="sh-pnf-ph" />}
                <span className="sh-pnf-name">{s.nickname}</span>
                {s.level != null && <FaceitLevel level={s.level} size={20} />}
              </button>
            ))}
          </div>
        </div>
      )}
      {similar && similar.length === 0 && <p className="nf-sub">{t("pnf.none")}</p>}
    </div>
  );
}
