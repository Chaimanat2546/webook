# Daily Time Window Analytics — Webook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in this chat. Steps use checkbox (`- [ ]`) syntax for tracking. ใช้ subagent-driven-development เฉพาะเมื่อผู้ใช้เลือกวิธีนั้น

**Goal:** เลือกช่วงหลายวันพร้อมช่วงเวลาเดียวกันของทุกวันได้ ช่องเวลาอยู่ใต้ปฏิทิน และคงขนาด 32px

**Architecture:** Reuse picker/Select เดิม เพิ่ม period union 1.2 และขยาย parser/range reader เดิม ให้ SQL producer เป็นเจ้าของการกรองยอด กราฟใช้ daily window bounds ชุดเดียวกับ coverage/comparison

**Tech Stack:** Next.js App Router, React/TypeScript, shadcn/Base UI, Recharts, Node.js Test Runner, local PostgreSQL integration

**Spec:** [Webook design](../specs/2026-10-16-daily-time-window-analytics-design.md); API contract อ้างอิงเอกสารชื่อเดียวกันของ baan-pool-villa

## Global Constraints

- เวลา `Asia/Bangkok`; `[start,end)`; ทีละชั่วโมง เริ่ม 00–23 สิ้นสุด 01–24; เริ่มน้อยกว่าสิ้นสุด
- Controls สูง 32 CSS px; ลูกศร/ปุ่มไอคอน 32 × 32 CSS px; ไม่มี dependency ใหม่
- วันเดียว explicit ใช้ 1.1/hour; หลายวันพร้อม clocks ใช้ 1.2/day; URL เก่าไม่มี clocks และ implicit month ยังคง 1.0
- คง source allowlist/token server-only, timeout, 3MiB response limit, concurrency=2; แบ่ง 1.2 เป็น chunk90วัน ห้าม request-per-day
- งานเป็น Dashboard widget ไม่ใช้ House Workspace Shell; ห้ามแก้ shared picker ที่ไม่ใช้ selection slot ให้เปลี่ยนพฤติกรรม
- การอนุมัติเอกสารนี้ไม่ใช่อนุญาต commit/PR/merge/deploy; ต้องมี producer readiness ก่อน consumer rollout

## Review Focus

1. URL เก่า/เปลี่ยนเดือนยังเหมือนเดิม แต่ search/sort/page/site/back และ range ต้องไม่ล้างเวลา — Task 1
2. Chunk สุดท้ายเหลือวันเดียวต้องยังเป็น 1.2/day ไม่กลายเป็น 1.1/hour — Task 2
3. วันนี้ก่อนเวลาเริ่ม/หลังสิ้นสุด และ retention watermark ระดับ microsecond แยก zero/gap ถูกต้อง — Task 3
4. Draft ที่ยกเลิกหรือคลิกด้านนอกต้องไม่เปลี่ยน URL/API และเวลาไม่หายเมื่อสลับ single↔range — Task 4/5
5. Unsupported tenant/ช่วงเปรียบเทียบเวลาต่างกันต้องไม่แสดงยอดเต็มวันหรือ % ที่ชวนเข้าใจผิด — Task 2/3/5

## Task 1: Time model, query และ URL persistence

**Files:** Modify `lib/website-analytics-time.ts`, `lib/website-analytics.ts`, `lib/website-analytics-scope.ts` ตามจำเป็น, `lib/dashboard-routes.ts` ตาม regression; Tests `tests/website-analytics-time.test.ts`, `website-analytics-scope.test.ts`, `website-analytics-route.test.ts`

**Interfaces:** เพิ่ม `AnalyticsDailyWindowPeriod extends AnalyticsPeriodFields` ที่มี version1.2/day/from_time/to_time ลง `AnalyticsPeriod`; `parseAnalyticsTimeRange` signature เดิมแต่รับ paired clocks ของหลายวัน; เพิ่ม `dailyWindowBounds(date:string,time:AnalyticsTimeRange):AnalyticsHourBounds` คืน start/end UTC; `analyticsPeriod(query,now)` เลือก version ตามตาราง spec; `analyticsDateRange(period)` คืน clocks ของ 1.1/1.2

