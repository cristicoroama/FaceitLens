import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import StatsPlayerLink from "./StatsPlayerLink.jsx";
import { localePath, splitLocale } from "../i18n.js";
import "../styles/stats.css";
import { FaceitLevel, Flag, ChallengerBadge } from "./RankIcons.jsx";
import { COUNTRY_NAMES } from "../country-names.js";
import { Icon } from "../icons.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

// Fallback until the API tells us; keeps the tabs from flashing empty.
const DEFAULT_REGIONS = [
  { key: "EU", label: "Europe" },
  { key: "NA", label: "North America" },
  { key: "SA", label: "South America" },
  { key: "SEA", label: "Southeast Asia" },
  { key: "OCE", label: "Oceania" },
];

// Countries with a CS2 scene worth filtering by, grouped under the region they
// sit in so the picker only ever offers something that region can return.
const COUNTRIES = {
  EU: [
    ["se", "Sweden"], ["dk", "Denmark"], ["fi", "Finland"], ["no", "Norway"],
    ["ru", "Russia"], ["ua", "Ukraine"], ["pl", "Poland"], ["de", "Germany"],
    ["fr", "France"], ["gb", "United Kingdom"], ["es", "Spain"], ["pt", "Portugal"],
    ["it", "Italy"], ["nl", "Netherlands"], ["be", "Belgium"], ["cz", "Czechia"],
    ["sk", "Slovakia"], ["ro", "Romania"], ["bg", "Bulgaria"], ["hu", "Hungary"],
    ["rs", "Serbia"], ["hr", "Croatia"], ["tr", "Turkey"], ["lv", "Latvia"],
    ["lt", "Lithuania"], ["ee", "Estonia"], ["kz", "Kazakhstan"], ["il", "Israel"],
  ],
  NA: [["us", "United States"], ["ca", "Canada"], ["mx", "Mexico"]],
  SA: [
    ["br", "Brazil"], ["ar", "Argentina"], ["cl", "Chile"],
    ["uy", "Uruguay"], ["pe", "Peru"], ["co", "Colombia"],
  ],
  SEA: [
    ["id", "Indonesia"], ["ph", "Philippines"], ["th", "Thailand"],
    ["vn", "Vietnam"], ["sg", "Singapore"], ["my", "Malaysia"],
  ],
  OCE: [["au", "Australia"], ["nz", "New Zealand"]],
};

const PAGE = 100;

export default function Leaderboard({ onPick, initialRegion, initialCountry }) {
  const [regions, setRegions] = useState(DEFAULT_REGIONS);
  const params = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const routeRegion = params.region && params.region.toLowerCase() !== "map" ? params.region : null;
  const region = (routeRegion || initialRegion || "EU").toUpperCase();
  const country = (searchParams.get("country") ?? initialCountry ?? "").toLowerCase();
  const [moreError, setMoreError] = useState("");

  function go(nextRegion, nextCountry) {
    const { locale } = splitLocale(location.pathname);
    const qs = nextCountry ? `?country=${encodeURIComponent(nextCountry)}` : "";
    navigate(`${localePath(locale, `/leaderboard/${nextRegion}`)}${qs}`);
  }
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const fetchPage = useCallback(async (offset) => {
    const qs = new URLSearchParams({
      region, offset: String(offset), limit: String(PAGE),
    });
    if (country) qs.set("country", country);
    const r = await fetch(`${API_BASE}/api/leaderboard/?${qs}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Couldn't load the ranking.");
    return j;
  }, [region, country]);

  // Region or country changed — start over from the top.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setMoreError("");
    setItems([]);
    fetchPage(0)
      .then((j) => {
        if (!alive) return;
        setItems(j.items || []);
        setHasMore(!!j.has_more);
        if (j.regions?.length) setRegions(j.regions);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    setMoreError("");
    try {
      const j = await fetchPage(items.length);
      setItems((prev) => [...prev, ...(j.items || [])]);
      setHasMore(!!j.has_more);
    } catch (e) {
      setMoreError(e.message || "Couldn't load more players.");
    } finally {
      setLoadingMore(false);
    }
  }

  // The hand-kept list above covers the scenes worth offering up front, but the
  // world map can send us anywhere. A country arriving from there gets added so
  // the picker shows what's actually being filtered on.
  const countryList = useMemo(() => {
    const list = COUNTRIES[region] || [];
    if (!country || list.some(([c]) => c === country)) return list;
    const name = COUNTRY_NAMES[country] || country.toUpperCase();
    return [...list, [country, name]].sort((a, b) => a[1].localeCompare(b[1]));
  }, [region, country]);

  const regionLabel = regions.find((r) => r.key === region)?.label || region;
  const countryName = countryList.find(([c]) => c === country)?.[1];

  return (
    <>
      <div className="page-hero">
        <h1 className="page-title">FACEIT CS2 Rankings</h1>
        <p className="page-sub">
          The official ELO ladder, straight from FACEIT. Pick a region, or narrow
          it down to a single country.
        </p>
      </div>

      <nav className="lb-tabs" aria-label="Region">
        {regions.map((r) => (
          <a
            key={r.key}
            href={localePath(splitLocale(location.pathname).locale, `/leaderboard/${r.key}`)}
            className={`lb-tab ${region === r.key ? "on" : ""}`}
            aria-current={region === r.key ? "page" : undefined}
            onClick={(e) => {
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              go(r.key, "");
            }}
          >
            {r.label}
          </a>
        ))}
      </nav>

      <div className="lb-bar">
        <label className="sr-only" htmlFor="lb-country">Country</label>
        <select
          id="lb-country"
          className="fb-select"
          value={country}
          onChange={(e) => go(region, e.target.value)}
        >
          <option value="">All of {regionLabel}</option>
          {countryList.map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
        {!loading && items.length > 0 && (
          <span className="lb-count">
            top {items.length}{countryName ? ` · ${countryName}` : ""}
          </span>
        )}
      </div>

      {loading ? (
        <div className="panel"><div className="skeleton tall" /></div>
      ) : error ? (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-ico">{Icon.exclamationTriangle}</div>
            <h3>{error}</h3>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-ico">{Icon.trophy}</div>
            <h3>Nothing ranked here</h3>
            <p>FACEIT doesn't publish a ranking for that combination.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="panel lb-list">
            {items.map((p) => (
              <StatsPlayerLink
                className="lb-row"
                key={p.player_id || `${p.position}-${p.nickname}`}
                nickname={p.nickname}
                onPick={onPick}
              >
                <span className={`lb-pos ${p.position <= 3 ? "top" : ""}`}>
                  {p.position}
                </span>
                <ChallengerBadge position={p.position} size={22} />
                <FaceitLevel level={p.level} size={28} />
                <span className="lb-name">
                  {p.country && <Flag country={p.country} size={15} />}
                  {p.nickname}
                </span>
                <span className="lb-elo">{p.elo?.toLocaleString() ?? "—"}</span>
              </StatsPlayerLink>
            ))}
          </div>

          {hasMore && (
            <div className="lb-more">
              {moreError && (
                <span className="lb-more-error" role="alert">{moreError}</span>
              )}
              <button type="button" className="btn" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : moreError ? "Retry" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
