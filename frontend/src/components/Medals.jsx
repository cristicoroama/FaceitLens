export default function Medals({ medals }) {
  if (!medals || !medals.length) return null;
  return (
    <>
      <div className="section-title">
        Medals &amp; Coins <span className="section-count">{medals.length}</span>
      </div>
      <div className="medal-grid">
        {medals.map((m, i) => (
          <div className="medal" key={i} title={m.name}>
            {m.image ? (
              <img src={m.image} alt={m.name} loading="lazy" />
            ) : (
              <div className="medal-noimg" />
            )}
            <div className="medal-name">{m.name}</div>
          </div>
        ))}
      </div>
    </>
  );
}
