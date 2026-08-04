import SearchInput from "./SearchInput.jsx";
import { Icon } from "../icons.jsx";

/**
 * 404 page.
 *
 * Before this existed, an unknown path quietly rendered the home page at that
 * URL — the visitor got no signal they'd mistyped, and search engines saw a
 * "soft 404": a 200 response for a page that isn't there. The route now says
 * plainly that nothing lives here and sends people somewhere useful.
 *
 * The response status is still 200 — this is a static SPA, so the server
 * can't know the route is bad. `noindex` (set in App.jsx alongside the title)
 * is what keeps these out of search results instead.
 */
export default function NotFound({ nickname, setNickname, onSearch, onPick, onNav }) {
  const go = (page) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNav(page);
  };

  return (
    <div className="nf">
      <div className="nf-code">404</div>
      <h1 className="nf-title">This page doesn&apos;t exist</h1>
      <p className="nf-sub">
        The link may be out of date, or the address mistyped. If you were after
        a player, search for them here.
      </p>

      <div className="nf-search">
        <div className="search">
          <SearchInput
            value={nickname}
            onChange={setNickname}
            onPick={onPick}
            onEnter={onSearch}
            placeholder="FACEIT nickname, Steam ID or profile link"
          />
          <button onClick={onSearch}>Search</button>
        </div>
      </div>

      <div className="nf-links">
        <a className="nf-link" href="/" onClick={go("single")}>
          {Icon.search}
          <span><b>Home</b>Look up any CS2 player</span>
        </a>
        <a className="nf-link" href="/leaderboard" onClick={go("leaderboard")}>
          {Icon.trophy}
          <span><b>Leaderboard</b>Top players by ELO</span>
        </a>
        <a className="nf-link" href="/prosettings" onClick={go("prosettings")}>
          {Icon.crosshair}
          <span><b>Pro Settings</b>Crosshairs and sensitivity</span>
        </a>
        <a className="nf-link" href="/faq" onClick={go("faq")}>
          {Icon.patchCheckFill}
          <span><b>FAQ</b>How everything works</span>
        </a>
      </div>
    </div>
  );
}
