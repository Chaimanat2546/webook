# สถิติเข้าเว็บไซต์รายชั่วโมงและการเลือกช่วงเวลา

วันที่: 2026-10-16 (Asia/Bangkok)

สถานะ: ผู้ใช้อนุมัติแบบและแผนแล้ว ลงมือทำและตรวจ local implementation ทั้งสองโปรเจกต์ใน worktrees แยก ผลตรวจอยู่ใน ../reports/2026-10-16-hourly-website-analytics-verification.md ยังไม่มี online migration หรือ deploy

## 1. เป้าหมายและขอบเขต

เมื่อ admin เลือกวันที่เดียวในแนวโน้มประสิทธิภาพเว็บไซต์ของ Webook ให้เลือกเวลาเริ่ม–สิ้นสุดและดูกราฟรายชั่วโมงได้ ตารางและกราฟยอดรวมต้องใช้ช่วงเวลาเดียวกัน ใช้เวลาไทยตลอดสาย ปุ่มและ input รวมถึงตัวเลือกเวลาและลูกศรปฏิทินมีความสูง 32px; ปุ่มไอคอนมีขนาด 32 × 32px

ครอบคลุม `C:/Projects/baan-pool-villa` (producer API/SQL) และ `C:/Projects/webook` (consumer API/service/UI) รวมหน้า Dashboard, ชุดเปรียบเทียบ, หน้ารายละเอียดเว็บไซต์ และการคงตัวกรองเมื่อเปิดรายการบ้าน/เปลี่ยนหน้า ไม่เปลี่ยนความหมายสถิติยอดขาย/การจองของ Dashboard

หลายวันยังใช้รายวัน และโหมดประวัติรายเดือนยังทำงานเหมือนเดิม ไม่เพิ่ม dependencies, tracker, visitor/session ID, ตาราง event ใหม่ หรือการเก็บข้อมูลส่วนบุคคล งานนี้ไม่ใช้ House Workspace Shell เพราะเป็นโมดูล Dashboard

## 2. สิ่งที่ตรวจจากโค้ดในเครื่อง

- Producer: `lib/analytics/{types,validation,routes,server}.ts` รับ request แล้วเรียก RPC `public.analytics_report` ด้วย site ID จาก server config
- `supabase/migrations/20261006000000_create_site_analytics.sql` เก็บ `occurred_at timestamptz default now()` ของแต่ละ event และมี time index อยู่แล้ว เวลานี้เป็นเวลารับเข้าฐานข้อมูล ไม่ใช่เวลาที่ browser อ้างว่าเกิด event
- SQL รายงานปัจจุบันส่ง `totals`, `unattributed`, `daily`, `villas`, `coverage` และรับ contract `1.0` เท่านั้น Raw events มี retention 180 วันตาม cleanup เดิม
- Consumer: `server/site-analytics/report.ts` ตรวจ identity/query/ผลรวมก่อนรับข้อมูล; `range.ts` แบ่งช่วงยาวเป็นชิ้น 90 วัน; service จำกัด upstream concurrency 2
- กราฟ/ตัวกรองเดิมอยู่ใน `components/admin/dashboard/website-analytics`; มี Button, Input, Select สูง 32px และ Calendar ลูกศร 32 × 32px อยู่แล้ว
- ผลนี้มาจาก source ในเครื่อง ไม่ได้ยืนยัน schema/config ที่ใช้งานจริงของแต่ละ tenant

## 3. ตัวเลือกและข้อสรุป

เลือกขยาย `POST /api/analytics/v1/report` เดิมด้วย contract `1.1` สำหรับรายชั่วโมง โดยคง `1.0` สำหรับรายวัน ใช้ authorization, no-store, timeout และ quota เดิม

การสร้าง endpoint ใหม่เพิ่มเส้นทางและ guard ที่ต้องดูแลโดยไม่จำเป็น ส่วนการดึง raw events มารวมใน Webook เพิ่ม payload และข้ามเจ้าของข้อมูล จึงไม่เลือกสองแนวทางนี้

## 4. ความหมายของวันและเวลา

