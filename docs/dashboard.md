# Booking dashboard

Website statistics are a separate admin-only task at `/admin/dashboard/websites`, linked from the role-1 overview. It consumes each allowlisted seller's first-party reporting API; see [website analytics](website-analytics.md) for credentials, metrics, coverage and API contracts. Booking totals and owner permissions are unchanged.

`/admin/dashboard` is a read-only date-range overview. Desktop navigation exposes Dashboard; on mobile it is in the More sidebar. Existing booking-edit permissions are not expanded.

The overview below 768px uses a compact WeBooks header, period bar, booking-sales card, booking area chart, operational links and website analytics with collapsible filters. Its bottom navigation jumps between the visible report sections; the header menu opens the existing main sidebar. Owners see only their business summary and booking trend. Website rows open the existing detail screen; “ดูตารางทั้งหมด” preserves the displayed analytics period, hours, comparison and website scope. Values and missing-data notices come from the same authorized reports as desktop. Tablet/desktop layout, branding and reporting rules remain unchanged.

## Access

The server resolves the authenticated Supabase user and reads `users.role_id,dv_id` by `uid` using the server-only service client. Role 1 sees all houses, agency sales and new-house history. Other users need a positive `dv_id` and see bookings only where both `bookings.houseid` and the joined `listings.property_id` match it. The listing ID must also match. Missing identities or missing/invalid owner IDs are denied; email fallback and URL-supplied role/house IDs never grant access.

Owner responses exclude agency data and new-house history. Customer details are loaded only by the separately authorized deferred endpoint. Internal notes and cost snapshots are selected only for the requested booking detail, never list rows. Customer-name search joins require the customer DV to match the booking house. Every page request rechecks access and is dynamically rendered, without shared report caching.

## Reporting-period rules

- Business and website controls reuse `WebsiteDateRangePicker`, the time-aware wrapper around the shared `ReportDateRangePicker`: overview, booking list/agency booking details, agencies, houses, and website analytics. The popup includes presets, an optional clock window and an internal Apply/Cancel footer. Selection stays local until Apply; Cancel, Escape, and outside dismissal discard it. Numeric presets do not submit surrounding search forms.
- `month=YYYY-MM` remains backward compatible and defaults to the current Bangkok month. Optional paired `dateFrom`/`dateTo` (`YYYY-MM-DD`, 1900–2199) select an inclusive report period. Paired `timeFrom`/`timeTo` select whole hours on **each** Bangkok day: start inclusive, end exclusive; `24:00` is valid only as the end. Missing clocks mean the complete day, 00:00–24:00. Invalid, repeated, partial or reversed clocks and clocks without explicit dates are rejected by both the URL parser and RPC. Search, sort, pagination and detail/back links retain the dates and clocks; changing them resets the relevant list page. The house-related screens here are reporting views, so the House Workspace Shell does not apply.
- An explicit single day returns real, zero-filled hourly confirmed-booking counts (up to 24 buckets). Multiple days return daily counts restricted to the same clock window every day, not one continuous interval spanning overnight hours. Full-day selection includes all 24 hours. Existing month-only links keep their full-day daily chart. All business cards share these filters: confirmed sales, all-status distribution, booking counts, agency rankings and new-house history.
- Presets include today/yesterday, Sunday-based weeks, 7/14/30 days, current/previous month, and a custom trailing-day count. “Since the beginning” is enabled only where a known collection start is supplied. Business custom ranges may include future dates; website statistics stop at today. Website-card overrides remain independent and preserve the business range.
- Bookings, sales, agency summaries and overview points use **updated_at**. Explicit stay ranges use inclusive **check_in** dates for both summaries and lists, retaining any selected recurring `updated_at` clock window; this compatibility path keeps daily chart data. Status is current: edits can move a booking between reports; these reports are not an immutable revenue ledger.
- Agency booking counts and sales count only `confirmed` (ติดจอง). Sales sum `price_max`, the full stay price, once per booking. Do not multiply by nights, add deposits, include additional charges or treat sales as payments received.
- Missing prices contribute to the booking count and show a missing-price notice; they do not contribute money. Totals use integer satang. Unassigned bookings are shown separately as “ไม่ระบุเอเจนซี่”; inactive agencies retain their sales.
- General booking count includes **all statuses**, including repair, cancelled and unknown legacy values. Status counts partition the full authorized period. Sales, agency booking counts and agency sales remain confirmed-only. Status/search/amount filters affect only list rows and filtered pagination; they never reduce date-scoped headline totals. Agency detail fixes the agency scope for its confirmed count, status totals and sales, while share uses all authorized agencies in the same date scope as denominator.
- Valid status filters are `all`, `confirmed`, `waiting`, `cancelled`, `repair`, and `unknown`. Search matches house title, formatted DV ID, customer full name and (admin only) agency name, case-insensitively. Admin agency drilldown uses the agency ID (`unassigned` for null); owners ignore agency filters and never receive agency data. Invalid/repeated filters are rejected.
- New houses use `listings.created_at`, including inactive houses. The repository bounds the outer date/time interval and the service applies the recurring Bangkok clock window before preview, counts, search, sorting and pagination. This is creation history of currently existing rows, not a deletion audit log.
- PostgreSQL aggregates the scoped dataset, then returns only the requested page: 9 booking rows or 10 agency rows. No complete booking dataset enters Next.js. Malformed, overflowing or failed RPC results show an error instead of partial totals. House creation history retains its independent repository path.

