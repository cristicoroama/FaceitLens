import { useState, useEffect } from "react";
import TrustScore from "./TrustScore.jsx";
import Medals from "./Medals.jsx";
import Inventory from "./Inventory.jsx";
import { CsrepCredit } from "./CsrepStats.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function AccountView({ nickname }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");

  function load(force) {
    const controller = { alive: true };
    force ? setRetrying(true) : setLoading(true);
    setError("");
    if (!force) setData(null);
    const qs = force ? "?refresh=1" : "";
    fetch(`${API_BASE}/api/player/${encodeURIComponent(nickname)}/collectibles/${qs}`)
      .then((r) => r.json())
      .then((j) => {
        if (!controller.alive) return;
        if (j.error) setError(j.error);
        else setData(j);
      })
      .catch((e) => controller.alive && setError(e.message))
      .finally(() => {
        if (!controller.alive) return;
        setLoading(false);
        setRetrying(false);
      });
    return controller;
  }

  useEffect(() => {
    const c = load(false);
    return () => {
      c.alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nickname]);

  if (loading) return <div className="state">Loading account trust &amp; inventory…</div>;
  if (error) return <div className="state error">{error}</div>;
  if (!data) return null;

  const inv = data.inventory;
  const hasInv = inv && inv.available;

  return (
    <div className="account-layout">
      <div className="account-left">
        <TrustScore trust={data.trust} steamLevel={data.steam_level} />
      </div>
      <div className="account-right">
        {/* A private inventory hides the medals a visitor came to see.
            CSRep reports them regardless, so the backend supplies them as a
            fallback — credited, because at that point they are CSRep's data. */}
        {hasInv && inv.medals && inv.medals.length > 0 ? (
          <Medals medals={inv.medals} />
        ) : data.csrep_medals ? (
          <>
            <Medals medals={data.csrep_medals.medals} />
            <CsrepCredit attribution={data.csrep_medals.attribution}
                         note="Medals via CSRep — this Steam inventory is private." />
          </>
        ) : null}
        <Inventory inventory={inv} onRetry={() => load(true)} retrying={retrying} />
      </div>
    </div>
  );
}
