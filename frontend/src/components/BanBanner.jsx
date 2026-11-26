import { Icon } from "../icons.jsx";
import { fmtDay } from "../lib/account-api.js";

export default function BanBanner({ bans }) {
  if (!bans || bans.length === 0) return null;
  const b = bans[0];
  const until = fmtDay(b.ends_at);
  const more = bans.length - 1;
  return (
    <div className="ban-banner" role="note" aria-label="Active FACEIT ban">
      {Icon.exclamationTriangle} Active ban: {b.reason || b.type || "banned"}
      {b.reason && b.type && <> · {b.type}</>}
      {until && <> · until {until}</>}
      {more > 0 && <> · +{more} more</>}
    </div>
  );
}
