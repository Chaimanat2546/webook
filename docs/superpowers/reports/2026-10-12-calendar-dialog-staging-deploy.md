# Latest admin UI — Staging deployment

- Worker: `webook-staging`
- URL: https://webook-staging.chaymanus2003.workers.dev
- Version: `c1cf4e96-4f22-40bd-8ff2-1815ddae1378`
- Cloudflare account: `0df55f166fa309dcc904e992c43f86db`
- Supabase: https://sxvkhzhqtrpxgzumsswl.supabase.co

Deployed with `npm run deploy:cf:staging` from the existing ignored isolated build directory, preserving localhost. Copied and hash-checked 845 tracked/non-ignored source files; no dependency upgrades or Production deployment.

## Included changes

- Calendar disconnect uses the shared system dialog, Thai copy without a question mark, explicit confirmation, pending/error handling, and restored trigger focus.
- Booking cards reserve one short truncated status line, including when a house has many external calendar sources.
- Softer field borders and distinct input backgrounds.
- Website comparison tooltip follows the selected bars; future-month statistics use the shared empty state.

## Verification

- OpenNext build and deployment exited successfully; TypeScript passed.
- `npm run verify` in the Staging build copy: type check passed, lint 0 errors and 11 existing warnings; 987 tests, 983 passed, 4 skipped, 0 failed.
- Compiled bundle contains Staging Supabase references in 13 files and Production references in 0 files.
- `/login`: HTTP 200. Unauthenticated `/admin/dashboard`: HTTP 307 redirect to login.
- Deployed dashboard comparison, calendar disconnect dialog, and booking one-line status JavaScript assets return HTTP 200 and match the build SHA-256 exactly.
- Authenticated Staging interactions were not exercised during deployment. Local browser interaction checks were completed before deployment.

OpenNext Windows compatibility/copy warnings and bundled dependency duplicate-key warnings remain non-fatal. The isolated build directory and protected Staging environment files remain ignored and uncommitted; previous cleanup was rejected, so no deletion workaround was attempted.
