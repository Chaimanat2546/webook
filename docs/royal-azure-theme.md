# Application palette

The latest user-selected palette supersedes the earlier Royal/Azure application colors. The shared light theme uses neutral grey canvas `#F3F5F7`, white cards/popovers/fields `#FFFFFF`, primary actions and focus `#07557A`, medium grey borders `#CBD2D9`, subtle/selected surfaces `#E9EEF2`, main text `#20283A`, metadata `#647087` and placeholder `#8A99A3`. The border, subtle surface and dark text tint are implementation choices to match the selected colors.

Global semantic tokens propagate these colors to dashboards, houses, bookings, advertisements, users, quotations UI, notifications, dialogs, sheets and popovers, including Login/History. Existing layouts, fonts, radii and House Workspace Shell structures remain unchanged. App/PWA chrome uses the selected primary and canvas.

Standalone `text-primary-text` foregrounds use `#07557A` in light mode and a readable tint `#94C9DF` in dark mode, independently of filled buttons with white text. Existing dark surfaces remain; dark primary actions use the selected `#07557A`, with focus rings using the readable `#94C9DF` tint.

Error red, warning/success/booking-status colors, original brand/provider assets, and the existing chart-series colors remain unchanged. Quotation document/PDF templates, template previews and user-selected quotation theme colors remain document-specific. No schema, permissions, API, dependencies or business behavior change.

This revision is proposed directly to `main` by pull request at the user's request. Creating that PR does not deploy it; deployment remains subject to the repository's environment rules. Validation covers the existing root-layout/input/PWA tests, strict TypeScript and build; previous deployed-palette validation is recorded below as historical evidence only.

## Neutral grey / teal revision verification — 2026-10-28

- Existing root-layout, input-surface and PWA build tests: 9 passed, 0 failed. The generated service worker was refreshed by `build:pwa` to match the new source revision.
- Before the main pull request, the full local Node suite passed: 1,346 passed, 4 existing opt-in integration skips, 0 failed (1,350 total). A fresh read-only palette reviewer reported no actionable findings.
- Strict TypeScript and targeted ESLint passed. Source review and CSS parsing confirmed the light tokens in both global and Login/History scopes, and confirmed that destructive/error tokens match the previous revision exactly.
- Production build passed, including TypeScript and prerendering all 11 static pages. The local build uses fictional localhost Supabase configuration and a 2 GiB Node heap cap for this machine; no real backend credentials or deployment are involved.

## Previous Royal/Azure implementation verification — 2026-10-28

- Full local Node suite: 1,346 passed, 4 existing opt-in integration skips, 0 failed (1,350 total). The CI integration gate runs those integrations without skips before deployment.
- Production build and its strict TypeScript phase passed; ESLint has no errors and 11 pre-existing warnings outside this change.
- A fresh source reviewer found one material dark-foreground contrast problem. A contrast regression failed before separating the text role and passes with the new dark tint. No other actionable findings were reported; fixes were verified without a second review.
- The built app was exercised using fictional local Auth/data on Dashboard, houses, bookings, users, notifications, quotations and advertisements at 390px; representative states include records/aggregates, empty lists and load failures. The mobile dock, sidebar, dark Dashboard foreground/button roles and 1280px desktop were observed. No horizontal overflow occurred in those checks. This does not establish full functional coverage of every module or a formal accessibility audit.
- Chart legend markers were aligned with their data-series token. Booking error/warning/status colors, original logos and quotation-specific document palettes remain unchanged.
- Screenshots are retained under `C:/Users/chaym/.codex/visualizations/2026/10/28/01a181b8-9524-76e1-adec-aa8b80990172/login-history-ui/palette-*.png`.
