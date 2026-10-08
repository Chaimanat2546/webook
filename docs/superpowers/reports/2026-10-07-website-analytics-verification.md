# Website analytics verification — 2026-10-07

Implemented on `feature/dashboard`, without committing or deploying. The approved spec and plan live in the corresponding `specs` and `plans` directories.

## Automated checks

- Full Node suite: 859 tests, 858 passed, 1 existing skipped, 0 failed.
- Focused analytics + bounded month-picker suite: 17 passed.
- Dashboard regression + bounded month picker: 64 passed.
- TypeScript check and production Next.js build passed.
- ESLint: 0 errors, 11 pre-existing warnings in booking detail, image viewers, dashboard routes and worker export; none in the new feature.
- `git diff --check` passed. Generated `public/sw.js` was refreshed by the normal PWA build because its revision fingerprints application source.

## Real persistence and report aggregation

Used only two representative tenant identities: NASA and Pukmood. Separate Docker databases were required because the source analytics schema intentionally rejects mismatched site IDs in one tenant database. No online database was written.

The successful measured run posted three events per site through the existing Next.js collector: one page_view, one LINE click and one phone click. All six returned 201. Queried the six event UUIDs directly in their respective PostgreSQL databases, then read each report through Webook's actual source parser and aggregation service. Result deltas matched: page_views +2, contact_clicks +4. The report correctly remained partial because the test databases started collecting mid-month.

Earlier fixture troubleshooting also produced valid local-only events; evidence uses before/after deltas and explicit UUIDs, not the total database row count. Added 12 synthetic house rows per database separately to exercise UI pagination; these are local fixtures, not production activity or API collection evidence. The Windows/PostgreSQL fixture snapshot uses a one-second clock tolerance within the source API's accepted snapshot range.

## Browser checks

Ran the production Next.js build at localhost with a test-only Node fetch interceptor. Supabase identity/role responses were fixtures, and the two seller domains were mapped to the Docker collectors. Other external requests were blocked. No authentication bypass or endpoint override was added to application source.

Desktop 1366px and Pixel 5 both passed:

- Real page and API rendering, six summary cards, daily chart and domain/house tables.
- Partial 2-of-5 source availability shown explicitly; missing sources did not show successful zeros.
- Ten-row pagination, changing website resets the page, changing month preserves website.
- Future months and next year disabled in this screen; existing month-picker consumers remain unbounded.
- Empty historical interval, visible loading skeleton, all-source unavailable state.
- No horizontal document overflow or browser exceptions; table overflow stays local.
- API returns 401 for no session and 403 for an owner fixture, 200 for an authorized report, with private/no-store headers.

Screenshots were visually inspected. Local evidence remains under ignored `.superpowers/website-analytics/`: `docker-results.json`, `browser-results.json`, `browser-states.log`, and desktop/mobile overview, empty, loading and unavailable screenshots. These are test data, not live statistics.

## Independent review

Reviewer found two P2 issues, both resolved:

1. Loss of a source while on a later page must retain partial totals and error diagnostics instead of returning invalid_query. Added regression tests; incomplete reports clamp to an available page, complete reports still enforce bounds.
2. Month picker offered months rejected by server validation. Added optional maxMonth to the existing picker, focused bounded/unbounded tests, and browser checks on both devices.

The review found no other actionable access-control, credential, endpoint, transport or report-contract issue. No remaining material findings from that review.

## Configuration and remaining rollout

Copied the existing five per-site read tokens into git-ignored local `.env` without replacing existing entries. No token values are committed, logged, or sent to the browser. Added only empty placeholders to `.env.example`.

Production/Staging Worker secret bindings are not provisioned by this change. Before a separately authorized deployment, configure the five secret names documented in `docs/website-analytics.md`, matching their source tokens. This verification does not claim that production endpoints, accounts or Google conversions were tested, or that the feature is already live.


## Approved redesign verification (same day, supersedes presentation checks above)

