// ============================================================
//  FaceitLens — System status & incident log
//
//  HOW TO POST AN UPDATE
//  ---------------------
//  Newest incident goes at the TOP of INCIDENTS. Inside an incident,
//  newest update goes at the TOP of its `updates` array.
//
//  When something breaks:
//    1. Add a new incident with status "investigating" and active impact.
//       -> the header indicator turns amber and BLINKS automatically.
//    2. As it develops, prepend updates ("identified" / "monitoring").
//    3. When it's back to normal, prepend a "resolved" update, set the
//       incident `status` to "resolved" and fill `resolved`.
//       -> header goes back to the calm green "operational" state.
//
//  Also flip SYSTEM_STATUS.state to reflect the live picture.
//
//  Timestamps are ISO 8601 WITH an offset (…-05:00) so date AND time
//  render correctly in every timezone.
// ============================================================

// Overall banner shown at the top of the status page.
export const SYSTEM_STATUS = {
  state: "operational", // "operational" | "degraded" | "outage" | "maintenance"
  text: "All systems operational",
  updated: "2026-07-24T06:31:00-05:00",
};

export const INCIDENTS = [
  {
    id: "2026-07-24-faceit-api-timeouts",
    component: "FACEIT Data API",
    endpoint: "open.faceit.com",
    impact: "minor", // "minor" | "major" | "critical" | "maintenance"
    status: "resolved", // "investigating" | "identified" | "monitoring" | "resolved"
    title: "Intermittent connection timeouts on the FACEIT Data API",
    started: "2026-07-24T06:10:00-05:00",
    resolved: "2026-07-24T06:31:00-05:00",
    updates: [
      {
        at: "2026-07-24T06:31:00-05:00",
        status: "resolved",
        text:
          "Upstream connectivity to open.faceit.com has fully recovered. Player " +
          "lookups, roast and AI analysis are operating normally, error rate is " +
          "back to baseline and no further timeouts are being observed. Marking " +
          "this incident as resolved. No FaceitLens data was affected.",
      },
      {
        at: "2026-07-24T06:22:00-05:00",
        status: "monitoring",
        text:
          "The FACEIT Data API is responding again and requests are succeeding. " +
          "Monitoring latency and error rates to confirm a stable recovery before " +
          "closing the incident.",
      },
      {
        at: "2026-07-24T06:10:00-05:00",
        status: "investigating",
        text:
          "Backend requests to the FACEIT Data API (open.faceit.com:443) are " +
          "failing with ConnectTimeout (connect timeout = 10s). Affected routes: " +
          "/api/player, /api/roast, /api/analyze — returning HTTP 500 while the " +
          "upstream is unreachable. This is an upstream FACEIT connectivity issue, " +
          "not a FaceitLens deploy or configuration change. Investigating.",
      },
    ],
  },
];

// True while any incident is not yet resolved — drives the blinking header alert.
export function hasActiveIncident() {
  return INCIDENTS.some((i) => i.status !== "resolved");
}
