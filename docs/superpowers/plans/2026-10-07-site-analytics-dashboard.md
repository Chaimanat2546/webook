# Website Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for the proposed inline execution, or superpowers:subagent-driven-development if the user chooses delegation. Track progress using the checkboxes below.

**Goal:** Add an admin-only API and responsive Webook dashboard for first-party website views and contact clicks across the existing seller domains.

**Architecture:** Thin Next.js routes authorize requests, validate query parameters and call one shared service. A server-only allowlisted adapter reads each website's existing report API; the service validates and combines responses for the UI. No analytics database or collection changes.

**Tech Stack:** Existing Next.js App Router, TypeScript, Supabase Auth, Cloudflare/OpenNext, shadcn components, Recharts and Node Test Runner.

**Spec:** `docs/superpowers/specs/2026-10-07-site-analytics-dashboard-design.md` — approved 2026-10-07.

## Global Constraints

- Only verified uid with `users.role_id === 1` may read reports; no owner access or email fallback.
- Keep all five configured domains available; use only two representative websites in integration tests: NASA and Pukmood.
- Counts represent events, not unique people; no new tracking identifiers or Google integration.
- Reuse existing tenant identities, UI primitives and Dashboard layout; no new dependencies.
- Secrets stay server-only, never in browser payloads, logs or committed files.
- Month boundaries use Asia/Bangkok; source contract is `1.0`; use one shared `as_of` per report.
- Fetch concurrency 2, timeout 10 seconds including body consumption, maximum body 3 MiB, HTTPS allowlist, no redirects, no automatic retry/polling.
- All report responses use `Cache-Control: private, no-store`; no shared persistent report cache.
- Missing/failed/incomplete data must not masquerade as zero or complete totals.
- No commit, production deployment or remote secret mutation without a separate explicit request. Preserve existing work.

## Review Focus

1. Month rollover while fetching: compute the period and snapshot once, including Bangkok midnight (Task 1).
2. Valid JSON with internally inconsistent totals/dates or an unexpected site identity: reject the affected report, not silently combine it (Task 2).
3. All sites unavailable versus partial retention coverage: distinguish both from successful zero activity (Task 3).
4. A logged-in owner navigating directly to the API: deny before contacting upstream; do not rely on hidden navigation (Task 4).
5. Returning from page 2 after changing site/month: reset pagination and preserve filters without changing headline totals (Task 5).

## Task 1 — Typed query and report contracts

**Files:** Create `lib/website-analytics.ts`, `tests/website-analytics-contract.test.ts`.

**Interfaces:**
- `WebsiteAnalyticsQuery`: month string, site string (`all` or validated tenant key), page positive integer.
- `AnalyticsPeriod`: from_date, to_date, timezone `Asia/Bangkok`, as_of ISO string, contract_version `1.0`, villa_id null.
- `AnalyticsMetrics`: page_views, phone_clicks, chat_clicks, line_clicks, gallery_opens, derived contact_clicks.
- `parseWebsiteAnalyticsQuery(raw: Record<string, unknown>, allowedKeys: readonly string[], now: Date): WebsiteAnalyticsQuery`.
- `analyticsPeriod(query: WebsiteAnalyticsQuery, now: Date): AnalyticsPeriod`.
- `websiteAnalyticsHref(query: WebsiteAnalyticsQuery, changes?: Partial<WebsiteAnalyticsQuery>): string` resets page on month/site changes.

- [x] Add failing tests for defaults, repeated/foreign fields, unknown site, invalid month, future month, zero/negative/unsafe page values, leap February and Bangkok rollover. At `2026-09-30T17:00:00Z`, default month must be `2026-10` and to_date `2026-10-01`.
- [x] Run `node --import ./tests/register-server-only.mjs --test tests/website-analytics-contract.test.ts`; confirm the new behavior fails before implementation.
- [x] Implement these contracts using existing month parsing where compatible; reject arbitrary URL/token query fields. Pagination is 10 rows per page. Month/site changes reset page to 1.
- [x] Repeat the focused command; all new contract tests pass.

## Task 2 — Server-only website adapter

**Files:** Create `server/site-analytics/registry.ts`, `credentials.ts`, `client.ts`, `report.ts`, `tests/website-analytics-client.test.ts`.

