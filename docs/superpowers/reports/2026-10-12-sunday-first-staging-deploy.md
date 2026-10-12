# Sunday-first booking calendars — Staging

- URL: https://webook-staging.chaymanus2003.workers.dev
- Worker: `webook-staging`
- Version: `5c53fd5e-de5c-4df9-8009-382912c9615d`
- Cloudflare account: `0df55f166fa309dcc904e992c43f86db`
- Supabase: https://sxvkhzhqtrpxgzumsswl.supabase.co

Deployed via `npm run deploy:cf:staging` from the existing ignored isolated build copy. Hash-checked 848 copied source files. Localhost was not stopped; no dependency, database or environment configuration changes and no Production deployment.

Booking gallery headers now start Sunday. The shared 42-day query/grid bounds start Sunday and end at the exclusive following Sunday. House calendars and the booking dialog date picker explicitly set FullCalendar `firstDay` to 0. Booking statuses, actions and checkout-exclusive nights are unchanged.

## Verification

- OpenNext build and deployment exited successfully; compile took approximately 4.1 minutes.
- `npm run verify` in the Staging copy: type check passed, lint 0 errors and 11 existing warnings; 993 tests, 989 passed, 4 skipped, 0 failed.
- Tests cover Sunday/Monday/Saturday-start months, year boundaries, 42 consecutive correctly aligned dates, shared read-only calendar headers, server query bounds and FullCalendar option contracts.
- Compiled bundle: Staging Supabase reference in 13 files, Production in 0 files.
- Login HTTP 200; unauthenticated dashboard HTTP 307 redirect to login.
- Deployed gallery asset containing the Sunday-first headers and FullCalendar asset containing `firstDay:0` returned HTTP 200 and matched build SHA-256. Dashboard and calendar dialog assets also matched.
- Authenticated live calendar interactions were not exercised during deployment.

Existing non-fatal OpenNext Windows/copy and bundled dependency warnings remain. The ignored isolated build copy and protected Staging environment files were retained; no cleanup workaround was attempted.
