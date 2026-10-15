# Website previous-period comparison — Staging deployment

- Worker: `webook-staging`
- URL: https://webook-staging.chaymanus2003.workers.dev
- Version: `9e21909a-a636-4b15-9500-ea1624dddee0`
- Cloudflare account: `0df55f166fa309dcc904e992c43f86db`
- Supabase: https://sxvkhzhqtrpxgzumsswl.supabase.co
- Command: `npm run deploy:cf:staging`, exit 0.

Deployed the current working-tree source after the user's explicit Staging request. Dashboard comparison displays all website pairs in daily mode and paired totals in total mode. The compact single-website comparison lives on `/admin/dashboard/websites`. No dependency, database or configuration changes; no commits or pushes were made.

## Deployment verification

- Verified the target configuration and public Staging environment without printing credentials. The approved command rebuilt Next/OpenNext using Staging configuration.
- Compiled output contains the Staging Supabase reference in 15 files and the Production reference in zero files.
- `/login` returns HTTP 200; an unauthenticated `/admin/dashboard` returns HTTP 307 to `/login`.
- Deployed dashboard chunk `page-b981ddf7529e4ab6.js` and website-detail chunk `page-9d04c6d45c8ad96b.js` return HTTP 200 and their SHA-256 values match the local Staging build.
- Before deployment, `npm run verify` passed: typecheck, ESLint zero errors / 11 existing warnings, 1,031 tests passed / four skipped / zero failed. The Staging build and upload also passed.

## Authenticated live browser verification

The existing Staging admin session remained valid. Checks used deployed components and actual upstream analytics, without editing application data.

- October 8–14 versus October 1–7: Dashboard rendered ten lines for five websites; hiding Poolvillapattaya reduced the count to eight and restoring it returned both lines. The shared tooltip listed all five websites. Missing prior days were shown as `—`, with a compact incomplete-data disclosure for five websites and no invalid percentage.
- The total view showed all current/prior pairs. Poolvillapattaya was 15,023 / 3,108 views, matching the single-site chart reached through its Dashboard link. The selected date range and comparison flag survived navigation.
- Switching comparison off restored the original website-detail chart, and switching it on restored comparison.
- Applying the real date picker's “เมื่อวานนี้” changed to October 14 versus October 13 while keeping comparison. Detail Poolvillapattaya showed 2,730 / 2,978 views and −8.3%, matching Dashboard daily tooltip and paired totals.

| Website | October 14 views | October 13 views |
| --- | ---: | ---: |
| Baan Party Pattaya | 4,564 | 4,392 |
| Poolvillapattaya | 2,730 | 2,978 |
| baanPMhee | 1,272 | 1,093 |
| Fluk Nasa Poolvilla | 260 | 188 |
| Villa Media Poolvilla | 654 | 883 |

All five daily tooltip pairs matched the corresponding total-mode values. The detail “ดูทั้งหมด” link retained `analyticsCompare=previous`.

At 320×812, both Dashboard modes and the detail metric controls were usable. Document scroll width was 305px (remaining width is the scrollbar). The all-site tooltip occupied x=32..273 and the detail tooltip x=74..228.94 within the viewport. Switching detail to gallery opens showed 628 / 720 and −12.8%, then returned to page views. No browser console errors. The temporary viewport override was reset.

Evidence in the thread visualization directory: `staging-all-sites-daily.png`, `staging-all-sites-mobile320.png`, `staging-website-detail-comparison.png`, `staging-website-detail-mobile320.png`, `staging-overview-detail-qa.json`.

OpenNext retained its existing dependency duplicate-key warnings and Windows DEP0190 warning; deployment completed. Production was not deployed.