## Architecture and checks

The page authenticates and validates query parameters, the service authorizes and orchestrates results, and the repository alone issues Supabase reads. `dashboard_report(uuid,jsonb)` derives actor scope again, aggregates in PostgreSQL, and returns a bounded typed result. Only the server service role can execute it; public, anon and authenticated roles cannot. The overview owns its heading/month form. A shared Dashboard task header owns the compact back link, heading and description on every list and detail route; focused Booking, Agency, and New House list components own only their local form and pagination state, while shared list primitives provide the pager. Agency and house pages put search above a single full-width bordered list, without a second card heading. Existing Card, Badge, Input, Button, Pagination and Skeleton primitives provide the responsive UI. Charts use the existing ChartContainer/Recharts client boundary, primary-color series for contrast, while source data remains server-scoped. Share bars use directly labelled percentages.

The overview combines confirmed sales and all-status distribution in one surface. Everyone sees the authorized confirmed-booking chart first, hourly for an explicit single day and daily otherwise. Its shared context identifies Thai time and the booking/house timestamp bases. Admin then sees a five-agency sales chart and up to six newest houses. The booking chart retains zero-count buckets, labels Bangkok hours or dates, and exposes the date, hourly interval and count through its tooltip. Its link opens the complete confirmed-booking list with the same dates and clocks. The overview cards use fixed minimum heights and context-specific shared icon empty states when their datasets are empty. No entire monthly dataset is sent to a client component for filtering.

Business clocks use `timeFrom`/`timeTo`; explicit website overrides use `analyticsFrom`/`analyticsTo` and `analyticsTimeFrom`/`analyticsTimeTo`. Without website overrides the overview's website charts inherit the business dates and clocks (clamped to today). Explicit website selections stay independent when business filters change.

## Routes and navigation

The booking, new-house, agency-sales, and website all-houses desktop tables use an explicit `bg-card` surface, `bg-secondary` header, and subtle `border-border/70` dividers. These theme-aware colors separate tables from the page background without changing shared Table primitives, status badge colors, columns, or mobile card layouts. The booking/new-house/agency empty-state surfaces share the table background.

House links from the overview's new-house preview carry the allowlisted `from=overview` marker. Their detail Back link returns to `/admin/dashboard?month=...`; normal list-origin detail links still return to the house list with its search, sort, and page. House-workspace return URLs preserve this marker so returning through management does not lose the original overview month. Image management and cover ordering use the same shared return-URL validator as house details. Other `from` values (including repeated query values) are rejected on the canonical house-detail route. The existing layout is unchanged.