**Interfaces:**
- `AnalyticsSite`: key, siteId, displayName, origin; identity from existing `resolveCentralUserTenant`.
- `listAnalyticsSites(): AnalyticsSite[]` and `resolveAnalyticsSite(key: string): AnalyticsSite | null`.
- `readAnalyticsToken(site: AnalyticsSite): Promise<string | null>` reads the exact per-site secret names in the spec, via server environment/Cloudflare context.
- `parseSourceReport(value: unknown, site: AnalyticsSite, period: AnalyticsPeriod): SourceReport` validates upstream fields and produces an allowlisted typed result.
- `fetchSiteReport(site: AnalyticsSite, period: AnalyticsPeriod, dependencies?: AnalyticsClientDependencies): Promise<SiteReportResult>` supports injectable fetch/token reader for isolated tests.
- `SiteReportResult` is a discriminated union: success with `SourceReport`, or failure with site key and sanitized reason (`not_configured`, `unauthorized`, `rate_limited`, `timeout`, `unavailable`, `invalid_report`). Never include credentials or raw upstream bodies.

- [x] Add failing tests using two fake upstream sites: exact POST endpoint and Bearer header, same period, missing token causes no request, rejected redirects, 401/429/503, timeout during body read, streamed response larger than 3 MiB, malformed JSON and site_id mismatch.
- [x] Add report-validation cases for contract/query mismatch, unsafe/negative metrics, duplicate/missing/out-of-range daily dates, duplicate villas, invalid coverage, inconsistent daily totals and `villas + unattributed != totals`. A failed report must return `invalid_report` without exposing its contents.
- [x] Run `node --import ./tests/register-server-only.mjs --test tests/website-analytics-client.test.ts`; confirm failures.
- [x] Implement the narrow registry with canonical origins from the spec, reusing tenant IDs. Use fetch `redirect: "error"`, `cache: "no-store"`, AbortController, bounded streaming and cleanup in finally. Zero-fill is permitted only for valid source zero-count days; do not manufacture missing report days.
- [x] Run focused tests; all pass. Check source imports so only server modules can reach credentials.

## Task 3 — Aggregate reports without hiding gaps

**Files:** Create `server/services/website-analytics.ts`, `tests/website-analytics-service.test.ts`; extend types in `lib/website-analytics.ts`.

**Interfaces:**
- `loadWebsiteAnalytics(query: WebsiteAnalyticsQuery, dependencies: WebsiteAnalyticsDependencies): Promise<WebsiteAnalyticsReport>`; dependencies include one clock, site registry and report reader from Task 2.
- `WebsiteAnalyticsReport`: period, status (`complete`, `partial`, `unavailable`), available/selected site counts, totals or null, daily metrics, websites with safe status/coverage, unattributed metrics, paginated villas `{ rows, page, pageSize: 10, total }`.
- Each villa row retains site key + villa_id. Do not assume duplicate villa IDs across sites refer to a booking/listing record. Stable sorting by contact_clicks descending, then site key and villa_id.

- [x] Add failing tests for complete zero results, one site failure, all failures, coverage older than retention, current-month truncation, max two in-flight requests, one shared as_of, sum overflow and pagination independent of totals.
- [x] Assert two reports with 2 LINE and 3 phone clicks produce contact_clicks 5; assert unavailable sites are listed explicitly, never assigned successful zero metrics. Reconcile all daily metrics and keep unattributed views separate.
- [x] Run `node --import ./tests/register-server-only.mjs --test tests/website-analytics-service.test.ts`; confirm failures.
- [x] Implement bounded workers over selected allowlisted sites, checked arithmetic, coverage-aware aggregation and slicing after aggregation. Successful data with incomplete coverage is partial; zero successful sites yields unavailable with null totals. Reject out-of-range pages with a typed invalid-query error (page 1 remains valid for empty results).
- [x] Repeat focused tests; all pass.

## Task 4 — Authorization boundary and JSON API

**Files:** Create `server/auth/website-analytics.ts`, `server/site-analytics/route.ts`, `app/api/admin/website-analytics/route.ts`, `tests/website-analytics-route.test.ts`.

**Interfaces:**
- `requireWebsiteAnalyticsAccess(): Promise<void>` verifies Supabase auth and reuses the Dashboard repository's uid-based access lookup; requires scope.kind admin. Typed access errors distinguish unauthenticated, forbidden and storage unavailable.
- `handleWebsiteAnalyticsRequest(request: Request, dependencies?: WebsiteAnalyticsRouteDependencies): Promise<Response>` authorizes before upstream requests, parses query using Task 1 and calls Task 3.
- Export GET from the thin route; unrelated HTTP methods are unsupported by Next.

