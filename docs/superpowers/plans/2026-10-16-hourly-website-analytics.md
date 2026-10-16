# Hourly Website Analytics Consumer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. ใช้ inline execution เป็นแนวทางที่แนะนำ; ถ้าผู้ใช้เลือก delegation ค่อยใช้ superpowers:subagent-driven-development

**Goal:** ให้ Webook เลือกเวลาและแสดงสถิติรายชั่วโมงเมื่อเลือกวันเดียว โดยปุ่ม/input สูง 32px และใช้ยอดจริงจาก producer

**Architecture:** ขยาย types/query/parser/service เดิมเพื่อรองรับ producer contract 1.1 แล้วเพิ่มตัวเลือกเวลาที่ใช้ Select เดิม และปรับกราฟ/ชุดเปรียบเทียบให้รับ hourly series ส่วนรายวัน/รายเดือนและ business Dashboard ใช้ flow เดิม

**Tech Stack:** Next.js 16.3.8, React/TypeScript, existing Base UI Select/Button/Calendar, Recharts, Node.js Test Runner, OpenNext/Cloudflare

**Spec:** [แบบกลางสองโปรเจกต์](../specs/2026-10-16-hourly-website-analytics-design.md)

## Global Constraints

- เวลา `Asia/Bangkok`; `[start, end)`; เลือกทีละชั่วโมง ค่าเริ่มต้น `00:00`–`24:00`
- ปุ่มและ input/Select triggers สูง 32 CSS px; icon/remove/calendar arrows 32 × 32 CSS px
- ไม่เพิ่ม dependencies, tracker, visitor/session ID, ตาราง event ใหม่ หรือการเก็บข้อมูลส่วนบุคคล
- รายวัน/หลายวัน/ประวัติรายเดือนใช้ contract 1.0; วันเดียว request 1.1 และไม่ fallback เอารายวันมาสร้าง hourly
- คง allowlist/admin authorization/server-only credentials/concurrency สูงสุด 2; primary/comparison ใช้ snapshot เดียวกัน
- Primary/comparison time เป็นอิสระ และกราฟ/ตาราง/total view ใช้ช่วงเดียวกันของแต่ละ dataset
- ไม่ commit/push/deploy จนผู้ใช้สั่ง; Production ต้อง explicit authorization สำหรับ feature นี้

## Review Focus

1. เปิดลิงก์เก่า/refresh/เปลี่ยนเดือน/เลขหน้า ต้องไม่หลงเหลือหรือทำ time filter หาย — Task 1/3
2. Snapshot และ retention กลางชั่วโมงต้องแยก partial/อนาคตจากศูนย์จริง — Task 2/4
3. บางต้นทางยังเก่าหรือทั้งหมดล้มเหลว ต้องไม่วาดยอดทั้งวันบนแกนชั่วโมง — Task 2/4
4. เปรียบเทียบคนละเวลา/ความยาว/หน่วย ต้องแสดงแกนถูกต้องและไม่คำนวณ % ที่ทำให้เข้าใจผิด — Task 4
5. Mobile และ dialog/Select portal ต้องไม่ล้นหรือทับกัน แม้ค่าเวลา/สถานะยาว — Task 3/5

## ก่อนเริ่ม

- [ ] อ่าน spec และ [แผน producer](../../../../baan-pool-villa/docs/superpowers/plans/2026-10-16-hourly-site-analytics.md); ตรวจ git status/refs/worktree ทั้งสอง repo แล้วเก็บงานแยกกัน
- [ ] อ่าน AGENTS.md และ local Next guides `node_modules/next/dist/docs/01-app/01-getting-started/{05-server-and-client-components,15-route-handlers}.md` ก่อนเปลี่ยน Next code
- [ ] ใช้ branch/worktree ตาม execution method ที่ผู้ใช้เลือก; ไม่เปลี่ยน shared working tree ที่มีงานอื่น
- [ ] Local producer 1.1 ผ่านก่อน real integration; consumer unit tests ใช้ fixtures ได้ ไม่ต้องรอ Production deploy