The canonical dashboard routes separate each operational task: `/admin/dashboard` for overview, `/admin/dashboard/bookings` for booking reconciliation, `/admin/dashboard/agencies` for agency sales, and `/admin/dashboard/houses` for new-house history. Their details live below their parent list routes. Every list has only its own query parameters: bookings use `month`, `status`, `search`, `sort`, `checkInFrom`, `checkInTo`, `amountFrom`, `amountTo`, and `page`; agencies use `month`, `search`, `agencySort`, and `page`; houses use `month`, `search`, `houseSort`, and `page`. Agency details retain parent `month`, `search`, `agencySort`, and `page`, and use `status`, `bookingSearch`, `checkInFrom`, `checkInTo`, `sort`, and `bookingsPage` for their booking workflow. Owners cannot enter agency/history routes, including direct URLs. Missing and foreign canonical details use the same not-found response.

On the overview route, the former `view`, `from`, `housesPage`, and `agenciesPage` URLs are compatibility inputs only: they redirect to the equivalent canonical route, retaining only relevant filters. Dashboard navigation uses normal URL/browser history; it does not retain session-storage return state.

- Bookings: GET search by title, formatted DV, customer or agency name; status/sort/stay-range/amount controls. Agency selection is fixed by the agency detail route. The page is headed “การจอง”; its compact toolbar is followed by a one-line full-month confirmed count and sales amount, then the list. Desktop rows have house/DV, stay dates, admin-only agency, and amount columns; mobile rows preserve the same fields in a compact card. Searching retains the active filters and resets page one.
- Agencies: search by name and sort aggregate rows by sales, confirmed booking count, or Thai agency name; `agencySort` is separate from the detail page's booking `sort`. The list table has only agency name, confirmed booking count and sales columns; selecting the name opens that agency's details. Detail keeps its confirmed booking count and confirmed sales/share above the exact shared booking-list toolbar, table, mobile cards, empty states, pager, and booking links. The route ID is the fixed server-side agency filter; users can use every booking filter, defaulting to `confirmed`. Detail booking rows use `updated_at` for a selected month or `check_in` for an explicit date range, and the summary uses that exact same date scope before status/search/amount filters. `bookingSearch` matches the normal booking-list fields without replacing the agency-list `search`; booking filter changes reset only `bookingsPage`. The former top-house-sales section and section toggle are not part of the agency detail workflow.
- Houses: title/DV search and creation history sorted by newest first (default), oldest first, or house name in Thai alphabetical order. Sorting is applied before pagination. The list uses the shared dashboard search toolbar with an in-field submit icon, Thai Buddhist month picker, and sort control; changing the search or sort resets pagination, while changing the month also clears the search. Detail includes the creation timestamp in Bangkok, property type, zone, bedroom/bathroom counts, maximum guests, active status, and check-in/out times when present. Its house-workspace link carries the exact detail URL (including list filters, sort, and page) as a safe return destination; workspace navigation and saves preserve that destination.
- Booking detail: code, title/DV, current status, check-in/out, date-only nights, amount and creation timestamp. Agency name is admin-only. Repair amount is “—”; missing prices are “ไม่ระบุยอด”. Its house-workspace link carries the exact booking-detail URL as an allowlisted return destination, including agency-origin state when applicable.

Lists show the visible range and filtered total, with previous/next pagination. Positive out-of-range pages clamp to the last page, and detail links retain that displayed page. Empty-month and no-filter-match messages are distinct. The monthly headline totals do not change with list filters.

Every dashboard task route uses the same header: a ghost arrow back link above the title and description. Lists return to the overview; details return to their parent list. Back links retain the parent route's allowlisted month/filter/page query; ordinary browser Back uses standard history. Arbitrary return URLs are never accepted. All list filters use a mobile-first three-row layout: full-width search, date and route-specific filters, then a full-width submit action. Agencies and new-house history expose their date-range input instead of silently preserving a hidden month; on wider screens the controls return to a single horizontal toolbar.

