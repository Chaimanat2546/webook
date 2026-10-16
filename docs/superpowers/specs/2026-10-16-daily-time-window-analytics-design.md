# แบบเลือกวันและช่วงเวลาเดียวกันทุกวัน — Webook

วันที่: 2026-10-16 (Asia/Bangkok)
ฐานออกแบบ: Staging merge PR #99 (`c688db4`)
สถานะ: ลงมือทำและทดสอบ local แล้วตามคำยืนยันผู้ใช้; ยังไม่ commit/PR/deploy หรือใช้ migration บน remote

## ข้อตกลงกับภู

เลือก 14–16 ต.ค. เวลา 09:00–18:00 หมายถึงนับเฉพาะ 09:00–18:00 ของวันที่ 14, 15 และ 16 แยกกัน ไม่รวมกลางคืน โดยย้ายช่องเวลาเข้าไปอยู่ใต้ปฏิทินโดยตรงในคอลัมน์เดียวกัน คง control สูง 32px และลูกศร 32 × 32px

ใช้ Calendar/Select/Button/Input และ popup เดิม ไม่มี dependency ใหม่ ไม่ใช้ House Workspace Shell เพราะเป็นตัวกรองในโมดูล Dashboard

## หน้าจอและ interaction

Desktop วางทางลัดด้านซ้าย ปฏิทินด้านขวา และเวลาเริ่ม/สิ้นสุดใต้ปฏิทินด้านขวา ไม่พาดเต็มความกว้างใต้ทางลัด ส่วน mobile เรียงทางลัด → ปฏิทิน → เวลา → footer ยืนยัน ป๊อปอัปเลื่อนภายในได้และ footer “ยกเลิก / ใช้” คงอยู่ด้านล่าง

- เลือกวันต้นและวันท้ายครบแล้วแสดงปุ่ม “ระบุช่วงเวลา” ใต้ปฏิทิน ทั้งวันเดียวและหลายวัน; ค่าเริ่มต้นไม่เลือก หมายถึงเต็มวัน 24 ชั่วโมง และแสดงช่องเวลาเฉพาะเมื่อเปิดตัวเลือก
- หลายวันใช้คำกำกับ **“เวลาไทย · ใช้ช่วงเวลานี้ทุกวัน”**; วันเดียวใช้ “เวลาไทย · กราฟรายชั่วโมง”
- ค่าเริ่มต้น 00:00–24:00; ช่วงเวลาแก้ทีละชั่วโมงและเริ่มต้องน้อยกว่าสิ้นสุด 24:00 ใช้ได้เฉพาะเวลาสิ้นสุด ไม่รองรับข้ามคืน
- ปิด “ระบุช่วงเวลา” จะรีเซ็ต draft เป็น 00:00–24:00; URL ที่มีช่วงเวลาแคบกว่านั้นเปิดตัวเลือกให้อัตโนมัติ ส่วน 00:00–24:00 แสดงเป็นเต็มวัน
- เปลี่ยนจากวันเดียวเป็นหลายวันหรือกลับกันให้เก็บเวลา draft เดิม ไม่ล้างเวลาเมื่อวันที่ต่างกัน
- Apply ครั้งเดียวส่งวันและเวลาไปด้วยกัน; แก้ draft ไม่ยิง API; ยกเลิก/Escape/คลิกด้านนอกทิ้ง draft ทั้งสองส่วน และ reopen ใช้ค่าที่ commit ล่าสุด
- ระหว่างเลือกวันยังไม่ครบ ช่วงเวลาผิด หรือ pending ให้ปิด Apply; วันอนาคตเลือกไม่ได้
- Trigger สรุปวันและเวลา เช่น `14 ต.ค. 2569 – 16 ต.ค. 2569 · ทุกวัน 09:00–18:00`; บนหน้าจอแคบ truncate ได้และมี accessible text/title เต็ม
- ใช้ component เดียวกันทั้ง Dashboard, ชุดเปรียบเทียบ, ภาพรวมเว็บไซต์ และรายการบ้าน; clock ของแต่ละ dataset เป็นอิสระ

## ข้อมูลและกราฟ

| การเลือก | Upstream contract | กราฟ |
| --- | --- | --- |
| เดือน/หลายวันเดิมที่ไม่มี time fields | 1.0 | รายวันเต็มวัน; ประวัติรายเดือนเดิมคงอยู่ |
| วันเดียวแบบ explicit | 1.1 | รายชั่วโมง ค่าเริ่มต้น 00:00–24:00 |
| หลายวันพร้อม time fields | 1.2 / granularity=day | รายวัน แต่ละจุดนับเฉพาะช่วงเวลาที่เลือกของวันนั้น |

เมื่อเปิด popup หลายวันเดิม ให้ draft เริ่ม 00:00–24:00 และเมื่อ Apply จึงบันทึกเป็นการเลือกเวลา explicit 1.2 แม้เต็มวัน ห้ามเปลี่ยน URL เก่าให้เป็น request แบบใหม่เพียงแค่ render

1.2 รับ field set เดียวกับ 1.1 แต่ `contract_version=1.2`, `granularity=day` และอนุญาตหลายวัน Response ไม่มี `hourly` ใช้ totals/daily/villas/unattributed/coverage เดิม ข้อตกลงรายละเอียดและ SQL อยู่ในเอกสารชื่อเดียวกันของ baan-pool-villa

คง URL เดิม `analyticsFrom/analyticsTo/analyticsTimeFrom/analyticsTimeTo` บน Dashboard, `from/to/timeFrom/timeTo` ในหน้ารายละเอียด/API และ clocks ใน `analyticsScope.comparison` ไม่มี mode ใหม่ใน URL เพราะความหมายหลายวันพร้อมเวลาเป็น “ทุกวัน” เท่านั้น

