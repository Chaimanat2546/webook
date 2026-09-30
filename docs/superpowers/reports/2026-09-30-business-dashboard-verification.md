# Business dashboard verification — 2026-09-30

## Implementation

Tasks 1–4 are implemented. The final review findings were addressed inline with regression tests: GET filter preservation, complete detail fields/actions, repair amount, explanatory empty states, same not-found route for foreign/missing details, contextual return and unchanged-filter pagination. No dependencies, schema, accounts or DB rows were added/changed in this implementation.

Existing dirty dependency/chart/demo/type-declaration work was preserved and excluded from the dashboard commits. Generated `public/sw.js` was refreshed through the build command.

## Verification evidence

- Focused dashboard/navigation: 28 passed, 0 failed.
- `npm run build`: exit 0, followed sequentially by `npm run verify`: exit 0; 792 passed, 0 failed, 1 skipped test, 793 total. Six existing local-DB integration suites are gated/skipped without their local test database configuration.
- Typecheck passed; ESLint has no errors. Existing warning: `worker.ts:11`, `import/no-anonymous-default-export`.
- PWA reproducibility initially caught the release revision changing after a service refactor. A fresh build followed by verification passed; build and PWA tests were not run concurrently.
- Code review: fresh-context `dashboard_plan_review` reviewed `3bced94..703f21e`; its important findings were fixed with RED→GREEN regression tests and full verification. No second reviewer was dispatched. Live smoke testing additionally found an agency-detail ID remaining in the source list URL; the added navigation regression failed before the fix and passes afterward.

## Browser checks

Isolated local fixtures use the actual components and service with 120 bookings, 100 houses, long Thai names, large amounts, unknown status and missing price. They are not app routes and never write to Supabase. The overview has three rows per section; complete lists have ten. Light/dark checks at 320, 390, 768, 1024 and 1440 pixels show no horizontal overflow. Agency contributions are grouped by DV; the unit fixture also covers 100 agency buckets.

Live Staging overview was checked at all five widths: nine visible preview links, no horizontal overflow, all three admin information areas. Real values reconcile with read-only repository checks: 192 bookings, 126 confirmed, THB 1,437,222.00 confirmed sales, 11 agency buckets and 29 newly created houses.

Verified live interactions:

- Waiting list page two: 11–20 of 33. Keyboard Enter opens booking detail and Back returns to the same month/status/page, restores the origin row focus and 693px scroll.
- Agency name search, second-page range 11–11 of 11, selected detail and confirmed booking drilldown. Agency A: two bookings of THB 12,000 and THB 8,000, THB 20,000 total, 1.4% of full-month sales. Searching retains agency/confirmed filters.
- Empty filter result and real January 2026 empty month: zero totals and explanatory empty messages, no NaN/Infinity.
- House history: ten of 29 rows; detail shows Bangkok creation timestamp and existing management link. Refresh and Back restore the history row focus (wait for the focus condition, not just initial HTML visibility).
- Local direct-detail entry with no prior history uses a safe source link; page 999 clamps to page 12 of 120 rows, and detail/Back preserve that displayed page and focus. Changing month from detail clears detail selection.
- Owner fixtures omit agency/history sections. Actual page/service tests and local HTTP checks return not-found for foreign details/admin-only views. The browser blocks the local fixture's bare 404 response; this protection was not bypassed.

## Remaining verification limitation

The Staging database has no existing owner identity with a valid DV. Therefore a signed-in real-owner browser smoke test cannot be completed without an account/permission change outside this plan. No account was created or modified. Task 5 remains open only for that live owner-account acceptance check; owner authorization, payload redaction and UI behavior are covered by automated/fixture checks.

## Decisions

- Continue in the user-designated non-main feature checkout to preserve the approved dirty baseline, rather than creating a worktree that omits it. Cost if wrong: baseline changes require manual separation.
- Choose a named agency through the existing bounded sales list/detail and show its active filter with a clear action; do not require UUID input or transmit the whole agency dataset. Cost if wrong: agency selection takes an extra navigation.

Screenshots: `C:/Users/chaym/.codex/visualizations/2026/09/30/01a0f09e-9c52-75e0-9492-0c3243f810ae/dashboard-staging-desktop.png` and `dashboard-staging-mobile.png`.

## Staging release

Only `npm run deploy:cf:staging` was used, exit 0. Verified Supabase target: `https://sxvkhzhqtrpxgzumsswl.supabase.co`; Cloudflare account: `0df55f166fa309dcc904e992c43f86db`. The final compiled bundle contains staging reference and no production reference. Production was not deployed.

Final deployment version: `76563cbf-01cc-408a-a757-430323e67584`.
URL: https://webook-staging.chaymanus2003.workers.dev/admin/dashboard

Post-fix live regression passed: agency page two -> detail -> keyboard Back returns to `view=agencies&agenciesPage=2`, without the selected agency ID, and focuses the original agency row. The final focused suite again passed 28/28. The deployment runner retains an existing Node DEP0190 warning about Windows shell child-process invocation; its fixed arguments and staging targets were unchanged by this task.