- One summary panel with three headline metrics and phone/LINE/Messenger counts; no percentages.
- Per-site tables with independent ten-house pagination, titles joined by property_id, unattributed row, and full-site totals.
- Daily/monthly area-line chart; six-month history uses two additional bounded requests per site with shared snapshot. Wholly uncovered months have null metrics/no_data, not zero traffic.
- Focused analytics/month-picker suite: 23 passed. Full suite: 865 tests, 864 passed, one existing skip. Production build includes TypeScript checking; ESLint has zero errors and the same 11 unrelated warnings.
- Browser verification used only NASA and Pukmood Docker sources on desktop and Pixel 5. Both passed independent pagination, unchanged full totals, real source report parsing, fixture catalog titles, daily/monthly switching, series visibility, missing historical coverage, global filter resets, future-month bounds, empty/loading/unavailable states, no page overflow, and no browser exceptions. Anonymous API remains 401 and owner API 403.
- Current local fixture totals were 30 views and 12 contact clicks across both sources; each site returned 12 house records plus unattributed activity. These are Docker fixtures, not live-site statistics. This revision read existing events; it did not add production or test events.
- Independent review found wholly uncovered months incorrectly represented as zeros; fixed and regression-tested. Browser testing caught null-prototype page state rejected by React server/client serialization; now serialized as plain objects with regression coverage. Re-review found no remaining P1/P2 issues; its minor empty-chart copy issue is also fixed.
- Screenshots inspected: desktop-redesign.png, mobile-redesign.png, desktop-monthly.png, mobile-monthly.png, and empty/loading/unavailable states under ignored .superpowers/website-analytics. Titles and authentication in this browser harness are isolated fixtures; reporting endpoints use the real local Docker implementations. No product auth bypass was added.
- No commit, deployment, or remote configuration change performed.


## Main synchronization

Fetched origin and fast-forwarded feature/dashboard from 208f680 to origin/main 0bace64 (31 commits), preserving the uncommitted analytics work. All 30 untracked files matched the safety stash after restoration. Only generated public/sw.js conflicted; regenerated it from the latest worker source and current application source. Refreshed dependencies from the upstream lockfile. No merge commit or remote push performed; safety stash analytics-before-main-sync-2026-10-07 retained.

Post-sync production build/TypeScript passed; full suite 889 tests, 888 passed, one existing skip; lint zero errors and 11 existing warnings; diff whitespace check passed. Desktop/Pixel 5 browser flow passed against the same two Docker sources, including independent pagination, totals, catalog-title fixtures, daily/monthly graphs, missing coverage, filter resets, empty state and API authorization. Evidence: browser-main-sync-results.json and *-main-sync.png.


## Top-five overview revision

User requested descriptive ranking headings and a five-house preview with a ดูทั้งหมด action like the other dashboard modules. Each website now uses บ้านที่มีการกดติดต่อสูงสุด 5 อันดับ, with site/domain as secondary text and numbered ranks. Full lists use the validated view=houses query on the existing authenticated route, keep the selected month/site, show ten houses per page, and return to the overview. Overview resets pagination to avoid showing a later page as the top five. Totals and unattributed activity remain whole-site counts; full-list mode skips historical graph requests.

Focused analytics/month-picker suite: 24 passed. Production build and TypeScript passed. ESLint: zero errors, 11 existing unrelated warnings. Independent review found no actionable P1/P2 issue. Browser flow on desktop/Pixel 5 passed for both NASA and Pukmood Docker sources: five-house previews, full-list links, next page, unchanged totals, ranks 11–12, return to overview, no overflow/exceptions. Screenshots inspected; evidence browser-top-five-results.json and *-top-five.png / *-all-houses-*.png under ignored .superpowers/website-analytics. No commit or deployment.


## Single-site selector correction

Removed ทุกเว็บไซต์ from the UI. Page query selects the first registered website by default and normalizes legacy site=all links to one website; explicit selection scopes cards, chart and house list to that site. Aggregate API behavior remains unchanged. Focused suite 25 passed; production build/TypeScript passed; lint zero errors and 11 existing warnings. Desktop and Pixel 5 passed switching between NASA/Pukmood, exactly one table, five-row preview, full-list pagination and return with site preserved. Screenshots and browser-single-site-results.json recorded. During testing the old Docker collector database JWT expired; temporary collectors on ports 3104/3105 used renewed local-only JWTs against the same isolated databases. No production credentials or application auth changed.


## Hide incomplete-period presentation

Per user request, removed incomplete-period banners, partial badges, truncated-row copy, and monthly partial notices. Source errors remain visible. API coverage/status and metric arithmetic are unchanged. Four UI tests passed including hidden partial notices and preserved failure states; production build/TypeScript passed, lint zero errors with the existing 11 warnings. Desktop/mobile browser checks on the two Docker tenants verified absence of incomplete notices in daily/monthly modes and retained site selection, top five/full-list navigation. Screenshot inspected: desktop-coverage-fluknasapoolvilla.png.


## Five sorting options

