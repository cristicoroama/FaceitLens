export default function BanBanner({ bans }) {
  if (!bans || bans.length === 0) return null;
  const b = bans[0];
  return (
    <div className="ban-banner">
      ⚠ Active ban: {b.reason || b.type || "banned"}
    </div>
  );
}