Mobile filters keep the search field and action visible, with booking period and status side-by-side; agency and house lists provide a full-width date-range control in the same filter row. Agency details also expose period and sort separately before the submit button. House rows place title and DV together with the creation date beneath them on narrow screens, avoiding identifiers splitting beside long names. Booking rows retain status, amount, stay dates and agency. Dashboard detail fields use two columns on mobile (long booking codes span the row) to reduce vertical scrolling without hiding data. No speculative growth percentages, profit, occupancy or month-over-month comparisons are shown.

Tests cover denied/owner/admin access, direct foreign detail URLs, owner payload redaction, confirmed-only totals and missing prices, Bangkok boundaries, 100-agency pagination, DV-grouped contributions, GET filter retention, detail destinations/fields, repair amount, empty states and return-state matching. Browser QA uses an isolated local fixture harness with the real components/services (120 bookings/100 houses), then live Staging; fixtures are not app routes and do not write to DB.

## Staging demo data

Run `node --use-system-ca --env-file=.env.staging scripts/seed-staging-dashboard.mjs`.
The script refuses every Supabase URL except the approved Staging project. It
inserts clearly labelled monthly DEMO houses, agencies, dummy customers and
bookings; reruns reuse matching fixtures without overwriting existing records.
No login accounts or owner permissions are changed.

For the run month, fixtures add four confirmed bookings totalling THB 38,000
(Agency A: 20,000; Agency B: 15,000; unassigned: 3,000), plus one waiting,
one cancelled and one repair entry. Two houses were created in the run month;
one house and a THB 9,000 confirmed booking belong to the previous month.
The waiting fixture expires 24 hours after its initial insertion. Existing
Staging data also contributes to dashboard totals.

For a larger dataset, run `node --use-system-ca --env-file=.env.staging scripts/seed-staging-dashboard-large.mjs`.
This separate insert-only, Staging-guarded batch adds 30 houses, eight agencies,
30 dummy customers and 228 bookings, all labelled `DEMO LARGE`. It checks DV
collisions before writing, resumes partial runs without updating existing rows,
and verifies inserted counts and confirmed sums by reading the database.
The run month has 180 bookings (120 confirmed, THB 1,374,000) and 24 new houses;
the preceding month has 36 bookings (24 confirmed, THB 380,400), and the month
before that has 12 bookings (eight confirmed, THB 134,000). Older bookings only
use houses already created in those months. Current waiting fixtures expire
after 24 hours. No user accounts, access permissions, or existing rows change.

Deployment includes the booking payment-expiry migration
`20260930100000_booking_payment_expiry.sql`. Apply it only to the approved
Staging project before deploying the scheduled Worker. The ambient declaration
in `types/open-next-worker.d.ts` lets a clean Next build type-check before
OpenNext generates its Worker module.

## Scalable reporting deployment and verification

Apply `20261002110000_scalable_dashboard_reporting.sql` before deploying the
application revision that calls the RPC. It creates date/agency/owner indexes
and a read-only, fixed-search-path function. Thai name sorting uses an ICU Thai
collation (the target PostgreSQL installation must support ICU). No browser role gets execution
permission. Migration and app rollout have not been performed by the local
test command.

Then apply `20261005120000_dashboard_json_ordering.sql`. It explicitly orders
booking, agency-page and top-agency JSON aggregates by the same keys used to
select each page (including Thai names, numeric booking IDs and null handling).
It does not change totals, filters, page sizes, permissions or response fields.
Tests perturb aggregate input order and check cross-page ties/null prices to
verify the JSON order does not rely on incidental scan order.

Apply `20261019120000_dashboard_time_windows.sql` after the date-range migration and before the time-aware application revision. It replaces the existing authorized RPC without expanding execution grants. The shared authorized booking base filters clocks before every aggregate/list, and optional `hourly` points use canonical UTC timestamps for Bangkok hour starts; the repository validates at most 24 contiguous buckets and reconciles their counts with confirmed sales. Deploy only by pushing branch `staging`: GitHub Actions runs the disposable PostgreSQL contract suite, applies migrations to `sxvkhzhqtrpxgzumsswl`, runs `npm run deploy:cf:staging` against account `0df55f166fa309dcc904e992c43f86db`, and checks that the compiled bundle contains the Staging project reference and no Production reference.

