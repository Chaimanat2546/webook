# Independent Analytics Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline execution, or superpowers:subagent-driven-development only if the user selects that method. Steps use checkbox (`- [x]`) syntax. User must review these documents before implementation.

**Goal:** Range picker และชุดเทียบเลือกเงื่อนไขอิสระ แสดงกราฟ/เหตุผลงด % สอดคล้องกัน พร้อม controls 32px

**Architecture:** ใช้ services/API และ picker/chart เดิม เพิ่ม pure comparison-policy owner รวม structural/data compatibility ส่งหน่วยจริงจาก source period ผ่าน service/loader ถึง UI; navigation เปลี่ยนเฉพาะชุดที่ผู้ใช้ยืนยัน

**Tech Stack:** Next.js App Router, React, strict TypeScript, existing shadcn/Base UI, Recharts, Node.js Test Runner, existing SQL/HTTP fixture runner

**Spec:** [Independent comparison design](../specs/2026-10-16-independent-analytics-comparison-design.md)

สถานะ: implementation และ local verification เสร็จแล้ว; [ผลตรวจและขอบเขต browser fixture](../reports/2026-10-16-independent-analytics-comparison.md); ฐาน `origin/staging` หลัง PR #100 (`2f86081`)

## Global Constraints

- เขตเวลา Asia/Bangkok; inclusive dates และ clock window `[start,end)` ทีละชั่วโมง 00–23 / 01–24; ไม่ระบุเวลา normalize 00–24; ไม่รองรับข้ามคืน
- Controls สูง 32 CSS px; ลูกศร/ปุ่มไอคอน 32 × 32 CSS px; เวลาใต้ปฏิทิน; reuse components เดิม ไม่เพิ่ม dependency
- ช่วงหลัก/เทียบอิสระหลังสร้าง ไม่เพิ่มสถานะ auto-mode; shared website visibility เหมือนเดิม
- source 1.1/hour; 1.0/1.2/day; implicit month วันแรกต้องยังเป็น day; ไม่เดาจาก from==to อย่างเดียว
- % ต้อง same site, same granularity, same day count, same normalized clocks, both complete/elapsed; ป้องกันหารฐาน 0
- No producer API/SQL changes; chunk90/concurrency2/shared as_of/allowlists/server-only credentials เดิม
- Dashboard widget ไม่ใช้ House Workspace Shell; generic picker ที่ไม่ใช้ analytics selection slot ต้องไม่เปลี่ยนพฤติกรรม
- ไม่ commit/PR/merge/deploy โดยอัตโนมัติ งานนี้คือเอกสาร; execution ใช้ branch `codex/independent-analytics-comparison` จาก Staging ล่าสุดใน worktree ที่สะอาด โดยเก็บเอกสารสองไฟล์นี้ไว้

## Review Focus

1. legacy implicit month วันแรกมีวันเดียวแต่ source daily ต้องไม่แสดง hourly ปลอม และปุ่มปรับเงื่อนไขต้องอธิบายข้อจำกัด — Task 2/3
2. ชั่วโมงต่างกันแต่ยาวเท่ากัน เช่น09–12/18–21 ต้องแยกกราฟและงด % เช่นเดียวกับหลายวัน — Task 1/4
3. เปลี่ยนเงื่อนไขหลักขณะมีชุดเทียบ custom, browser back/refresh และ repeated Apply ต้องไม่เขียนทับอีกชุดหรือผูก draft ข้ามกัน — Task 3/5
4. เว็บไซต์แรกโหลดไม่ได้/อยู่ฝั่งเดียว/ถูกซ่อน ต้องไม่ทำให้แกนของเว็บไซต์ที่มีข้อมูลหาย หรือเอา missing ไปแทน0 — Task 1/4
5. ช่วงจบวันนี้ก่อนเที่ยงคืน, ก่อนเริ่มเวลา และ microsecond retention ต้องให้ coverage/%/copy ตรงกัน — Task 1/2/4

## File ownership