## File Ownership

| Area | Files |
|---|---|
| Selection/time helpers | `lib/website-analytics-time.ts` (new), `lib/website-analytics.ts`, `lib/website-analytics-scope.ts` |
| Upstream trust boundary | `server/site-analytics/{report,client,range}.ts` |
| Orchestration | `server/services/website-analytics{,-comparison}.ts`, `server/site-analytics/route.ts` |
| Selection UI | `website-time-range-filter.tsx` (new), existing summary-range-filter/dataset-controls/filters |
| Charts/comparison | `lib/website-analytics-{chart,comparison}.ts`, existing trend/comparison chart/legend/issues/summary components |
| Wiring | Dashboard + website pages and summary-loader/summary/graph/detail view |

ชื่อไฟล์ component ในตารางนี้อยู่ภายใต้ `components/admin/dashboard/website-analytics/`; ไม่เพิ่ม service layer หรือ query framework ใหม่

## Task 1: Types, canonical time selection และ URL round trip

**Files:** Create `lib/website-analytics-time.ts`, `tests/website-analytics-time.test.ts`; Modify `lib/website-analytics.ts`, `lib/website-analytics-scope.ts`, `lib/website-analytics-comparison.ts`; Tests `website-analytics-{scope,contract,comparison}.test.ts`

**Interfaces:**
- `AnalyticsTimeRange { timeFrom: string; timeTo: string }` ใน helper ใหม่ ใช้ `import type` ไม่สร้าง runtime circular import
- `parseAnalyticsTimeRange(timeFrom: unknown, timeTo: unknown, range?: { from: string; to: string }): AnalyticsTimeRange | undefined`: ถ้าไม่ส่งทั้งคู่และวันเดียวคืน default; ไม่ส่งและหลายวันคืน undefined; กรณีส่งผิด throw `RangeError("invalid_time_range")` โดย helper ไม่ import runtime จาก website-analytics.ts กลับมา จุดรับ query ใน website-analytics.ts แปลงเป็น WebsiteAnalyticsError invalid_query/400; scope/page error boundaries แปลงเป็น invalid_query เช่นกัน
- `hourlyBounds(date: string, time: AnalyticsTimeRange, asOf: string): { start: string; end: string; effectiveEnd: string; buckets: { start: string; end: string }[] }`: inputs ต้องผ่าน canonical date/time validation; UTC strings normalized .000Z; buckets มีเฉพาะที่ start < effectiveEnd
- `AnalyticsPeriod = AnalyticsDailyPeriod | AnalyticsHourlyPeriod`; hourly มี contract_version=1.1, granularity=hour, from_time/to_time และ fields ร่วมเดิม; เพิ่ม AnalyticsHour และ hourly? ตาม spec
- ขยาย AnalyticsDateRange/WebsiteAnalyticsQuery/WebsiteDatasetSelection ด้วย optional timeFrom/timeTo; effective granularity hour เมื่อ explicit range เป็นวันเดียว