- ช่วงเวลาเลือกทีละชั่วโมง: เวลาเริ่ม `00:00`–`23:00`, เวลาสิ้นสุด `01:00`–`24:00` ต้องเริ่มก่อนสิ้นสุด ค่าเริ่มต้น `00:00`–`24:00`
- `24:00` ใช้ได้เฉพาะเวลาสิ้นสุด หมายถึงเที่ยงคืนของวันถัดไป ไม่ส่งวันที่ไม่ถูกต้องเช่น `...T24:00` ให้ Date parser
- ช่วงเป็นแบบรวมจุดเริ่ม ไม่รวมจุดสิ้นสุด `[start, end)` เช่น 09:00–18:00 มี 9 buckets (09–10 ถึง 17–18) event เวลา 18:00 พอดีไม่รวม
- ไม่รองรับช่วงข้ามคืนหรือเวลาเป็นนาทีในรอบนี้; หลายวันห้ามแนบ time fields
- `as_of` เป็น snapshot UTC เดียวกันของทุกเว็บไซต์และทั้งสองชุดเปรียบเทียบ ใช้เพดานข้อมูล `effectiveEnd = min(requestedEnd, as_of)` ไม่ใช้ `as_of` แทนตัวกรองเวลา
- เมื่อเวลาเลือกยังมาไม่ถึง ส่ง hourly ว่างและ totals เป็นศูนย์ตาม snapshot แต่แสดงสถานะ “ยังไม่ถึงช่วงเวลาที่เลือก” กราฟอนาคตเป็นช่องว่าง ไม่แสดงว่าเป็นยอดศูนย์ที่เก็บครบแล้ว

## 5. Producer contract

### Request

Contract `1.0` รับ fields/validation/ผลลัพธ์เดิมเท่านั้น ห้ามทำให้รายวันเดิมเปลี่ยนเป็นรายชั่วโมงโดยอัตโนมัติที่ upstream

```json
{
  "contract_version": "1.1",
  "from_date": "2026-10-15",
  "to_date": "2026-10-15",
  "timezone": "Asia/Bangkok",
  "as_of": "2026-10-16T04:00:00.000Z",
  "villa_id": null,
  "granularity": "hour",
  "from_time": "09:00",
  "to_time": "18:00"
}
```

`1.1` ต้องส่ง fields ตามนี้ครบ ไม่มี extra fields, from/to เป็นวันเดียวและไม่เกินวันของ as_of ตามเวลาไทย, เวลาเป็นชั่วโมงเต็มและเริ่มก่อนสิ้นสุด เงื่อนไข canonical date, villa ID และ as_of ไม่เกิน server clock 5 นาทีคงเดิม ไม่เพิ่มสิทธิ์หรือยอมรับ site ID จาก request

### Response

คง envelope เดิม โดย `contract_version` และ echoed `query` ตรง request เพิ่ม `hourly` เฉพาะ `1.1`:

```json
{
  "start": "2026-10-15T02:00:00.000Z",
  "end": "2026-10-15T03:00:00.000Z",
  "page_views": 12,
  "phone_clicks": 1,
  "chat_clicks": 0,
  "line_clicks": 2,
  "gallery_opens": 4
}
```