- Create `lib/website-analytics-comparison-policy.ts`, `tests/website-analytics-comparison-policy.test.ts`: rules/descriptors/layout/matching + matrix
- Modify `lib/website-analytics.ts`, `lib/website-analytics-comparison.ts`, `server/services/website-analytics-comparison.ts`: explicit source units, series and shared decision
- Modify feature `site-summary-loader.tsx`, `site-summary.tsx`, `site-summary-graph.tsx`, `website-period-detail-chart.tsx`, `site-trend-chart.tsx`: propagate source unit to every chart entry point
- Modify feature `dataset-controls.tsx`, `summary-range-filter.tsx`, `filters.tsx` and `lib/website-analytics-scope.ts` only if navigation tests require: independent state/matching action
- Modify feature `site-period-comparison.tsx`, `multi-site-period-trend-chart.tsx`, `period-comparison-summary.tsx`, `period-comparison-issues.tsx`, `site-period-total-chart.tsx`: presentation from shared policy
- Update existing comparison/time/scope/render/service/route tests, `docs/website-analytics.md` and browser fixture owner in `scripts/test-hourly-analytics-integration.mjs` as needed; build regenerates `public/sw.js`

## Task 1: Pure compatibility policy and consistent percentage rules

**Files:** Create policy/test files above; Modify `lib/website-analytics-comparison.ts`, `tests/website-analytics-comparison.test.ts`, `tests/website-analytics-daily-window.test.ts`

**Interfaces** (export from policy; type-only import of `WebsitePeriodSeries` avoids runtime cycle):

- `ComparisonGranularity = 'hour' | 'day'`
- `ComparisonPeriodDescriptor`: `range: AnalyticsDateRange`, `granularity: ComparisonGranularity`, `dayCount: number`, `timeFrom: string`, `timeTo: string`, `requestedHours: number`
- `ComparisonConditionReason = 'granularity_mismatch' | 'day_count_mismatch' | 'time_window_mismatch'`
- `ComparisonReason`: above plus `'site_not_shared' | 'load_failed' | 'coverage_incomplete' | 'not_started' | 'ongoing'`
- `describeComparisonPeriod(range: AnalyticsDateRange, granularity: ComparisonGranularity): ComparisonPeriodDescriptor` (validated range input; normalize missing clocks)
- `comparePeriodConditions(current: ComparisonPeriodDescriptor, previous: ComparisonPeriodDescriptor): { layout: 'overlay'|'separate'; reasons: ComparisonConditionReason[] }`
- `assessPeriodComparison(current: WebsitePeriodSeries, previous: WebsitePeriodSeries, selection?: { currentSelected: boolean; previousSelected: boolean }): { layout: 'overlay'|'separate'; canCompare: boolean; reasons: ComparisonReason[] }`, selection defaults both true; derive descriptors from series.range and explicit granularity
- `matchComparisonConditions(primary: AnalyticsDateRange, comparison: AnalyticsDateRange): AnalyticsDateRange | undefined` anchored to comparison.to, undefined if under1900 bound

- [x] Write table tests for 16 ordered pairs of S24/ST/R24/RT (use Oct14 single / Oct12–14 range; compare corresponding previous dates); assert layout and exact ordered reasons, normalized full-day identity
- [x] Add `equal_duration_different_clocks_disallows_percentage`: complete hourly09–12 vs18–21 returns unavailable, and layout separate; daily09–12 vs18–21 overlay with clock mismatch reason
- [x] Add cases day counts3/7, hours9/24, same/overlapping dates, full-day old/new clocks, one-side missing, failed first site, complete/partial/ongoing/not-started, 0→0 and0→positive. Assert every incompatible result omits percentage and Infinity/NaN never appear
- [x] Run `node --import ./tests/register-server-only.mjs --test tests/website-analytics-comparison-policy.test.ts tests/website-analytics-comparison.test.ts tests/website-analytics-daily-window.test.ts`; observe the new regressions FAIL against current policy
- [x] Implement minimal pure rules; change `websitePeriodChange` to check assessment.canCompare before existing difference/zero logic. Stable reason order matches spec, without duplicate reasons
- [x] Run same tests to PASS. Do not change site totals, producer contracts or fetch counts