- [ ] เขียน tests `single day defaults to 00:00–24:00`, `Thai hourly bounds never use host timezone`, `rejects malformed or multi-day times`: assert 2026-10-15 09–18 => 02Z–11Z/9 buckets; 23–24=>16Z–17Z/1; as_of=02Z=>0 และ02:30Z=>1; reject minute/noncanonical/arrays/half pair/หลายวัน
- [ ] เพิ่ม URL tests: `websiteAnalyticsHref`/`websitePeriodHref` และ scope round trip คงเวลาเมื่อเปลี่ยน site/sort/search/page; reset page/pages เมื่อเวลาเปลี่ยน; month change ล้าง date/time; date+month ที่ตั้งพร้อมกันคง explicit range ใหม่; เปลี่ยนจากวันเดียวเป็นหลายวันไม่ serialize stale times
- [ ] เพิ่ม scope tests ว่า comparison time pair รับเฉพาะ single day และ primary time ไม่ถูกลบเมื่อ toggle visibility/comparison; URL เก่าที่มีวันเดียวและ granularity=day resolve เป็น hourly เต็มวัน แต่ fixtures ของ explicit upstream 1.0 ยังถูกต้อง
- [ ] Run `node --import ./tests/register-server-only.mjs --test tests/website-analytics-time.test.ts tests/website-analytics-scope.test.ts tests/website-analytics-contract.test.ts tests/website-analytics-comparison.test.ts`; ยืนยัน fail ใน assertions ใหม่ก่อน implement
- [ ] Implement helper/types/query/period/url builders ตาม interfaces โดยไม่แยกกรอบวัน/เวลาซ้ำในแต่ละ component และไม่เปลี่ยน dashboard booking query
- [ ] Run targeted tests เดิมให้ผ่าน; review normalization ไม่ silently ทิ้ง invalid external input

## Task 2: ตรวจ hourly contract และส่งต่อข้อมูลจริง

**Files:** Modify `server/site-analytics/{report,client,range,route}.ts`, `server/services/website-analytics.ts`, `server/services/website-analytics-comparison.ts`, `tests/fixtures/website-analytics.ts`; Test existing `website-analytics-{contract,client,range,service,comparison-service,route,integration}.test.ts`

**Interfaces:**
- คง `parseSourceReport(value: unknown, site: AnalyticsSite, period: AnalyticsPeriod): SourceReport`; branch ตาม period.contract_version; SourceReport.hourly?: AnalyticsHour[]
- คง `fetchSiteReport`, `readSiteRange`, `loadWebsiteAnalytics` signatures ที่รับ types เดิมซึ่งขยายแล้ว; readSiteRange 1.1 เรียก read ครั้งเดียว
- SiteFailureReason เพิ่ม hourly_unavailable; request1.1+HTTP422=>reason นี้ ส่วน 401/403/429/timeout/5xx/malformed 200 ใช้ reason เดิม ไม่ทำ fallback request 1.0
- WebsiteSummary.hourly/WebsiteAnalyticsReport.hourly ส่งข้อมูล normalized; WebsitePreviousPeriod.range คง time selection ของ comparison

- [ ] เพิ่ม fixtures `hourlyPeriod`, `hourlySource(site, period)` ที่ sum ถูกจริง โดยคง `period`/`source` 1.0 เดิมไว้ทดสอบ compatibility
- [ ] เพิ่ม parser tests `accepts complete hourly contract`, `rejects forged hourly response`, `accepts equivalent UTC encodings`: assert queryเวลา/วัน/site/version/granularity/as_of ตรง, hourly length ตาม bounds, unique starts, end-start=1h, on-boundary, safecounts, sumทุกmetric; reject missing/extra bucket/endผิด/negative/fractional/overflow/invalid date/response1.0ต่อrequest1.1 และ response1.1ต่อrequest1.0
- [ ] เพิ่ม service tests: hourly queryเดียวต่อsite, summed hourly/totalsตรง; allUnavailableไม่มีfakezero, mixed422กับsuccessยังเก็บstatusรายsite, ไม่มีadditional requestเพื่อdailyfallback, comparisonใช้เวลาอิสระและas_ofเดียว, concurrency<=2, long daily rangeยังแบ่ง90วัน
- [ ] เพิ่ม route tests: invalid time/multi-day=>400, anonymous/ownerยังถูกปฏิเสธก่อน fetch, repeated time parameterเป็นarrayถูกreject, admin successไม่เผย credentials
- [ ] Run `node --import ./tests/register-server-only.mjs --test "tests/website-analytics-*.test.ts"`; ตรวจ failure ของ cases ใหม่ก่อน implement
- [ ] Implement contract checks เทียบ timestamps เป็น instant พร้อม validate canonical/hour boundaries ก่อน normalize; require hourly rows เฉพาะ elapsed buckets; คง daily/villa/unattributed sum checks
- [ ] Implement forwarding/aggregation และ comparison ไม่ทำเวลาใหม่หายจาก summaryQuery/previous range; optional metadata/title reads คงเดิม; update hourly_unavailable render labels ทุก exhaustive map ที่เกี่ยวข้อง
- [ ] Run targeted suite ให้ผ่านทั้ง 1.0/1.1; ทดสอบ actual local producer report ผ่าน adapter ด้วย fixture credentials ที่ไม่ใช่ Production ตรวจ no-store และ identity ไม่ log body/token