- แต่ละ row คือชั่วโมงตามเวลาไทยที่อยู่ในช่วงที่เลือก เก็บ start/end เป็น UTC instant (ตัวอย่างคือ 09:00–10:00 ไทย) Consumer normalize timestamp ที่ parse แล้วก่อนเทียบ รองรับ UTC `Z`/`+00:00` ตามรูปแบบเดิม ไม่เทียบ ISO string ดิบที่ fractional seconds ต่างกัน
- ส่ง rows เรียงเวลา ทุกชั่วโมงที่ `bucketStart < effectiveEnd` รวม bucket ปัจจุบันที่ยังไม่จบ ไม่ส่งชั่วโมงอนาคต; ถ้า effectiveEnd <= requestedStart ให้ส่ง `[]` สูงสุด 24 rows
- `end` คือปลายชั่วโมงที่ร้องขอ ส่วนข้อมูลใน bucket ถูกตัดที่ as_of หากยังไม่สิ้นสุด Tooltip ต้องบอก “ข้อมูลถึง HH:mm” เมื่อเป็นชั่วโมงปัจจุบัน
- ชั่วโมงที่ไม่มี event ในช่วงที่สังเกตแล้วมีค่าศูนย์จริง; ไม่ขาด row โดยเงียบ ๆ
- `daily` ใน `1.1` มี 1 row ของวันนั้นและเป็นยอดเฉพาะช่วงเวลาที่เลือก ไม่ใช่ทั้งวัน
- `totals = sum(hourly) = sum(daily) = sum(villas) + unattributed` ทุก metric ใน snapshot เดียวกัน; `contact_clicks` ยังคำนวณจาก phone+chat+line ใน Webook ตามเดิม
- `coverage.range_complete` เปรียบเทียบ requestedStart กับ watermark `data_available_from`; `rows_complete` คงความหมายเดิม การยังไม่จบช่วงเวลาแยกเป็นสถานะ ongoing ไม่ตีความจาก flag นี้อย่างเดียว
- Bucket ที่เริ่มก่อน watermark เป็น coverage ไม่ครบ แม้มีบาง event อยู่ใน bucket นั้น Consumer แสดงเป็นช่องว่าง/ข้อมูลไม่ครบ ไม่แปลงเป็นศูนย์และไม่ประมาณข้อมูลส่วนที่หาย ยอดรวมยังแสดงยอดจริงที่มีพร้อมข้อความข้อมูลไม่ครบ

### SQL และ compatibility

เพิ่ม migration ใหม่ `20261016000000_add_hourly_site_analytics.sql` และ idempotent patch `supabase/patches/20261016_hourly_site_analytics.sql` ที่มี DDL เดียวกัน ห้ามแก้ migration เดิม ใช้ `create or replace function private.analytics_report(p_query jsonb,p_site_id text)` โดยรักษา public invoker wrapper, ownership และ grants เดิม

คงเส้นทาง 1.0 และ validation เดิม; เพิ่มการตรวจ 1.1 ทั้งใน TypeScript และ SQL (RPC ต้องปฏิเสธ malformed request ได้เอง) Query base กรอง tenant, villa, start/effectiveEnd ก่อน aggregate เพียงชุดเดียว สร้าง hourly ด้วย generate_series และ left join ไม่คืน raw events ไม่เปลี่ยน insert/retention function

Health `contract_version: 1.0` เดิมยังตอบได้และไม่จำเป็นต้องเพิ่ม capability probe การตรวจรองรับรายชั่วโมงใช้ report 1.1 จริงเพื่อไม่เพิ่ม round trip ทุกครั้ง

## 6. Consumer data flow และ URL

ใช้ `AnalyticsTimeRange { timeFrom: string; timeTo: string }` และเพิ่ม optional `timeFrom`/`timeTo` ใน `AnalyticsDateRange`, `WebsiteAnalyticsQuery` และช่วงใน `WebsiteDatasetSelection` ทั้งคู่ต้องมีพร้อมกันเมื่อส่งจาก URL

- Dashboard ใช้ `analyticsTimeFrom`/`analyticsTimeTo` คู่กับ `analyticsFrom`/`analyticsTo`
- รายละเอียดเว็บไซต์และ admin reporting API ใช้ `timeFrom`/`timeTo` คู่กับ `from`/`to`; comparison ใช้ fields เดียวกันใน `analyticsScope.comparison`
- วันที่เดียวที่ไม่มี time fields ให้ normalize เป็นเต็มวันและ request contract 1.1 อัตโนมัติ แม้ URL เก่าระบุ granularity=day; explicit multi-day/monthly ยังคง 1.0
- เพิ่ม `granularity: hour` ใน internal query ที่จำเป็น; hourly ต้องมี explicit from/to ที่เป็นวันเดียว ห้ามใช้ month เพื่อเดาวัน
- Time fields ที่ไม่ครบ, ผิดรูปแบบ, ช่วงกลับด้าน, ซ้ำเป็น array หรือใช้กับหลายวัน ให้ invalid_query (HTTP 400 ใน API และข้อความผิดพลาดของหน้า) ไม่ silently ทิ้งค่า
- เมื่อเปลี่ยนวันเดียวเป็นวันเดียว คงเวลาเดิม; เมื่อเปลี่ยนเป็นหลายวัน/เดือน ล้างเวลา ชุดเปรียบเทียบเก็บเวลาเป็นอิสระไม่ถูกเปลี่ยนตามชุดหลัก
- การเพิ่มชุดเทียบสำหรับวันเดียว เลือกวันก่อนหน้าและคัดลอกเวลาเดิม; การเปลี่ยน comparison เป็นหลายวันล้างเฉพาะเวลาของ comparison
- URL builders ต้องคงเวลาเมื่อเปลี่ยน metric/เว็บไซต์/เรียง/ค้นหา/เลขหน้า; การเปลี่ยนวันหรือเวลาต้อง reset pagination; เปลี่ยน month ล้าง from/to/time ตามเดิม แต่ค่า month ที่ส่งพร้อม explicit range ต้องไม่ทำให้ range ใหม่หาย
- Dashboard global booking/date filters ไม่อ่าน time fields ของ analytics; explicit analytics range ไม่เปลี่ยนตาม business range