- [ ] เขียน failing tests: multi14–16/09–18 ยอมรับและ period.version=1.2/day; single=1.1; ไม่มี time fields หลายวัน/implicit month=1.0; `dailyWindowBounds('2026-10-15',09–18)`=02Z–11Z; 23–24=16Z–17Z
- [ ] เพิ่ม tests ปฏิเสธ paired fields ขาด/ชั่วโมงผิด/กลับด้าน/explicit hour หลายวัน; URL/scope roundtrip และเปลี่ยน range/pagination/site/search/sort/back คง clocks; เปลี่ยนเดือนล้วนล้าง explicit range เดิม
- [ ] Run `node --import ./tests/register-server-only.mjs --test tests/website-analytics-time.test.ts tests/website-analytics-scope.test.ts tests/website-analytics-route.test.ts`; เคส multi valid ต้อง FAIL ก่อนแก้
- [ ] เพิ่ม types/helper/period selection; เอาการลบ clocks เมื่อ from!=to ออกจาก href owner; คง defaults: missing clocks single explicit=00–24, multi implicit=undefined
- [ ] Run focused tests และ `npm.cmd run typecheck`; ต้อง PASS เก่าและใหม่
- [ ] เมื่อได้รับอนุญาต commit implementation ให้ commit `feat: support recurring daily analytics periods`

## Task 2: Source contract parser, bounded chunks และ failure states

**Files:** Modify `server/site-analytics/report.ts`, `range.ts`, `client.ts`, `lib/website-analytics.ts`, `components/admin/dashboard/website-analytics/table-metrics.tsx`, `site-summary.tsx`; Tests `tests/website-analytics-contract.test.ts`, `website-analytics-range.test.ts`, `website-analytics-client.test.ts`, `website-analytics-service.test.ts`; fixture `tests/fixtures/website-analytics.ts`

**Interfaces:** `parseSourceReport(value,site,period)` และ `readSiteRange(site,period,read)` signature เดิม; เพิ่ม `SiteFailureReason='time_range_unavailable'` สำหรับ 1.2 HTTP422 พร้อม label ตาม spec

- [ ] เขียน failing tests 1.2 query echo/version/clocks/day granularity, reject forged clocks/duplicate/missing daily/wrong sums/unexpected hourly/nonzero metrics ของวันที่ window ยังไม่เริ่มตาม as_of; ผลรวม raw daily/villas ต้องตรง totals
- [ ] เพิ่ม tests 90/91/180วัน: จำนวน request1/2/2, clocks/as_of/version เหมือนกันทุก chunk รวมวันปลายครั้งเดียว; chunk สุดท้าย1วันยัง1.2, retention watermark เปลี่ยนระหว่าง chunks ต้องใช้ค่าล่าสุดรวม microsecond ต่างกันใน millisecond เดียวกัน และ source failure กลางทางไม่แสดงยอดรวมเหมือนสำเร็จ
- [ ] Run focused contract/range/client tests ให้ FAIL ก่อนแก้
- [ ] ขยาย parser 1.2 และใช้ `dailyWindowBounds` หา first window start สำหรับ coverage; branch1.1 เท่านั้นอ่าน hourly; range1.2 ใช้ chunk loop เดิม; 4221.2 แสดงข้อความ unavailable ไม่ fallback
- [ ] Run `node --import ./tests/register-server-only.mjs --test tests/website-analytics-contract.test.ts tests/website-analytics-range.test.ts tests/website-analytics-client.test.ts tests/website-analytics-service.test.ts`; ต้อง PASS รวม legacy และ auth/rate/timeout tests
- [ ] เมื่ออนุมัติ commit ให้ commit `feat: consume daily time window reports`

## Task 3: กราฟรายวัน, snapshot, coverage และ comparison

