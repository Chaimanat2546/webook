# Website totals comparison — Staging deployment

- Worker: `webook-staging`
- URL: https://webook-staging.chaymanus2003.workers.dev
- Version: `8c3405ac-fe7c-4d26-8fef-0c2816c6f0df`
- Cloudflare account: `0df55f166fa309dcc904e992c43f86db`
- Supabase: https://sxvkhzhqtrpxgzumsswl.supabase.co

Deployed the latest working-tree source using `npm run deploy:cf:staging` from an isolated temporary build directory, avoiding the localhost checkout's previous OpenNext file locks. Hash comparison confirmed 366 application/configuration files matched the current checkout. Dependencies were installed from the existing lockfile without upgrades; only Staging environment files were copied.

## Verification

- OpenNext/Next build and deployment exited successfully.
- `npm run verify`: type check passed, lint had 0 errors and 11 existing warnings; 980 tests, 976 passed, 4 skipped, 0 failed.
- Production dependency audit: 0 vulnerabilities. Install reported 8 high-severity development dependency advisories; no automatic fixes were applied.
- Compiled bundle: Staging Supabase reference in 13 files, Production reference in 0 files.
- `/login`: HTTP 200. `/admin/dashboard`: HTTP 307 redirect to login for an unauthenticated request.
- Latest dashboard JavaScript asset: HTTP 200 and SHA-256 exactly matches the locally built asset containing the website totals comparison.

The main overview uses three adjacent vertical bars per website (views, contacts and gallery opens), drawn from the selected-month totals used by the table. No period or metric switches appear in this graph; website-detail period controls remain unchanged.

Authenticated live data/graph rendering was not tested during deployment. Local browser verification with explicitly synthetic data was completed before deployment. The adapter still reports a non-fatal `color-string` copy warning and dependency duplicate-key warnings; PDF generation was not exercised in this task. Production was not deployed.

Temporary build files remain under the ignored `.superpowers/staging-comparison-build` directory because the execution policy rejected cleanup commands, including removal of copied environment files. These files were not committed or exposed in deployment logs; original source/environment files remain unchanged.