Run the real database contract suite against disposable local PostgreSQL 17:

```powershell
$env:RUN_DASHBOARD_DB_TESTS='1'
node --import ./tests/register-server-only.mjs --test tests/dashboard-migration.test.ts
Remove-Item Env:RUN_DASHBOARD_DB_TESTS
```

Docker must be running. The suite creates and removes only its own test
container; it never loads environment credentials or contacts Supabase.
It covers Bangkok date boundaries, confirmed-only agency counts, money and missing prices,
owner isolation, filters, pagination, grants and
30,000-row fixtures with EXPLAIN ANALYZE/BUFFERS. Timing is local evidence,
not a production latency guarantee. Regular UI/service unit tests use an
explicit test-only RPC double; database semantics are verified by this suite.

For arbitrary stay ranges, summary/list scope follows the entire range;
daily chart points remain bounded to the selected month (the chart is shown
only on the monthly overview). Agency count means confirmed bookings only.
Sales still mean confirmed full booking prices, not cash received.

## Internal RPC plan inspection (local, 2026-10-05)

Enable the opt-in diagnostic mode alongside the database tests:

```powershell
$env:RUN_DASHBOARD_DB_TESTS='1'
$env:RUN_DASHBOARD_PLANS='1'
node --import ./tests/register-server-only.mjs --test tests/dashboard-migration.test.ts
Remove-Item Env:RUN_DASHBOARD_DB_TESTS, Env:RUN_DASHBOARD_PLANS
```