## Task 3: ตัวเลือกเวลาและ page wiring ขนาด 32px

**Files:** Create `components/admin/dashboard/website-analytics/website-time-range-filter.tsx`, `tests/website-analytics-time-filter.test.ts`; Modify `summary-range-filter.tsx`, `dataset-controls.tsx`, `filters.tsx`, `site-summary-loader.tsx`, `site-summary.tsx`, `view.tsx`, `app/admin/dashboard/page.tsx`, `app/admin/dashboard/websites/page.tsx`; Tests existing `website-analytics-{ui,summary,comparison-render}.test.ts`

**Interfaces:**
- `WebsiteTimeRangeFilter({ idPrefix, value, pending, onApply }: { idPrefix: string; value: AnalyticsTimeRange; pending?: boolean; onApply: (value: AnalyticsTimeRange) => void })` controlled draft ใช้ Select default h-8 และ Button h-8; unique labels “เวลาเริ่ม”/“เวลาสิ้นสุด”, ปุ่ม “ใช้เวลา”
- Dashboard raw analyticsTimeFrom/To แปลงเข้า normalized selection; details/API raw timeFrom/To ใช้ parserเดียวกัน; ส่งเวลาและ as_of ครบถึง graph/summary
- SummaryRangeFilter รับ range ที่มีเวลา; DatasetControls รับ comparison มีเวลา; ทั้งคู่ navigateครั้งเดียวเมื่อApply และ preserve unrelated URL state

- [ ] เพิ่ม tests `time selector has 24 starts and 24 ends`, `applies once only after valid changed draft`, `calendar date changes preserve or clear times correctly`: start 00..23, end 01..24; pending/invalid/unchanged ใช้ไม่ได้; label ID primary/comparison ไม่ซ้ำ; วันเดียวคงเวลา, หลายวันล้าง; ปิดปฏิทินด้วยยกเลิกไม่ navigate
- [ ] เพิ่ม render/navigation tests: วันเดียวแสดงเวลาทั้ง Dashboard/รายละเอียด/comparison, หลายวันไม่แสดง; เพิ่ม comparison คัดลอก primary time ไปวันก่อนหน้า; เปลี่ยน comparison ไม่เปลี่ยน primary; pagination/house links คงเวลาที่เลือก; browser Back/refresh คงเวลาผ่าน URL
- [ ] Run `node --import ./tests/register-server-only.mjs --test tests/website-analytics-time-filter.test.ts tests/website-analytics-ui.test.ts tests/website-analytics-summary.test.ts tests/website-analytics-comparison-render.test.ts`; ยืนยันcasesใหม่failก่อนimplementation
- [ ] Implement controlled filter ใช้ existing Select/Button, flex-wrap/min-w-0/max-w-full, aria-busy/error; ไม่แก้ global primitive sizes หรือ shared booking picker API เพื่อเพิ่มเวลาในโมดูลอื่น
- [ ] Wire selectors/query state และ detail links ตาม spec; Dashboard Suspense/loading key ต้องติดตาม canonical analytics date/time/comparison scope โดยไม่ remount ตัวเก็บ metric/visibility เดิมเพียงเพราะเปลี่ยนเวลา และไม่มี cache ที่ใช้ชุดก่อนหน้าผิดช่วง
- [ ] Run targeted tests; invalid time page ต้องแสดงข้อความภาษาไทยที่ครอบคลุมเวลา ไม่ใช้ข้อความผิดพลาดเรื่องวันที่อย่างเดียว

