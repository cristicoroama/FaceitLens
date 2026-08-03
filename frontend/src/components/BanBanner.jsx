import { Icon } from "../icons.jsx";

export default function BanBanner({ bans }) {
  if (!bans || bans.length === 0) return null;
  const b = bans[0];
  return (
    <div className="ban-banner">
      {Icon.exclamationTriangle} Active ban: {b.reason || b.type || "banned"}
    </div>
  );
}