- [x] Add failing tests: anonymous 401, authenticated owner 403, role 1 succeeds, database failure 503, invalid/repeated query 400, partial report 200, unavailable report 503. All responses are private/no-store. Authorization failure must result in zero upstream calls.
- [x] Run `node --import ./tests/register-server-only.mjs --test tests/website-analytics-route.test.ts`; confirm failures.
- [x] Implement JSON responses with safe error codes; do not call a redirecting page-auth helper in API error paths. Never include raw exception text or secrets in output.
- [x] Repeat focused tests; all pass.

## Task 5 — Responsive dashboard using existing components

**Files:** Create `app/admin/dashboard/websites/page.tsx`, `loading.tsx`, `error.tsx`; `components/admin/dashboard/website-analytics/view.tsx`, `filters.tsx`, `daily-chart.tsx`, `tables.tsx`; `tests/website-analytics-ui.test.ts`. Modify `components/admin/dashboard/dashboard-view.tsx` for the admin-only entry link.

**Interfaces:** `WebsiteAnalyticsView({ report, query, sites })` renders only safe serialized metadata; chart accepts daily metrics only. Page directly calls Tasks 3/4 and does not HTTP-fetch its own API.

- [x] Add failing render/interaction tests for Thai headings, metric labels (“ครั้ง”), six cards, domain statuses, unavailable/partial notices, missing configuration, no-activity state, pagination/filter links and absence of the entry link for owners.
- [x] Run `node --import ./tests/register-server-only.mjs --test tests/website-analytics-ui.test.ts`; confirm failures.
- [x] Implement the page's authenticated server data flow. Reuse Card/Select/Input/Button/Table/Badge/Skeleton and ChartContainer/Recharts, plus Dashboard header conventions. Keep filters in the URL; use the existing Thai month picker where its interface permits preserving site. No house workspace shell or new dependency.
- [x] Render desktop and mobile locally; inspect screenshots. Verify loading/error/empty/partial screens, domain/month selection, chart tooltip, 10-row pagination and filter reset from page 2. Ensure table scrolling does not widen the document.
- [x] Repeat UI tests; all pass.

## Task 6 — Integration evidence, operations and final review

**Files:** Create `docs/website-analytics.md`, `docs/superpowers/reports/2026-10-07-website-analytics-verification.md`, `tests/website-analytics-integration.test.ts`; update `docs/dashboard.md`. Add optional analytics secret bindings to the existing environment type declaration only if required by the chosen environment reader.

- [x] Add a two-site integration test with deterministic report fixtures matching the source contract; verify session protection, partial failure and exact aggregate deltas. Do not add production-only endpoints or auth bypasses for testing.
- [x] Run `node --import ./tests/register-server-only.mjs --test tests/website-analytics-*.test.ts` and confirm all targeted tests pass.
- [x] Use isolated Docker collectors/database for two site identities representing NASA and Pukmood; post known local events, compare actual DB counts with source reports and Webook aggregate results. Local-only transport overrides must live in injected test dependencies, not broaden the production URL allowlist.
- [x] Inspect browser network/HTML on mobile and desktop to confirm only sanitized aggregates reach clients, without tokens or direct upstream reporting requests. Record actual results and any environmental limitations; do not claim live Google or production collection validation.
- [x] Run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`; fix relevant failures and rerun only affected checks unless wider evidence warrants it.
- [x] Document safe API examples, five secret names (no values), canonical origins, role requirements, metric definitions, retention/coverage behavior, error handling and rollout steps. No automatic production provisioning/deployment.
- [x] Request final code review using the requesting-code-review skill, address material findings, inspect `git diff --check`, and record test/build/browser/DB evidence. Do not commit automatically.

## Plan self-review

All approved UI/API/auth/configuration/coverage/testing requirements map to Tasks 1–6. The five review-focus cases have explicit owning tests. Source IDs are reused, raw events are not copied, and no Google behavior changes are planned. Execution proposed: implement inline in this chat, then independent final review. User approved inline execution. Implementation and verification completed; see ../reports/2026-10-07-website-analytics-verification.md. Rulings: current feature checkout retained; incomplete-source pagination clamps to preserve diagnostics; shared month picker gained an optional maxMonth; PWA revision regenerated through its normal build.