## Task 2: Propagate the actual report granularity

**Files:** Modify types/services/loaders/chart entry points listed above; Test `tests/website-analytics-comparison-service.test.ts`, `tests/website-analytics-time.test.ts`, `tests/website-analytics-comparison-render.test.ts`

**Interfaces:** export `analyticsPeriodGranularity(period: AnalyticsPeriod): 'hour'|'day'` in `lib/website-analytics.ts`. Add required `granularity` to `WebsitePreviousPeriod` and to primary chart props at the call sites listed in File ownership. Add required final `granularity: 'hour'|'day'` argument to `websitePeriodSeries(site,range,asOf,metric,granularity)`; add required final `granularity` argument to `websitePeriodRows(sites,range,previous,asOf,metric,granularity)`. Update every caller/test fixture; no fallback based on date count in production render paths

- [x] Write `implicit_month_first_day_retains_daily_source_unit` at fixed now `2026-10-01T03:00:00Z`: current implicit source1.0 remains day; explicit single comparison1.1 remains hour; assessment separate + units mismatch; no hourly data fabricated
- [x] Write service tests preserving independent dates/clocks/sites and one identical as_of, including chunk final one-day1.2 stays day. Verify fetch concurrency<=2 and no extra read to determine presentation
- [x] Add completion tests today09–12 at Bangkok11:00 ongoing /12:00 complete, before09 not_started, retention one microsecond after start remains partial; same result propagated to chart/summary/detail
- [x] Run focused service/time/render tests to observe FAIL, then propagate units from current.period and previous.period to all consumers and update fixtures
- [x] Run focused tests and `npm.cmd run typecheck` to PASS; rg all `websitePeriodSeries`, `websitePeriodRows`, `SitePeriodComparison`, `WebsiteSiteTrendChart` callers to ensure none still infer source unit from dates

## Task 3: Independent picker navigation and condition matching action

**Files:** Modify feature `dataset-controls.tsx`; inspect/reuse `website-date-range-picker.tsx`, `summary-range-filter.tsx`, `filters.tsx`, scope and href owners. Tests `tests/website-analytics-scope.test.ts`, `tests/website-analytics-time-filter.test.ts`, `tests/website-analytics-route.test.ts`; add interaction assertions to existing local browser fixture

**Interfaces:** matcher from Task1; dataset controls receive the primary source `granularity` from Task2. Pass one precomputed disabled reason for legacy implicit-day-single/boundary cases, or compute it from supplied source unit and validated range. URL format remains unchanged. Match preserves comparison.sites and all unrelated navigation state

- [x] Add navigation tests: primary edit changes only primary dates/clocks; comparison edit preserves primary and comparison site membership; remove preserves primary; add seeds previous adjacent range with same normalized clocks and site selection
- [x] Add matcher assertions: primaryOct14–16/09–18 + comparison.toOct10 -> Oct8–10/09–18; single primary -> comparison.to single; full-day off ->00–24; start before1900 ->undefined, disabled action/no navigation
- [x] Add legacy implicit-single-day action disabled test with exact copy “เลือกช่วงหลักจากปฏิทินก่อนปรับเงื่อนไข”; no silent conversion of primary contract
- [x] Run time-filter/scope/route focused tests to FAIL; implement existing Button action “ใช้จำนวนวันและเวลาตามช่วงหลัก” (32px), clear labels, wrapping and preservation through existing href owner. Do not add auto-mode state
- [x] Run focused tests to PASS; browser-check draft edits do not navigate and Apply happens once. Cancel/Escape/outside discard only the active picker; pending disables navigation actions

## Task 4: Shared graph layout, warnings and total/detail presentation

**Files:** Modify feature chart/status components listed in File ownership; Test `tests/website-analytics-comparison-render.test.ts`, `tests/website-analytics-time-filter.test.ts`, `tests/website-analytics-comparison-policy.test.ts`

**Interfaces:** all layout decisions consume `comparePeriodConditions`; per-site numeric/detail decisions consume `assessPeriodComparison` with currentSelected/previousSelected. Export `comparisonReasonLabel(reason: ComparisonReason): string` from `period-comparison-summary.tsx`; exact labels/order are in spec. Reuse it in graph, total and popover. No new UI primitive

