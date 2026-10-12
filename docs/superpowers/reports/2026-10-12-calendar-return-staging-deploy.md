# External calendar return navigation — Staging

- URL: https://webook-staging.chaymanus2003.workers.dev
- Worker: `webook-staging`
- Version: `dd4f83e4-2e22-4de3-bf7a-7075f46eaaa0`
- Cloudflare account: `0df55f166fa309dcc904e992c43f86db`
- Supabase: https://sxvkhzhqtrpxgzumsswl.supabase.co

Deployed using `npm run deploy:cf:staging` from the existing ignored isolated build directory. Hash-checked 846 copied source files. Localhost was not stopped, dependencies were not upgraded, and Production was not deployed.

The booking gallery external-calendar link now passes an allowlisted `returnTo` with search text, search mode and page. The calendar workspace uses the existing header with “กลับไปการจอง” for this destination; house-list entry keeps the original behavior. The booking route restores validated page values. Database, calendar sync and workspace layout remain unchanged.

## Verification

- OpenNext build and deployment exited successfully.
- `npm run verify` in the Staging copy: type check passed, lint 0 errors with 11 existing warnings; 990 tests, 986 passed, 4 skipped, 0 failed.
- Compiled bundle: 13 files contain the Staging Supabase reference, 0 contain Production.
- Login HTTP 200; unauthenticated dashboard HTTP 307 to login.
- Deployed booking JavaScript containing `returnTo` and `initialPage`, calendar dialog JavaScript, and dashboard JavaScript all returned HTTP 200 and matched local build SHA-256.
- Server bundle contains the booking-return label (Unicode-escaped in the generated bundle).
- Regression tests cover the settings link, allowlisted/rejected return destinations, restored search/page values and header destination label. Authenticated live navigation was not exercised during deployment.

Existing non-fatal OpenNext Windows/copy and bundled dependency warnings remain. The ignored build copy and protected Staging environment files were retained; no cleanup workaround was attempted.