เพิ่ม discriminated union `AnalyticsPeriod = AnalyticsDailyPeriod | AnalyticsHourlyPeriod` (`1.0` หรือ `1.1` ตาม request) และ `AnalyticsHour extends AnalyticsMetrics { start: string; end: string }` เพิ่ม `hourly?` ใน SourceReport, WebsiteSummary และ WebsiteAnalyticsReport

`parseSourceReport` ตรวจ contract, site, echoed date/time/granularity/as_of, UTC bucket boundaries, จำนวน rows ตาม effectiveEnd, duplicate/missing/out-of-range rows, safe integers และผลรวมทุกชุดก่อนรับ ช่วง hourly อ่านครั้งเดียวไม่เข้า loop chunk รายวัน; ช่วงยาวยังแบ่งชิ้นเหมือนเดิม

`loadWebsiteAnalytics` ส่งต่อ hourly และ aggregate ตาม start/end จริง; comparison orchestration ใช้ snapshot เดียวและคง concurrency สูงสุด 2 ไม่โหลดรายวันซ้ำเพื่อประกอบกราฟรายชั่วโมง

### ต้นทางที่ยังไม่พร้อม

เพิ่ม SiteFailureReason `hourly_unavailable` เมื่อ request 1.1 ที่ผ่าน local validation ได้ HTTP 422 (server รุ่นเก่าอาจตอบ INVALID_QUERY ก่อนตรวจ contract เพราะมี fields ใหม่) Copy: “เว็บไซต์นี้ยังไม่พร้อมให้ข้อมูลรายชั่วโมง” ไม่ฟันธงว่าเป็นรุ่นเก่าจาก status เพียงอย่างเดียว

401/403, 429, timeout, 5xx และ response ไม่ผ่าน contract คง reason เฉพาะเดิม ไม่เปลี่ยนเป็น hourly_unavailable ไม่ retry อัตโนมัติเป็น 1.0 และไม่นำยอดรายวันไปวางบนแกนชั่วโมง ถ้าบางเว็บพร้อม แสดงข้อมูลจริงเฉพาะเว็บที่พร้อมพร้อมสถานะรายเว็บ

## 7. UI และกราฟ

ใช้ `components/ui/select.tsx` เดิม (default size h-8), Button และ ReportDateRangePicker ไม่เพิ่ม time-picker library แสดงตัวเลือก “เวลาเริ่ม” / “เวลาสิ้นสุด” และปุ่ม “ใช้เวลา” ภายนอกปฏิทิน ใต้หรือข้างปุ่มวันที่ เฉพาะช่วงที่เป็นวันเดียว

สร้าง `WebsiteTimeRangeFilter` แบบ controlled draft ที่ใช้ซ้ำในชุดหลัก, comparison และหน้ารายละเอียด Props: `idPrefix`, `value: AnalyticsTimeRange`, `pending?: boolean`, `onApply(value)`. เปลี่ยน Select เป็น draft ก่อน กดใช้เวลาจึง navigate ครั้งเดียว ปุ่ม disabled เมื่อ draft ไม่เปลี่ยน/ไม่ถูกต้อง/กำลังโหลด และมี error ภาษาไทยที่ผูกกับ controls ไม่มีการส่ง request ทุกครั้งที่สลับเวลาเริ่ม