- [x] Write render assertions for hourly09–12 vs18–21: two labelled hourly figures; no joint ordinal pairing or percentage. Mixed source hour/day likewise two correct units and own ranges
- [x] Write daily3day vs7day assertions: one ordinal graph of7 requested slots, correct dates/clocks on both tooltip headers, null beyond shorter range; hour same clocks shows actual hour tick labels. Neither range derives axis from first successful site
- [x] Write summary/details tests: show all structural mismatch reasons; per-site failures/retention/ongoing shown separately; same labels regardless daily/total/popover; no “ดีขึ้น/แย่ลง” for unavailable comparison
- [x] Include failed-first-site/healthy-second, prior-only site, hidden site and actual0 fixtures. Shared visibility keeps at least one visible site and stable colors; totals stay unchanged
- [x] Run comparison-render/time-filter/policy tests to FAIL; wire shared policy into charts, legend, tooltip, issues, total and detail; remove duplicated compatibility checks
- [x] Display requested span `dayCount × daily clock hours` as “ระยะเวลาที่เลือก”, with separate coverage/as_of notice when incomplete; no average per hour
- [x] Re-run focused tests to PASS; self-check all10 unordered pairs against matrix and all consumers of percentage/condition copy

## Task 5: Integration, browser verification, review and documentation

**Files:** Update `docs/website-analytics.md`; update existing fixture runner only where new props/interaction probes require it. Save results to `docs/superpowers/reports/2026-10-16-independent-analytics-comparison.md` during execution

- [x] Update docs with matrix, independent state, matcher anchoring, source-unit exception and percentage reasons. Report what is local versus deployed; no claim of Staging verification unless actually authorized/deployed
- [x] Run existing cross-project fixture: `node --import ./tests/register-server-only.mjs scripts/test-hourly-analytics-integration.mjs C:/Projects/baan-pool-villa/.superpowers/worktrees/hourly-site-analytics supabase_db_baan-P-Mhee-2026-09-07 --serve`; disposable DB only. Extend fixture UI props to carry source granularity, without changing producer data
- [x] In real browser check16 ordered pairs via fixture-backed actual components; representative low/high counts, invalid clocks, full-day toggles, both directions mixed granularity, legacy first-day, mismatch reset action and coverage/failure states. Confirm graph layout, reason copy, tooltip dates, values and absence of misleading %
- [x] Verify Dashboard and website detail entry points; Apply/cancel/Escape/outside, primary↔comparison independence, add/remove/readd, deep links/refresh/back/forward, pending duplicate clicks (component probe; Next.js server navigation จริงยังไม่ได้ทดสอบ), shared visibility and all-data-unavailable versus observed0
- [x] Inspect desktop1280×900 and mobile360×800/390×844/430×932; measure all analytics controls32px and month arrows32×32 after animation settles. Check time fields under calendar, scroll/footer, multiple simultaneous reasons and long labels without overlap/horizontal overflow. Save screenshots; restore viewport and clean up only owned fixture server/DB
- [x] Run `npm.cmd run build` to regenerate PWA worker, then `npm.cmd run verify`; require exit0, zero test failures and no new lint warnings. Do not test against known-stale generated worker before build
- [x] Review whole feature diff against spec with one fresh reviewer after inline execution; fix confirmed findings with regression tests, re-run impacted checks, and update report with exact results
- [x] Run `git diff --check`; inspect changed files, no secrets/dependencies/unrelated changes. Hand off reviewable diff; commit/PR/merge/deploy only if separately requested

## Execution handoff

Recommend inline execution in this chat: the tasks share the same period and policy interfaces, and API1.2 is already available. Keep one final independent reviewer. ผู้ใช้อนุมัติแบบและแผนแล้วและดำเนินงานในแชตนี้ ผลตรวจในรายงานระบุสิ่งที่ตรวจผ่าน browser fixture กับสิ่งที่ยังต้องตรวจบน deployment จริงแยกกัน ยังไม่ merge หรือ deploy.