## Task 4: กราฟรายชั่วโมงและ comparison ที่ไม่ปนหน่วย

**Files:** Modify `lib/website-analytics-chart.ts`, `lib/website-analytics-comparison.ts`; components `site-summary-graph.tsx`, `site-trend-chart.tsx`, `site-period-comparison.tsx`, `multi-site-period-trend-chart.tsx`, `period-comparison-summary.tsx`, `period-comparison-issues.tsx`, `site-period-total-chart.tsx`, `daily-chart.tsx`; Tests `website-analytics-{chart,comparison,comparison-render,redesign}.test.ts`

**Interfaces:**
- ขยาย `websiteChartData(sites, month, metric, period, range)` ให้ period รับ hour และคืน WebsiteChartPoint.date เป็น UTC bucketStartสำหรับhour; day/monthรักษาความหมายเดิม
- WebsitePeriodSeries เพิ่ม `granularity: "hour" | "day"`, `expectedBuckets: number`, `observedBuckets: number`, `durationMinutes: number`, `requestedEnd: string`; fields daily เดิมยังใช้กับ daily callers ได้ แต่ generic `points: {start:string;end:string;value:number|null}[]` เป็นข้อมูลที่ใช้จับคู่ทั้งสอง granularities
- websitePeriodSeries ใช้ hourlyBounds เมื่อวันเดียว; status complete เมื่อ snapshot >= requestedEnd และ coverage/rows/sums ครบ, ongoing เมื่อ snapshot < requestedEnd, partial/unavailable ตามข้อมูลจริง; ไม่ใช้ today ทั้งวันแทนเวลาจบ
- websitePeriodChange ให้ % เฉพาะ complete ทั้งคู่, granularity เท่ากันและ durationMinutes เท่ากัน; future/partial/zero baseline รักษา semantics เดิม
- pairWebsitePeriods จับคู่ตาม index และเก็บ start/end จริงทั้งคู่; mixed granularity ไม่ overlay แต่ใช้ trend สองกราฟเดิมแยกกัน; total view ใช้แต่ละ dataset totals

- [ ] เพิ่ม chart tests `hourly keeps zero observed and future/missing null`: 09–18 มี 9 positions ที่ UI, row 09=0 ยังเป็น 0, future positions เป็น null, watermark 09:30 ทำ row 09 เป็น null, malformed/missing elapsed rows ไม่กลายเป็น 0 และ connectNulls=false
- [ ] เพิ่ม comparison tests `completed hours today can compare`, `ongoing or unequal hours cannot produce percentage`, `hourly pairs by ordinal with true tooltip timestamps`, `mixed units render separate axes`: วันนี้ 09–10 กับ snapshot 11 เป็น complete ถ้า coverage ครบ; 09–18 กับ snapshot 10:30 เป็น ongoing; 9h กับ 8h งด %; 9h คนละวันจับคู่ 9 rows; hourly/day ไม่ทำ percent และไม่ส่งข้อมูลปนให้กราฟเดียว
- [ ] Run `node --import ./tests/register-server-only.mjs --test tests/website-analytics-chart.test.ts tests/website-analytics-comparison.test.ts tests/website-analytics-comparison-render.test.ts tests/website-analytics-redesign.test.ts`; ยืนยันfailก่อนแก้
- [ ] Implement chart transformation/labels/tooltip โดย reuse กราฟเดิม; rename units ตาม effective granularity และแสดงช่วงเวลาไทย; chart ไม่คำนวณ totals ใหม่และไม่ fetch เอง
- [ ] Implement comparison points/status/issues/legend และ total view ให้รองรับเวลา; mixed copy ตรง spec; tooltip ชั่วโมงปัจจุบันระบุ “ข้อมูลถึง HH:mm”; เก็บ local view/metric/visibility เมื่อเปลี่ยนเวลา
- [ ] Run targeted suite ให้ผ่าน; ตรวจทั้ง selected websites/hidden legend/no-data/422-only reports และ daily/monthly regressions

