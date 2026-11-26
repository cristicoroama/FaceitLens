import { Link, useLocation } from "react-router-dom";
import { localePath, splitLocale } from "../i18n.js";

export function usePlayerHref() {
  const { pathname } = useLocation();
  const { locale } = splitLocale(pathname);
  return (nick) => localePath(locale, `/player/${encodeURIComponent(nick)}`);
}

export default function StatsPlayerLink({ nickname, onPick, className, children, ...rest }) {
  const href = usePlayerHref();
  function onClick(e) {
    e.stopPropagation();
    if (!onPick || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onPick(nickname);
  }
  return (
    <Link to={href(nickname)} className={className} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}