This loads `auto_explain` only inside the disposable PostgreSQL test sessions,
with nested statements, ANALYZE and BUFFERS enabled and per-node timing off.
Unlike EXPLAIN of the outer function call, it captures the actual internal
`with base ...` query and asserts that a bookings scan is present. Each
`RPC INTERNAL PLAN` output line summarizes timings, rows, scan/index choices
and temporary blocks. See [PostgreSQL auto_explain documentation](https://www.postgresql.org/docs/17/auto-explain.html).

The diagnostic forces both custom and generic plans. This is a comparison,
not proof that default `plan_cache_mode=auto` selects either one in a deployed
connection pool. Timings below are one instrumented local run, not medians,
load-test results, browser latency or a production SLA. The synthetic schema
has smaller/less varied rows than a live database may have.

| Scope | Scoped rows | Internal custom / generic | Observation |
| --- | ---: | ---: | --- |
| Selective month | 6 | 0.77 / 0.73 ms | Date index, no temporary blocks |
| Distributed month | 2,572 | 11.01 / 11.02 ms | Bitmap date scan, no temporary blocks |
| Stay range | 7 | 0.80 / 0.82 ms | Custom plan uses check-in index |
| Dense month | 30,000 | 121.67 / 156.49 ms | Custom sequential scan; generic bitmap scan; temporary blocks |
| Minority owner | 300 of 30,000 | 2.47 / 7.82 ms | Custom house/date index; generic filters out 29,700 rows |
| Minority agency | 300 of 30,000 | 72.54 / 75.37 ms | Base still includes 30,000 rows for global sales denominator |

For the dense month, outer RPC duration was 140.08 / 171.45 ms respectively,
including additional function/planning work. Temporary blocks read/written
were 3,040/1,824 (custom) and 3,648/1,824 (generic). The output remains bounded
to nine booking rows; bounded transfer does not make aggregation constant-cost.

Conclusion: selective date and custom owner scopes use the intended indexes.
Reading nearly all rows for a full-period aggregate is not by itself evidence
of a missing index. Two follow-ups for Staging measurement are generic-plan
owner selectivity and temporary I/O for dense reports. Do not globally raise
work_mem or force a plan mode on this evidence alone: concurrency and live data
distribution were not measured. No production SQL, indexes, database settings
or deployment were changed during this inspection.

## Staging verification (2026-10-05)

Applied only `20261002110000_scalable_dashboard_reporting` and
`20261005120000_dashboard_json_ordering` to Staging project
`sxvkhzhqtrpxgzumsswl`. Both migrations and their migration-history entries
were committed in one transaction, with a 5-second lock timeout and 60-second
statement timeout. Required columns and Thai ICU collation were checked first
against PostgreSQL 17.6. Production was not queried or changed; the repository's
existing CLI link was preserved and a separate Staging work directory was used.

Read-only checks against the live 242-booking dataset passed:

- For every populated Bangkok updated-month and agency scope, independently
  calculated SQL counts and confirmed-price totals matched the RPC.
- Every booking page matched the complete SQL ID sequence (updated timestamp,
  then numeric ID descending); list payloads omitted detail notes/customer names.
- Confirmed filtering matched status counts; search/amount filters left summary
  metrics unchanged. Reversed amount ranges and unknown actors were rejected.
- Function grants allowed service_role, not anon or authenticated.
- Staging REST calls passed the application's strict repository result parser;
  booking detail remained available when list search excluded it. An anonymous
  REST call was rejected with SQLSTATE 42501.

September 2026 snapshot: 241 scoped bookings, 159 confirmed, confirmed sales
1,960,622.00 THB. Agency `51fb64b1-afdf-48cc-a0d2-f8d770dea163` had **25 total
bookings, 20 confirmed, 255,800.00 THB confirmed sales**. These are a point-in-time
Staging snapshot, not Production totals.

Limits: Staging had no eligible owner identity, so live owner isolation was not
tested (the disposable database suite covers it). No application Worker was
deployed, no browser end-to-end test was performed, and this small dataset does
not validate high-volume concurrency or live nested-plan performance. Dense
temporary I/O and pooled generic-plan owner selectivity remain load-test work.

The admin overview includes the streamed website analytics summary below the main dashboard sections. It lists site/domain, load status and six monthly totals; site-name links open the chosen site's analytics for the selected month. Owners never mount the summary loader. Future months show a no-statistics message without source requests or invalid links. See docs/website-analytics.md; focused check: tests/website-analytics-summary.test.ts.

### Shared application palette

The website summary uses compact rows below the `md` breakpoint: site/domain and load status, three headline counts (views, contacts, gallery opens), and a native disclosure for phone/LINE/chat counts. Site links retain the selected month. Desktop retains the complete table; unavailable values remain dashes in both layouts.

`app/globals.css` owns the white/slate surfaces, blue primary/actions and green second chart series for the whole app, with corresponding dark tokens. Sidebar active and hover styles use shared sidebar tokens instead of literal black. The layout viewport and PWA manifest use the same blue theme color. Website analytics no longer overrides the palette locally; semantic destructive/status and quotation-specific document colors retain their owners.

Date-range database support is in `20261014100000_dashboard_date_ranges.sql`. Apply it before deploying the UI. It retains `checkInFrom`/`checkInTo` override precedence, owner scoping, service-role-only RPC access, and imported-calendar exclusion. Daily graph axes include both day and month. Date-range popups use Base UI modal scroll locking: background scrolling is locked while open, and the popup remains independently scrollable.

Reporting filter rows use content-sized date triggers (`w-auto`, `max-w-full`) and wrap adjacent controls when space runs out, including on mobile. This keeps both date endpoints visible instead of squeezing a range into the old half-width month field. Header/card filters remain bounded by their container. Avoid inheriting an unconstrained `w-full` date trigger into a row with `flex-none`.

The booking advanced-filter panel no longer includes a separate check-in date picker on desktop or mobile (including agency booking lists). Use the primary report-period picker. Legacy check-in URL parameters remain readable for existing links, but applying the primary period or advanced filters clears that legacy override. The primary period continues to use booking `updated_at`.
