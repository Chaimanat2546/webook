# Website daily/total views — Staging deployment

- Worker: `webook-staging`
- URL: https://webook-staging.chaymanus2003.workers.dev/admin/dashboard
- Version: `3e722210-130d-46f0-a2af-b24eeb3bf151`
- Cloudflare account: `0df55f166fa309dcc904e992c43f86db`
- Supabase: https://sxvkhzhqtrpxgzumsswl.supabase.co
- Command: `npm run deploy:cf:staging` (exit 0).

Deployed the current working-tree source with the daily/total graph switch. Daily view defaults to contact clicks, supports page views/gallery opens and per-site visibility; total view reuses the existing grouped bars. Both views share the selected date range and report. No database, dependency, environment or deployment-script changes were needed.

## Verification

- Staging target configuration and public environment were checked without displaying credentials.
- The Staging command rebuilt Next/OpenNext successfully before deployment.
- Compiled output contains the Staging Supabase reference in 15 files and the Production reference in zero files.
- `/login`: HTTP 200. Unauthenticated `/admin/dashboard`: HTTP 307 to `/login`.
- Deployed `/_next/static/chunks/app/admin/dashboard/page-0d8d845adc41eae2.js`: HTTP 200; SHA-256 matches the local Staging build containing the new graph switch.
- Before deployment: type check and build passed; 1,011 tests passed, four skipped, zero failed. ESLint had zero errors and 11 existing warnings. Independent code review found no actionable issues.
- Local browser checks used synthetic data and covered switching views, preserved metric/site choices, last-visible-site guard, cross-month gaps, single-day dots, total-only data, desktop/mobile layouts, dark mode, and pointer/keyboard tooltips.

Authenticated live analytics rendering remains for the user to test. OpenNext emitted the existing `color-string` copy message and dependency duplicate-key warnings; deployment completed successfully. The runner also emitted its existing Windows DEP0190 warning. Production was not deployed.