ปุ่มและ input/Select triggers ทั้งหมดใน flow นี้สูง 32 CSS px; icon/remove/calendar arrows 32 × 32 CSS px ใช้ flex-wrap, min-w-0, max-w-full บนมือถือ Labels ต้องชัดและ ID ไม่ซ้ำระหว่างสองชุด ปุ่มใช้คีย์บอร์ดได้ สถานะ pending/invalid อ่านได้ด้วย screen reader

กราฟเดิมปรับให้รองรับ hourly โดยใช้ timestamp เป็น key; แกนแสดง HH:mm Tooltip แสดงวันที่ไทยและช่วง HH:mm–HH:mm พร้อม snapshot สำหรับ bucket ปัจจุบัน เปลี่ยนชื่อ “แนวโน้มรายวัน” เป็น “แนวโน้มรายชั่วโมง” และ “ครั้งต่อชั่วโมง” เมื่อเป็นวันเดียว คงสี/legend/metric/การซ่อนเว็บและการแยก null/zero เดิม

ไม่แสดงเส้นข้าม bucket ที่ข้อมูลหาย/ก่อน coverage/อนาคต ตารางและ total view อ่าน totals ของช่วงที่เลือกจาก report เดียวกัน ไม่ดึง daily totals มาปน

### ชุดเปรียบเทียบ

- ทั้งสองชุดเป็นรายชั่วโมง: จับคู่ตามลำดับ bucket ภายในแต่ละช่วง (ชั่วโมงที่ 1, 2, …) ไม่ join ด้วย UTC timestamp ที่เป็นคนละวัน Tooltip แสดงวันและช่วงเวลาจริงทั้งสองชุดพร้อมกัน ถ้าจำนวนชั่วโมงไม่เท่ากันเติม null เฉพาะปลายที่ไม่มี bucket
- ทั้งสองชุดเป็นรายวัน: คงการจับคู่ตามลำดับวันเดิม
- ชุดหนึ่งรายชั่วโมง อีกชุดรายวัน: แสดง trend สองกราฟแยกกันด้วยแกน/หน่วยที่ถูกต้อง มีข้อความ “ช่วงที่เลือกใช้หน่วยเวลาต่างกัน จึงแสดงกราฟแยกกัน” ไม่ overlay วันกับชั่วโมงบนแกนเดียว ยอดรวมเทียบกันยังแสดงได้โดยงด %
- ผลต่าง % คำนวณได้ต่อเมื่อทั้งสองชุดครบ, elapsed ถึง requestedEnd แล้ว, มี granularity และ requested duration เท่ากัน ชั่วโมงที่ผ่านไปแล้วของวันนี้จึง complete ได้ ไม่ใช้กฎ range.to >= today ของรายวันเดิมกับ hourly
- เวลาหรือ duration ต่างกันต้องแสดงใน legend/summary ชัดเจน และงด % เมื่อ duration ต่างกัน; สถานะ ongoing/partial/unavailable ไม่คำนวณ % แม้มีตัวเลข

## 8. การทดสอบและเกณฑ์รับงาน

Producer: unit tests validation/route, SQL tests บน DB แยกที่สร้างเอง, role/tenant denial และ v1.0 regression ต้องผ่าน ใช้ events ที่ start-1ms, start, end-1ms, end, ไทย 23:00/24:00, as_of กลางชั่วโมง/ตรงต้นชั่วโมง/ก่อนเวลาเริ่ม, watermark กลางชั่วโมง และผลรวมทุก metric ทดสอบ migration/patch ซ้ำโดยไม่ลบข้อมูลหรือเปลี่ยน grants

Consumer: parser tests และ service fixture ของ 1.0/1.1/ต้นทางเก่า, timestamp normalization, clock boundary/null-vs-zero, comparison duration/หน่วยต่างกัน, URL round trip และ pagination ต้องผ่าน กรณีทั้งหมด unavailable ต้องไม่สร้างจุดศูนย์ปลอม

Full checks: producer Vitest + ESLint + TypeScript + Next build; Webook `npm.cmd run verify` + `npm.cmd run build` และ regenerate public/sw.js ก่อน verify ที่มี PWA reproducibility check หาก source fingerprint เปลี่ยน

