# Website daily trend — Staging deployment

- Worker: `webook-staging`
- URL: https://webook-staging.chaymanus2003.workers.dev
- Cloudflare account: `0df55f166fa309dcc904e992c43f86db`
- Supabase: https://sxvkhzhqtrpxgzumsswl.supabase.co
- Version: `81e32f0b-35d9-49b7-80b8-3c1be9fbfcb6`
- Command: `npm run deploy:cf:staging`

The primary checkout's `.open-next` output was locked on Windows. Deployment used an isolated managed worktree at the same base commit with current changes copied; application source hashes matched the primary checkout. Dependencies were installed with `npm ci`, without upgrades.

Deployment exited successfully. The compiled bundle contained 13 files referencing Staging Supabase and zero referencing Production Supabase. `/login` returned HTTP 200; unauthenticated `/admin/dashboard` redirected to `/login` (307). The deployed dashboard JavaScript returned HTTP 200 and its SHA-256 matched the new local build containing the daily trend component.

`npm run verify` passed in the deployment worktree: TypeScript passed; ESLint had zero errors (11 existing warnings); 972 tests passed, four skipped, zero failed.

Authenticated live chart data was not verified. Earlier local UI checks used clearly labeled synthetic data. OpenNext reported a `color-string` package copy warning, but bundling and deployment completed; PDF behavior was outside this verification scope.
