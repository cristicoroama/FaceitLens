import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import App from "./App.jsx";
import { ALL_LOCALES, DEFAULT_LOCALE } from "./i18n.js";
import "./index.css";
import "./effects.js";

/* Every route exists once per language: /faq, /ru/faq, /pl/faq, /uk/faq.
   Generated rather than written out, because four copies of six routes drift
   the moment someone adds a seventh and updates three of them.

   English stays unprefixed so existing links, shares and whatever ranking the
   site has already earned keep working.

   Route ordering doesn't matter here — React Router v6 ranks by specificity,
   so the static "/ru" always beats the dynamic "/:page" regardless of which
   is declared first. */
const PATHS = [
  "/",
  "/player/:nickname",
  "/steam/:steamid",
  "/u/:handle",
  "/leaderboard/:region",
  "/:page",
];

const routes = ALL_LOCALES.flatMap((locale) =>
  PATHS.map((path) => {
    const full =
      locale === DEFAULT_LOCALE
        ? path
        : `/${locale}${path === "/" ? "" : path}`;
    return <Route key={full} path={full} element={<App lang={locale} />} />;
  }),
);

/* Analytics and Speed Insights sit inside BrowserRouter but outside <Routes>,
   so they mount once and stay mounted. Inside a route they would remount on
   every navigation and lose the page-view they were about to send.
   Both are no-ops in development and on non-Vercel hosts.

   Worth knowing: a good share of this audience runs uBlock or Brave, and both
   block these scripts. The numbers here will read low against reality — treat
   them as a trend, not a headcount. Routing the scripts through this domain is
   what fixes that, if it ever matters enough. */

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>{routes}</Routes>
      <Analytics />
      <SpeedInsights />
    </BrowserRouter>
  </React.StrictMode>
);
