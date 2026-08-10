import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import App from "./App.jsx";
import "./index.css";
import "./effects.js";

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
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/player/:nickname" element={<App />} />
        <Route path="/steam/:steamid" element={<App />} />
        <Route path="/u/:handle" element={<App />} />
        <Route path="/leaderboard/:region" element={<App />} />
        <Route path="/:page" element={<App />} />
      </Routes>
      <Analytics />
      <SpeedInsights />
    </BrowserRouter>
  </React.StrictMode>
);
