# Website period comparison implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add optional previous-period comparison to the dashboard website card, preserving both original graph views when comparison is off.

**Architecture:** A dashboard URL flag enables server-side loading of both periods with one captured timestamp. Existing authorization, allowlisted reporting service and two-request concurrency remain in force. Framework-light helpers calculate aligned dates, coverage and safe changes; separate client charts display the comparison.

**Tech Stack:** Existing Next.js App Router, TypeScript, Recharts, shadcn Switch/Select/Button and Node test runner. No new dependencies or migrations.

**Spec:** User-approved in-chat design and `website-period-comparison.html` preview (thread visualization directory): daily single-site solid/dashed overlay, total paired bars per website, optional comparison, incomplete-data rules below.

## Global Constraints

- Comparison is off by default. Turning it off renders the existing daily multi-site and three-metric total graphs unchanged.
- Previous period immediately precedes the selected range and has the same inclusive number of calendar days in Asia/Bangkok. Pair by day offset, not weekday or month number.
- Use one `as_of` for current and previous queries. Do not fetch the previous range while comparison is off.
- Show current totals from the same report as the existing summary table. Preserve unavailable/null versus confirmed zero.
- Require complete source coverage, every daily date and closed calendar days before showing a range difference or percentage.
- Missing dates are chart gaps. Partial totals are explicitly labelled, with reported-day counts; do not silently compare subsets or estimate zeros.
- Source failure on either side affects only that side/site. A zero baseline gets a count difference instead of infinity. Both zero means unchanged.
- If the selected range includes the snapshot's Bangkok date, mark ongoing and suppress the whole-range change.
- No House Workspace Shell: this is an embedded dashboard card.
- Work on `codex/website-period-comparison`; no push, merge or deployment is part of this request.

## Review Focus

- Equal-length ranges crossing year/leap-month boundaries must align without overlap.
- Partial source flags must suppress changes even if the daily array contains every date.
- One failed prior report must not erase current values or hide successful websites.
- Midnight changes and rapid URL navigation must not pair reports from different snapshots/ranges.
- Switching comparison off must preserve existing metric/view/hidden-site choices and load no previous data.

### Task 1: Pure comparison rules

**Files:** Create `lib/website-analytics-comparison.ts`, `tests/website-analytics-comparison.test.ts`.

**Interfaces:** `previousAnalyticsRange(range): AnalyticsDateRange | undefined`; `websitePeriodSeries(site, range, asOf, metric): WebsitePeriodSeries`; `websitePeriodChange(current, previous): WebsitePeriodChange`; `pairWebsitePeriods(current, previous): WebsitePeriodPoint[]`.

- [x] Write tests for previous dates (8–14 Oct → 1–7 Oct, 1 Mar 2024 → 29 Feb, single day and earliest supported range), zeros, absent dates, retention, coverage flags, either-side failure and Bangkok midnight.
- [x] Run the new test file; expected failure because comparison functions do not exist.
- [x] Implement the functions with explicit typed statuses and null gaps. Use source totals; never manufacture a daily point from a total.
- [x] Run tests; expected all passing.

### Task 2: Server report orchestration and URL flag

**Files:** Create `server/services/website-analytics-comparison.ts`, `tests/website-analytics-comparison-service.test.ts`; modify dashboard page, summary loader and summary props.

**Interfaces:** `loadWebsiteSummaryPeriods(query, compare, dependencies): Promise<WebsiteSummaryPeriods>` returns current period/sites and optional previous range/sites. Loader passes captured `asOf` to client charts. Dashboard enables comparison only for scalar `analyticsCompare=previous`.

- [x] Write service tests asserting exact prior range, common snapshot, <=2 concurrent reads across both periods, off-mode reads, independent failures and no optional title lookup.
- [x] Run service tests and verify failure before implementation.
- [x] Implement with existing `loadWebsiteAnalytics` / `readSiteRange`. Current and previous reads are sequential groups with independently preserved failures. Authorize through the existing dashboard server page.
- [x] Run both test files and existing analytics tests; expected all passing.

### Task 3: Comparison UI, documentation and review

**Files:** Modify `site-summary-graph.tsx`; create comparison controls/chart components under `components/admin/dashboard/website-analytics/`; update `docs/website-analytics.md`.

**Interfaces:** Server-provided optional previous range/sites and `asOf`; client state owns original view/metric/hidden sites plus selected comparison site. Switch navigates with the URL flag, preserving range and unrelated filters.

- [x] Add Switch using existing UI source; show pending state while the server refreshes. Preserve original charts when off.
- [x] Add daily Recharts overlay using shared color with solid/dashed lines, actual date pair tooltip and a readable persistent coverage/change summary.
- [x] Add paired horizontal total bars per site for one selected metric, with explicit missing values and per-site coverage/change summaries.
- [x] Review against the above rules and update feature docs.
- [x] Run `npm run verify` and `npm run build`; expected zero failures (report existing warnings separately).
- [x] Verify real component states at desktop and mobile widths, including null gaps, zero baseline, ongoing periods, mode/metric switching and return to both original graphs.
- [x] Request an independent final code review and address actionable findings with regression tests.

## Execution notes

### Approved scope correction: overview versus website detail

The user approved replacing the Dashboard single-site selector with all websites shown together. Dashboard daily comparison must render current/prior line pairs for every site, stable website colors, shared date-pair tooltip and the original hide/show state. Total comparison remains paired bars for all sites. A compact issue disclosure retains coverage information without repeated prose. The two-line single-site chart moves to `/admin/dashboard/websites`, with its own opt-in comparison switch, metric buttons and the same compact summary/details.

- [x] Add and run failing tests for multi-site aligned points, independent nulls/zeroes, detail comparison URLs preserving site/date filters, and prior loading scoped to the selected website at the current report timestamp.
- [x] Implement shared row/point helpers, all-site daily chart and overview issue disclosure; remove the overview website selector.
- [x] Add single-site comparison to the existing authenticated website page. Treat `analyticsCompare` as a page-only flag; do not broaden the existing reporting API query contract. Preserve it through website/date filters, and avoid prior reads on the all-houses list.
- [x] Verify real components on desktop/mobile, mode switching, hide/show pairs, per-site tooltip rows, issue details and both page-specific switches.
- [x] Run full verify/build, update docs and request an independent review.

- The user approved the preview and directly requested implementation; proceed inline without a second design approval.
- The clean existing checkout is retained on a dedicated feature branch; no additional worktree or dependency installation is needed.
- Keep changes uncommitted for user review unless separately requested.
- Final review found two issues: ongoing ranges concealed independent partial coverage, and the main header range picker discarded the comparison flag. Both reproduced with failing regression tests, fixed, and passed the complete suite afterward. Real header-picker interaction also verified the emitted URL preserves comparison and clears old analytics date overrides.