**Files:** Modify `lib/website-analytics-chart.ts`, `lib/website-analytics-comparison.ts`, `server/services/website-analytics.ts`, `server/services/website-analytics-comparison.ts` ตามการไหลข้อมูล; feature files `site-trend-chart.tsx`, `website-period-detail-chart.tsx`, `site-summary-graph.tsx`, `site-period-comparison.tsx`, `daily-chart.tsx`, `period-comparison-summary.tsx`, `period-comparison-issues.tsx`, `view.tsx` เฉพาะจุดที่เลือกหน่วย/สร้าง label; Tests `website-analytics-chart.test.ts`, `website-analytics-comparison.test.ts`, `website-analytics-comparison-service.test.ts`, `website-analytics-comparison-render.test.ts`, `website-analytics-time-filter.test.ts`

**Interfaces:** เพิ่ม optional `asOf?:string` ท้าย `websiteChartData(...)`; timed multi-day callers ต้องส่ง snapshot ของ report และ missing snapshot ต้องไม่สรุปว่าศูนย์ครบช่วง; `websitePeriodSeries(site,range,asOf,metric)` signature เดิมใช้ daily bounds; comparison normalized missing clocks=00–24 สำหรับ daily; hourly path คงเดิม

- [ ] เขียน failing tests daily14–16 มีวันละ2และtotals6; snapshot16ต.ค.08:30 → วัน16เป็นnull,11:30 → current partial,18:00 → จบช่วงแล้วแม้ยังไม่เที่ยงคืน; retention08:59:59.999999→window09ใช้ได้/09:00:00.000001→gap
- [ ] เพิ่ม tests graph unit: multi+time ต้อง “รายวัน · ทุกวัน 09:00–18:00”; single ยังรายชั่วโมง; implicit monthly ยังเดิม; comparison clocks ไม่เท่ากันงด%, เวลาเท่ากัน/จำนวนวันเท่ากัน/coverageครบและจบแล้วจึงแสดง%; 1.0full day เทียบ1.2full dayได้
- [ ] Run focused chart/comparison/render tests ให้ FAIL ก่อน implementation
- [ ] เปลี่ยนจุดที่ตัดสิน hourly จากแค่มี clocks เป็น from==to พร้อม clocks; daily future/retention ใช้ helper Task1 และ snapshotจริง ส่ง asOf ผ่าน graph/detail paths โดยไม่ใช้เวลาจาก browser แทน snapshot
- [ ] คง totals/table/house ranking จาก filtered source; ปรับ labels/tooltips/status/requested end ของ recurring daily ให้ชัด รวมกรณี sourceไม่พร้อม
- [ ] Run focused tests ข้างต้นและ summary/service tests; ต้อง PASS; เมื่ออนุมัติ commit ให้ commit `feat: chart daily analytics within selected hours`

## Task 4: ช่องเวลาใต้ปฏิทินและ draft transaction

**Files:** Modify `components/ui/thai-date-range-picker.tsx`, `components/admin/dashboard/website-analytics/website-date-range-picker.tsx`, `website-time-range-filter.tsx`, `summary-range-filter.tsx`, `filters.tsx`, `dataset-controls.tsx` ตามจำเป็น; Tests `tests/website-analytics-time-filter.test.ts`, `tests/input-surfaces.test.ts`, `tests/dashboard.test.ts`

**Interfaces:** คง renderSelection/canConfirm/onOpenChange/valueSuffix slot props; ย้าย renderSelection เข้า calendar column ใต้ status; feature wrapperแสดง fields เมื่อ draft.from/to ครบและ Apply ส่ง clocks ทั้ง single/range ใช้ controlled fields เดิม