## Task 5: Verification, เอกสาร และ release handoff

**Files:** Modify `docs/website-analytics.md`, `public/sw.js` ตาม build:pwa; Create `docs/superpowers/reports/2026-10-16-hourly-website-analytics-verification.md` เมื่อมีผลจริง

- [ ] Review implementation diff กับ spec ทั้งสอง repo รวม API compatibility/security/half-open interval/UTC 24:00/URL state/32px และตรวจว่าไม่ได้เปลี่ยน business metrics
- [ ] Run `npm.cmd run build:pwa` หลัง product source เปลี่ยนก่อน `npm.cmd run verify`; ห้าม restore sw เก่าเพื่อทำ tree สะอาด แล้ว run `npm.cmd run build` และ `git diff --check`; บันทึกผลจริง รวม tests ที่ skip/fail และ warnings
- [ ] เปิด local production build กับ fixture/local producer ตรวจเลือกวันเดียว/09–18/23–24/หลายวัน/comparison 1 วัน-1 วัน/1 วัน-หลายวัน/total view/details/house pagination/back-refresh พร้อม loading/error/partial/allUnavailable/future; ไม่สร้าง event ทดสอบใน Production
- [ ] ตรวจ desktop และ mobile 360×800, 390×844, 430×932 ด้วยเบราว์เซอร์จริง วัด bounding rect หลัง animation หยุด: button/input/select height 32; icon/calendar arrows 32×32; document ไม่มี horizontal overflow; controls ที่เห็นไม่ซ้อน; dialog/tooltip/select popup อยู่ใน viewport และใช้งาน keyboard ได้ เก็บ screenshots และผล measurement
- [ ] ถ้า browser API ปรับ viewport ไม่ได้ให้บันทึก mobile acceptance ว่า pending และขอผู้ใช้ตั้ง viewport ห้ามใช้ผล desktop ยืนยัน mobile
- [ ] Update `docs/website-analytics.md` รอบ feature ใหม่: query fields/defaults/timezone/units/comparison/error/compatibility และข้อจำกัด ingestion time; verification report ระบุ environment/commit/commands/results/สิ่งที่ยังไม่ได้ทดสอบ
- [ ] หากผู้ใช้สั่ง commit ให้รวม generated sw และเฉพาะ feature files; แยก commit/PR ของสอง repo พร้อม producer dependency และ rollout order มิฉะนั้นส่ง working diff ให้ review

## Release Handoff (ไม่ใช่คำสั่ง deploy ในรอบจัดทำแผน)

- [ ] ตรวจ producer Staging 1.0/1.1 พร้อมและยืนยัน server allowlist/credential mapping ก่อน integration; registry ปัจจุบันชี้ public seller origins ไม่เปลี่ยนเป็น arbitrary endpoint จาก client
- [ ] Webook Staging deploy ผ่าน `npm run deploy:cf:staging` เมื่อผู้ใช้สั่ง ตรวจ Supabase `https://sxvkhzhqtrpxgzumsswl.supabase.co` / CF account `0df55f166fa309dcc904e992c43f86db` และ compiled bundle ไม่มี production ref
- [ ] ตรวจ CI/deploy และ browser จริงบน Staging หลัง deploy เมื่อได้รับ scope งานนั้น; consumer Production ต้องรอ producer 1.1 พร้อมครบห้า tenant และ explicit Production authorization ใหม่ ไม่ใช้คำยืนยัน release ก่อนหน้า

## สถานะการวางแผน

ผู้ใช้เลือก inline execution และดำเนิน implementation/local verification แล้ว ดู ../reports/2026-10-16-hourly-website-analytics-verification.md; ไม่ได้ commit, push, migrate online หรือ deploy และ release handoff ยังไม่ถูกดำเนินการ
