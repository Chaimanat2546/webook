# Royal/Azure application palette

On 2026-10-28 the user explicitly requested extending the approved Login/History palette to the other application pages. The shared light theme now uses canvas `#F7F8FC`, surface `#FFFFFF`, subtle/selected `#EEF1F8`, border `#DDE2EC`, primary action `#2F3EE8`, focus `#5B8CFF`, main text `#20283A`, metadata `#647087` and placeholder `#8A99A3`.

Global semantic tokens propagate the palette to dashboards, houses, bookings, advertisements, users, quotations UI, notifications, dialogs, sheets and popovers. The existing Login/History light presentation, font and geometry remain scoped as before. Other page layouts, fonts, radii and House Workspace Shell structures are unchanged.

Hardcoded coastal mobile navigation and notification overrides are replaced by semantic tokens. Booking selection/external-calendar information uses the same primary and neutral roles. Existing error/warning/success/booking-status meaning and original brand/provider assets are preserved. The app/PWA chrome uses the new primary and canvas.

Charts use the data role `#5E6FF2` and derived indigo shades/alpha; `#FFC66F` is retained for the tertiary data series. Plot fills/lines use chart tokens rather than the action token, and chart legends retain matching markers/labels. Standalone `text-primary-text` foregrounds use Royal in light mode and a readable Royal tint `#B8C0FF` in dark mode, independently of Royal filled buttons/white button text. Dark mode uses neutral navy surfaces, Royal actions, Azure focus and readable field borders; it does not retain the former teal palette.

Quotation document/PDF templates, template previews and user-selected quotation theme colors remain document-specific. They are not application chrome and are intentionally excluded from this application recolor. No schema, permissions, API, dependencies or business behavior change.

Validation uses existing input/root-layout/chart/theme tests, TypeScript, ESLint, production build, and browser inspections of representative light/dark shared surfaces and page shells. Staging delivery uses the existing CI/CD pipeline, including SQL and full integration gates. Rendering checks do not establish a formal accessibility audit.

## Implementation verification — 2026-10-28

- Full local Node suite: 1,346 passed, 4 existing opt-in integration skips, 0 failed (1,350 total). The CI integration gate runs those integrations without skips before deployment.
- Production build and its strict TypeScript phase passed; ESLint has no errors and 11 pre-existing warnings outside this change.
- A fresh source reviewer found one material dark-foreground contrast problem. A contrast regression failed before separating the text role and passes with the new dark tint. No other actionable findings were reported; fixes were verified without a second review.
- The built app was exercised using fictional local Auth/data on Dashboard, houses, bookings, users, notifications, quotations and advertisements at 390px; representative states include records/aggregates, empty lists and load failures. The mobile dock, sidebar, dark Dashboard foreground/button roles and 1280px desktop were observed. No horizontal overflow occurred in those checks. This does not establish full functional coverage of every module or a formal accessibility audit.
- Chart legend markers were aligned with their data-series token. Booking error/warning/status colors, original logos and quotation-specific document palettes remain unchanged.
- Screenshots are retained under `C:/Users/chaym/.codex/visualizations/2026/10/28/01a181b8-9524-76e1-adec-aa8b80990172/login-history-ui/palette-*.png`.