Added contacts/gallery/views/name/code ordering in both the five-house overview and full list. All sorting happens before pagination; numeric code tie-breaking and Thai name collation are deterministic. Name sort loads all titles in batches of 100 before ordering, puts missing titles last, and shows a numeric-code fallback message when catalog lookup fails. Query values are allowlisted; sort changes reset page while preserving month/site/view; detail/back links preserve sorting.

28 focused tests passed; production build/TypeScript passed; lint zero errors with 11 existing warnings. Independent review found no actionable P1/P2 issue. Desktop/Pixel 5 passed all five options on NASA/Pukmood Docker, heading changes, unchanged totals, code order, paging reset/persistence, back navigation and no overflow/exceptions. Screenshots inspected; evidence browser-sort-results.json and *-sort-*.png under ignored .superpowers/website-analytics. No commit or deployment.


## Sort placement correction

User clarified sorting belongs only on the ดูทั้งหมด page. Sort selector now renders only for view=houses; overview always resets sort/paging to the default contact ranking, including old URLs with a sort parameter. Back link clears sort. Six targeted UI/sort tests passed; build/TypeScript passed; lint zero errors with 11 existing warnings. Two Docker tenants passed all five sorting options, pagination, and return-to-overview on desktop/mobile. Browser confirmed no sort on overview and default ranking on return. Evidence: browser-sort-detail-results.json and *sort-detail-only*.png.


## Dashboard list style alignment

Full house list now reuses DashboardDetailLayout and DashboardListToolbar, with the existing header/pager conventions. Removed the enclosing card, repeated heading and overview-style labels; desktop uses a bordered fixed-layout table and mobile uses individual bordered cards with all six metrics. Overview presentation remains separate. Four focused UI tests passed including table/mobile-card structure and no enclosing Card; production build/TypeScript passed, lint zero errors and 11 existing warnings. Two Docker sites passed desktop/Pixel 5 sorting, pagination, return navigation, long titles, empty/error states, no overflow and no browser exceptions. Both screenshots inspected: *-list-style-fluknasapoolvilla.png; browser-list-style-results.json records checks. No commit/deployment.

## Full-list search

Added name and exact numeric/DV code search only to the full house list, using the dashboard search field style. Search filters all houses before pagination, preserves sort/month/site, resets pages, and keeps whole-site totals unchanged. Catalog failures expose a search-unavailable message. Submit reads FormData directly.

30 focused analytics/picker tests passed; after the submit adjustment, six search/UI tests passed. Production build/TypeScript passed; lint zero errors with 11 existing warnings. Independent review found no P1/P2 issue. Desktop and Pixel 5 checks passed on only the NASA/Pukmood Docker tenants: codes beyond page one, Thai names, Enter/button submission, sorting/pagination persistence, empty results, clearing, overview exclusion, no overflow/exceptions. Automation waits for document network idle before typing after full-document navigation; earlier immediate interactions raced hydration. Both final screenshots inspected. Evidence: browser-search-results.json and *-search-fluknasapoolvilla.png under .superpowers/website-analytics. No commit or deployment.

## List edge alignment and ranking subtitle

Removed website name/domain subtitle below the top-five ranking heading. Browser measurements showed identical existing padding but a 15px scrollbar changing content width on long lists. Reserved a stable scrollbar gutter only on documents containing the admin sidebar wrapper. Verified analytics and agency lists share desktop bounds (left 280, right 1216) and mobile bounds (left 16, right 359), without horizontal overflow; overview subtitle count is zero. Lint: zero errors, 11 existing warnings. Production build verification recorded in build-spacing.log.

## Main dashboard website summary

Replaced the admin analytics navigation button with a streamed site summary table. Reuses existing Table/Card/Badge/metric components; each site link carries the dashboard month and site key. Missing totals use dashes. Independent review identified future-month invalid reporting links; corrected with an early no-statistics state that skips source calls. Rendering test covers status labels, missing metrics and selected-site/month hrefs. Lint has zero errors and 11 existing warnings. Desktop browser showed the complete summary with actual reports. Browser control timed out during navigation/mobile verification, so those interactive checks are not confirmed. No commit or deployment.

## Approved compact mobile mockup

Implemented three-column summary, contact strip, compact filters/graph, top-five disclosures and scoped blue/green palette. Four rendering tests passed. Browser inspected NASA and Pukmood only at 390px, confirmed no horizontal overflow and working native expansion; desktop table remains visible. Screenshot: .superpowers/website-analytics/mobile-compact-theme.png. Separate review identified long numeric overflow; cells now allow wrapping. Build/lint logs: build-mobile.log and lint-mobile.log. No commit/deployment.