Browser acceptance: เลือกวันเดียว/เวลาเต็มวันและ 09:00–18:00, สลับหลายวัน, เปิด comparison/รายละเอียด/บ้านทั้งหมด/กลับหน้าเดิม, error/loading/partial/future/no-data, tooltip และลูกศรเดือน ตรวจ desktop และ mobile 360 × 800, 390 × 844, 430 × 932 CSS px วัดจริงหลัง animation หยุด: controls 32px, icon 32 × 32px, page scrollWidth <= clientWidth, dialog อยู่ใน viewport และ controls ที่เห็นไม่ทับกัน ตารางที่ออกแบบให้เลื่อนภายในอาจมี scrollWidth มากกว่า container ได้โดยไม่ทำให้ทั้งหน้าล้น

หากเครื่องมือ browser ปรับ viewport ไม่ได้ ให้รายงาน responsive acceptance ว่ายังค้างและให้ผู้ใช้ตั้ง viewport; ห้ามใช้ผล desktop แทน mobile หรือกล่าวว่าผ่านโดยไม่มีหลักฐาน

## 9. Rollout และ rollback (ขั้นตอนในอนาคต)

1. ตรวจ refs/working trees และทำ implementation/tests ใน branch แยกของแต่ละ repo โดยรักษางานเดิม ไม่ commit/push/deploy จนผู้ใช้สั่ง
2. ทดสอบ migration และ API producer ใน local/disposable DB ก่อน จากนั้นเมื่อได้รับงาน deploy ให้เลือก tenant Staging ที่ยืนยันเป้าหมายแล้ว Apply เฉพาะ patch/migration ใหม่และ deploy producer Staging แล้วตรวจ report 1.0 + 1.1 จริง
3. ชื่อ mapping เดิมของ producer คือ baanparty/baan02/baanPMhee/flukNasa/villaMedia; ไม่ใช้ Supabase ของ Webook หรือ shared catalog เป็นฐานข้อมูล events ห้ามสมมติว่า Webook Staging เรียก seller Staging อยู่แล้ว registry ปัจจุบันมี public seller origins ต้องตรวจ routing/allowlist/credential mapping ก่อน integration และใช้ fixture/local upstream จนกว่ามีเป้าหมายทดสอบที่ชัดเจน ห้ามเปลี่ยน endpoint จาก client input
4. ทดสอบ Webook Staging หลัง producer พร้อม deploy Webook ผ่าน `npm run deploy:cf:staging` เท่านั้น เป้าหมาย Supabase `https://sxvkhzhqtrpxgzumsswl.supabase.co`, Cloudflare account `0df55f166fa309dcc904e992c43f86db` ตรวจ compiled bundle staging ref และไม่มี production ref
5. Production เป็นงานแยกที่ต้องขออนุญาตตาม AGENTS ก่อนทุกครั้ง Producer มี master-push workflow พร้อม migration gate ครบห้า tenant จึงต้องถือการ merge เข้า master เป็น production action เช่นเดียวกัน ต้อง rollout producer/migrations ครบทุก tenant และตรวจ 1.0/1.1 ราย target ก่อนเปิดใช้ consumer Production
6. Rollback consumer ได้โดยกลับไป client รายวัน; producer 1.1 คงรองรับ 1.0 จึงไม่ต้องถอน SQL ห้าม drop ตาราง/ลบ events/ย้อน migration ที่ทำให้ข้อมูลหาย ระหว่าง deploy บาง tenant ไม่พร้อมต้องแสดง hourly_unavailable แยกรายเว็บ

ไม่มีคำสั่งในเอกสารนี้เป็นการอนุมัติ Production deploy และการอนุญาตจากงาน release ก่อนหน้าไม่ถูกนำมาใช้กับ feature ใหม่นี้

## 10. แผนที่ใช้คู่กัน

- Producer: [แผน baan-pool-villa](../../../../baan-pool-villa/docs/superpowers/plans/2026-10-16-hourly-site-analytics.md)
- Consumer: [แผน Webook](../plans/2026-10-16-hourly-website-analytics.md)

แผนทั้งสองอ้างอิง contract ในเอกสารนี้เป็นข้อสรุปเดียวกัน ไม่ทำสำเนา contract ที่แก้แยกกัน