- [ ] เพิ่ม failing regression test เปิด selection slot ของ multi-dayแล้วต้องมีเวลาเริ่ม/สิ้นสุด, label “เวลาไทย · ใช้ช่วงเวลานี้ทุกวัน”, combined callback มี clocks; shared picker ไม่มี selection slot ยัง renderเหมือนเดิม
- [ ] Run time-filter/input-surfaces/dashboard tests ให้ FAIL ในเคสใหม่
- [ ] ย้าย slot ใต้ Calendar ในคอลัมน์ขวา; เอา singleDay gate ออกจากการแสดง/ส่งเวลา แต่คงใช้กำหนด label และหน่วย; canConfirm ตรวจเวลาทั้งสองโหมด; สรุป triggerทุกวันและ accessible full text; control32px
- [ ] ทดสอบ draftยังไม่ fetch, เปลี่ยนวันsingle↔rangeคงเวลา, ยกเลิก/Escape/outsideคืนทั้งวันเวลา, reopenค่าล่าสุด, primary/comparisonแยก, shortcutsและวันนี้/เมื่อวานกรองถูกต้อง
- [ ] Run focused regression และ typecheck; เมื่ออนุมัติ commit ให้ commit `feat: place recurring time controls under calendar`

## Task 5: End-to-end integration, browser และเอกสาร

**Files:** Modify `scripts/test-hourly-analytics-integration.mjs`, `docs/website-analytics.md`; reuse producer scripts/fixtureจาก Task2 ของ producer; generated `public/sw.js` หลัง build ตามระบบเดิม

**Interfaces:** Local integrationโหลด base+hourly+daily-window migrations จาก producer checkout แล้วเรียก real validator/guard/RPC → Webook parser/services ไม่ใช่ raw fixtureที่ข้าม owner

- [ ] เพิ่ม fixture events ขอบเวลา12–14ต.ค.ทั้ง3วันและ now/as_of=`2026-10-15T00:00:00.000Z` (ต้องไม่เกินเวลาจริงของ local DB); assert daily[2,2,2]/totals6 และ end18ไม่รวม/09รวม, full-day1.0/1.1regression, unauthorized401 และไม่สร้าง request-per-day
- [ ] Run `node --import ./tests/register-server-only.mjs scripts/test-hourly-analytics-integration.mjs <producer-checkout> <local-supabase_db_container>`; PASSและตรวจ cleanup DB; จำลองtenantเก่า4221.2/partial failureโดยไม่fallback
- [ ] Run `npm.cmd run verify`, `npm.cmd run build`; ต้อง exit0; รัน PWA regression ตามชุดเดิมเมื่อ generated workerเปลี่ยน ตรวจ diffให้มีเฉพาะงานนี้
- [ ] Browser desktopและviewport360/390/430px ด้วย componentจริง: ตรวจทุก entrypoint, single/range/apply/cancel/dismiss/invalid/24:00/comparison, request countขณะdraft=0, scrollถึงfields/footerและdropdownไม่ล้น; วัดcontrols32และลูกศร32×32 บันทึกภาพ+ผลวัด
- [ ] ใช้ viewport override ของ browserถ้ารองรับและ resetหลังทดสอบ; ถ้าใช้iframeให้ระบุในรายงาน ไม่อ้างว่าเป็นอุปกรณ์มือถือจริง
- [ ] Reviewทั้งสองโปรเจกต์กับ spec; อัปเดต docsเรื่องrecurringช่วงเวลา/version/URL/coverage/chunking/rolloutและสรุปสิ่งที่ทดสอบจริง
- [ ] ส่งแบบ/โค้ด/ผลตรวจให้ผู้ใช้ก่อน commit/PR/merge/deploy ขั้นต่อไป; producerพร้อมทุกtenantก่อน WebookStaging; Productionต้องขออนุญาตพร้อมยืนยันtargetตาม AGENTS.md

## วิธีดำเนินงานที่แนะนำ

ทำในแชตนี้ตามลำดับ Producer1–2 → Webook1–5 → reviewรวม เพราะต้องใช้ contract/fixturesร่วมกัน ถ้าผู้ใช้เลือกวิธี inline ให้คงวิธีนี้ไว้ เอกสารครั้งนี้เป็นแผนที่ยังไม่เริ่ม implementation ไม่ใช่ผลทดสอบสำเร็จ

## Execution result — 2026-10-16

Implementation and local verification completed. Checkboxes above retain the original detailed execution recipe; commit, PR and deployment steps remain deferred. See Webook docs/superpowers/reports/2026-10-16-daily-time-window-analytics.md for exact check results, browser scope and rollout dependency.
