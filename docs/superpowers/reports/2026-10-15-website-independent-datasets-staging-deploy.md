# Independent website datasets — Staging deployment

Deployed on 2026-10-15 at the user's request. No commit, push, merge or Production deployment was performed.

## Deployment

- Command: `npm run deploy:cf:staging` (exit 0). This loads `.env.staging` and uses `wrangler.staging.jsonc`.
- Supabase: `https://sxvkhzhqtrpxgzumsswl.supabase.co`.
- Cloudflare account: `0df55f166fa309dcc904e992c43f86db`; Worker: `webook-staging`.
- Worker version: `36dd1fd0-259f-462a-b68e-b797f6f6b027`.
- URL: <https://webook-staging.chaymanus2003.workers.dev>.
- OpenNext build and TypeScript completed successfully. Existing dependency/build warnings did not prevent deployment.
- Compiled output contained the Staging Supabase reference in 15 files and the Production reference in zero files. No secret values were printed.
- `/login` returned 200; unauthenticated `/admin/dashboard` redirected to `/login` (307). Deployed Dashboard and website-detail JavaScript chunks returned 200 and matched local SHA-256 hashes.

The source verification and code review preceding deployment are recorded in [independent dataset QA](2026-10-15-website-independent-datasets-qa.md). That report describes the earlier local-only phase; this report records the subsequent live Staging checks.

## Authenticated mobile verification

Tested the deployed application at 375×812 and 320×812 using the existing authenticated Staging session.

- Started with the ordinary graph, selected Baan Party Pattaya and Poolvillapattaya, and manually selected October 13–14. No comparison was forced.
- Added a comparison containing only Villa Media Poolvilla for October 8–10. The URL stayed unchanged while editing the dialog draft and changed only after “ใช้กับกราฟ”. Selecting no websites disabled Apply.
- The primary two-day range and comparison three-day range were retained independently. Changing the primary website selection to only Baan Party, then its date to October 14, kept the comparison's October 8–10 dates and Villa Media selection unchanged.
- Cancel discarded a draft website change. Removing comparison restored the ordinary graph while retaining the primary date and website selection.
- At 320px the settings dialog was x=16, width=273, y=79.5, height=653. Its calendar was x=38.025, width=229.9, y=215.1, height=267.9. Both fit the viewport. The website-detail document had client/scroll width 305px (the remaining 15px is the scrollbar), with no horizontal page overflow.
- Tapping daily chart positions showed actual dates for each dataset: October 13 versus October 8, then October 14 versus October 9. The third point retained October 10 for comparison and labelled the primary date “นอกช่วงที่เลือก”. Unselected websites used `·`; out-of-range selected values used `—`.
- Daily pageview sums matched the total view: Baan Party 4,392 + 4,564 = 8,956; Poolvillapattaya 2,978 + 2,730 = 5,708; Villa Media 1,135 + 686 + 737 = 2,558. The primary mobile summary contained only the two primary websites.
- Unequal ranges showed actual values and day counts without a total percentage. Only the three selected dataset series had nonempty line paths.
- Following the Baan Party detail link retained the independent comparison and the same totals. Removing comparison returned the original website-detail daily chart.
- No browser console errors were observed. Temporary viewport overrides were reset after testing.

## Evidence

Saved in the current thread's visualization directory:

- `website-independent-staging-qa.json`
- `staging-independent-calendar-mobile320.png`
- `staging-independent-trend-mobile320.png`
- `staging-independent-total-mobile320.png`
- `staging-independent-total-mobile375.png`
- `staging-independent-settings-mobile375.png`
- `staging-independent-detail-mobile320.png`

These are live Staging observations, separate from the earlier local fixture checks. Mobile checks used browser viewport emulation, not a physical handset.
