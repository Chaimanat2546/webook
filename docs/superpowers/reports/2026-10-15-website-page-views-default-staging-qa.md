# Website graph page-view default and live Staging QA

- Worker: `webook-staging`
- URL: https://webook-staging.chaymanus2003.workers.dev/admin/dashboard
- Version: `0a37db1e-826e-4836-b266-14be0b8b7ce7`
- Cloudflare account: `0df55f166fa309dcc904e992c43f86db`
- Supabase: https://sxvkhzhqtrpxgzumsswl.supabase.co
- Deployment: `npm run deploy:cf:staging`, exit 0.

## Change and checks

Daily graphs now initially select page views (เข้าชม). The existing range-key reset also resets the metric to page views after changing dates. The selected metric still survives switching between daily and total views. Updated the rendering regression assertion and analytics documentation. The assertion failed with contact clicks selected before the one-line default change, then passed.

`npm run verify` passed: TypeScript passed; ESLint had zero errors and 11 existing warnings; 1,011 tests passed, four skipped, zero failed. Staging's Next/OpenNext build and deployment succeeded. Compiled output contains 15 files with the Staging Supabase reference and zero with the Production reference. The deployed dashboard chunk `page-e58e1786111a4d0f.js` returned HTTP 200 and its SHA-256 matched the local Staging build.

## Authenticated live data comparison

Verified in an existing admin browser session against actual Staging website analytics, after reloading the new deployment. Dates were changed using the website card's preset/calendar controls and Apply action, without modifying application data.

For each range below, collected the rendered daily tooltip values for page views, contact clicks, and gallery opens. Their per-website sums match the summary table. Independently read the total bar chart tooltip for each website and matched all three metrics to the same table. All five websites matched in all three ranges (45 metric/site comparisons for daily sums and 45 for bar totals).

| Range (Bangkok, inclusive) | Purpose | Baan Party page views | Result |
| --- | --- | ---: | --- |
| 2026-10-04 to 2026-10-10 | Completed week | 10,039 | All websites and metrics match |
| 2026-10-14 to 2026-10-14 | Single day | 4,564 | All websites and metrics match |
| 2026-09-29 to 2026-10-10 | Cross-month range | 10,039 | All websites and metrics match |

The cross-month daily graph has no visible data for September 29 through October 5. These dates remain gaps; they do not introduce false zero points or change the available-data totals. The partial-coverage warning remains visible. Changing a range resets to daily page views; switching views does not change table totals.

## Mobile browser verification

Tested responsive viewports at 375×812 and 320×812 using the live Staging page (browser viewport emulation, not a physical handset):

- Both view buttons and metric controls remain usable.
- Daily tooltip interaction shows the correct date, full site names, and values; single-day points also match all five sites' table totals.
- Website legend buttons hide and restore a line.
- Total graph scrolls horizontally inside its own region through the fifth website, with its full-name tooltip and correct values. At 320px, Villa Media's October 14 tooltip shows 654 views, 7 contacts, and 219 gallery opens.
- Mobile summary cards match all five sites' totals.
- Changed the range to yesterday through the mobile picker and Apply; daily page views became selected and both views received October 14's values.
- No horizontal document overflow at either width; no console errors or warnings observed during these checks. Temporary viewport override was reset.

Evidence is stored under the task visualization directory `C:/Users/chaym/.codex/visualizations/2026/10/15/01a13dcd-f5b0-79b0-9919-281907b5a9ca/`: `staging-views-default-live-comparisons.json`, `staging-views-default-mobile-daily.png`, `staging-views-default-mobile-total.png`, and the two `staging-views-default-mobile320-*.png` images. These contain the rendered aggregate analytics used for the comparisons; no credentials were exported.

OpenNext retained its existing `color-string` copy message, dependency duplicate-key warnings, and Windows DEP0190 warning; deployment completed. Production was not deployed.