ลิงก์ search/sort/site/pagination/back และการเปลี่ยนวันต้องรักษาเวลา การเปลี่ยนเดือนล้วนยัง reset explicit range ตามพฤติกรรมเดิม การเลือกหลายวันไม่ลบ clock fields อีกต่อไป; explicit granularity=hour กับหลายวันต้องปฏิเสธ ไม่ส่งรายชั่วโมงหลายวันโดยเงียบ

## Consumer validation, aggregation และ coverage

- แบ่งช่วง 1.2 ทีละ 90 วันรวมต้นท้าย เหมือน 1.0; คง clocks/version/snapshot แม้ chunk สุดท้ายเหลือวันเดียว คง concurrency สองเว็บไซต์ ไม่สร้าง request แยกวัน
- ตรวจ version/site/query echo รวม granularity และ clocks, วันที่ daily ครบไม่ซ้ำ, safe counts และ `sum(daily)=totals=sum(villas)+unattributed` ทุก chunk; วันก่อน window start ตาม as_of ต้องมี metrics ศูนย์ทุกตัว มิฉะนั้น reject
- เว็บไซต์ที่ยังไม่รองรับ 1.2 ตอบ 422 ให้สถานะ `time_range_unavailable` และข้อความ “เว็บไซต์นี้ยังไม่พร้อมกรองช่วงเวลารายวัน” ไม่ fallback เป็นยอดเต็มวัน; auth/rate limit/timeout/invalid-report แยกเหมือนเดิม
- ทุกบริการรวมผลใช้ snapshot เดียวกันและ filtered source เดียวกัน กราฟ/ตาราง/อันดับบ้าน/ยอดรวมไม่กรองคนละชั้น
- สร้าง helper กลาง `dailyWindowBounds(date, time)` เพื่อหา start/end UTC ของแต่ละวัน และ `isFutureAnalyticsRange` ใช้เวลาเริ่มวันแรก ไม่สรุปว่าทั้งช่วงเป็นอนาคตเพียงเพราะวันท้ายยังไม่เริ่ม
- วันวันนี้ก่อนเวลาเริ่มเป็น null/gap แม้ API ส่ง zero; ระหว่างช่วงแสดงยอดถึง as_of พร้อมคำอธิบายว่าข้อมูลยังไม่ครบ; หลังเวลาสิ้นสุดของวันนี้ถือว่าจบช่วงได้ ไม่ต้องรอเที่ยงคืน
- วันก่อนหรือคร่อม retention watermark เปรียบเทียบ timestamp เริ่มของ window แบบ microsecond; window เริ่มหลัง watermark ในวันเดียวกันใช้ได้ กราฟไม่แปลงข้อมูลที่ขาดเป็นศูนย์
- ครบช่วงและ coverage ครบจึงเปรียบเทียบ %; รายวันต้องมีจำนวนวันและ clock window ตรงกัน (เต็มวัน 1.0 เทียบ 1.2 00:00–24:00 ได้) ช่วงเวลาไม่เท่ากันยังดูยอดแยกกันพร้อมคำอธิบาย รายชั่วโมงเดิมคงกฎเดิม

## เจ้าของไฟล์

- `components/ui/thai-date-range-picker.tsx`: ย้าย selection slot เข้าใต้ปฏิทิน โดย default ของ picker ที่ไม่ใช้ slot คงเดิม
- `website-date-range-picker.tsx`, `website-time-range-filter.tsx` ใน feature: draft, validation, label, 32px; ไม่เอา business logic ใส่ generic UI
- `lib/website-analytics*.ts`: time helper/type/query/URL/chart/comparison/scope ตามเจ้าของเดิม
- `server/site-analytics/{report,range,client}.ts`: source validation, chunking, failure mapping
- `server/services/website-analytics*.ts`: รวมข้อมูลจาก period ที่ถูกต้อง; ไม่รับ arbitrary tenant endpoint
- feature chart/status components: เลือกหน่วยจากวันเดียวจริง ไม่ใช้เพียง “มี time fields” และแสดงคำกำกับทุกวัน
- `docs/website-analytics.md` และ integration runner: อัปเดตพฤติกรรม/ตัวอย่างและทดสอบ producer SQL จริง

## Acceptance และลำดับส่งมอบ

Unit/contract tests ครอบคลุม 1.0/1.1 เดิมและ 1.2, chunk 90/91/180 วัน, snapshot, coverage, query spoofing, clock persistence และการเปรียบเทียบต่างช่วงเวลา Integration ใช้ disposable local PostgreSQL และ synthetic events ที่ขอบเวลาเหมือน producer ห้ามเขียน tenant DB จริงเพื่อทดสอบ

Browser checks ใช้ UI จริง: ทุก entry point, single↔range, Apply/cancel/Escape/outside, ไม่เรียก API ขณะ draft, validation, end=24, comparison อิสระ; วัด 32px/ลูกศร 32×32 และตรวจ desktop + viewport 360/390/430px ไม่ล้น/ซ้อน ช่องเวลาอยู่ใต้ปฏิทินและ footer ไม่บัง fields เมื่อเลื่อนถึงล่าง

ทำ API/SQL producer ก่อน → ตรวจ 1.2 พร้อมทุก allowlisted tenant → Webook Staging → ตรวจเว็บจริง → พิจารณา Production ภายหลังตามคำอนุญาตใหม่ งานเอกสารครั้งนี้ไม่รวม commit/PR/merge/deploy/apply migration

แผน Webook: [implementation plan](../plans/2026-10-16-daily-time-window-analytics.md)
