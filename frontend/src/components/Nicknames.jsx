export default function Nicknames({ nicknames }) {
  if (!nicknames || nicknames.length <= 1) {
    return (
      <div className="state">
        No nickname changes recorded yet. FaceitLens starts tracking nicknames
        from the first time a player is searched.
      </div>
    );
  }
  return (
    <>
      <div className="section-title">Known Nicknames ({nicknames.length})</div>
      <div className="mates">
        {nicknames.map((n) => (
          <div className="mate-row" key={n.nickname}>
            <span className="mate-name">{n.nickname}</span>
            <span className="mate-games">
              seen {new Date(n.first_seen).toLocaleDateString("en-GB")}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
