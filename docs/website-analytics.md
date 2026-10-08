# สถิติเข้าเว็บไซต์

หน้า `/admin/dashboard/websites` และ `GET /api/admin/website-analytics` อ่าน collector ของเว็บผู้ขายผ่านเซิร์ฟเวอร์ Webook เท่านั้น ใช้ session Supabase ที่ยืนยันตัวตนแล้วและ `users.role_id = 1` จาก uid โดยตรง เจ้าของบ้านและบัญชีทั่วไปไม่มีสิทธิ์

## การตั้งค่าฝั่งเซิร์ฟเวอร์

ใส่ secret ต่อไปนี้ใน environment ของ Webook แต่ละ deployment โดยใช้ค่าที่ตรงกับ `ANALYTICS_REPORT_READ_TOKEN` ของต้นทาง ห้ามตั้งชื่อขึ้นต้น NEXT_PUBLIC หรือส่งให้ client component

| ชื่อ secret ใน Webook | ต้นทาง |
| --- | --- |
| ANALYTICS_REPORT_TOKEN_BAANPARTY | https://www.baanpartypattaya.com |
| ANALYTICS_REPORT_TOKEN_POOLVILLAPATTAYA | https://www.poolvillapattaya.co.th |
| ANALYTICS_REPORT_TOKEN_BAANPMHEE | https://www.pmheevilla.com |
| ANALYTICS_REPORT_TOKEN_FLUKNASA | https://nasapoolvilla.com |
| ANALYTICS_REPORT_TOKEN_PUKMOOD | https://pukmoodpoolvilla.com |

Local development ใช้ `.env` ที่ถูก git-ignore; Cloudflare ใช้ secret bindings ของ Worker Webook ใน environment ที่ต้องการ ตัวอ่านลอง server environment ก่อน Cloudflare context ไม่ต้องแก้ DB หรือเผยแพร่ token ใน vars ของ wrangler ไฟล์นี้ไม่บันทึกค่า secret

registry ใช้ site_id เดียวกับ `server/central-user-manager/tenant-bindings.ts` แต่แยก credentials ออกจาก Central User Manager ค่า endpoint เป็น HTTPS allowlist ตายตัว ไม่รับ URL/token จาก browser ไม่มี redirect และเรียกพร้อมกันไม่เกินสองเว็บ จำกัด 10 วินาทีรวมอ่าน body และ response 3 MiB ไม่มี polling/retry อัตโนมัติ

ต้องตั้ง secrets ใน Staging/Production แยกจาก local ก่อนใช้จริง ไม่มีการ deploy หรือ provision remote secrets โดยอัตโนมัติ ขั้นตอน deploy ต้องทำตาม AGENTS.md

## API ของ Webook

ตัวอย่างคำขอจาก browser ของแอดมินที่ล็อกอินอยู่:

```js
const response = await fetch(
  '/api/admin/website-analytics?month=2026-10&site=fluknasapoolvilla&page=1',
  { credentials: 'same-origin', cache: 'no-store' },
);
const report = await response.json();
```

- month: YYYY-MM ไม่เกินเดือนปัจจุบันตาม Asia/Bangkok; ค่าเริ่มต้นเดือนนี้
- site: `all`, `baanparty`, `poolvillapattaya`, `baanpmhee`, `fluknasapoolvilla`, `villamediapoolvilla`
- page: pagination ตารางรวมใน API เดิม (คงไว้ให้ผู้เรียกเดิม)
- page_<site key>: แบ่งหน้าตารางแยกเว็บ เช่น `page_fluknasapoolvilla=2`; หน้าละ 10 บ้าน เปลี่ยนเดือน/เว็บไซต์จะ reset ทุกหน้า ยอดรวม/กราฟไม่เปลี่ยนตามหน้า
- view: `houses` เปิดรายการบ้านทั้งหมดพร้อมแบ่งหน้า; ไม่ระบุเป็นภาพรวม 5 อันดับแต่ละเว็บ หน้าเว็บภาพรวมเริ่มอันดับแรกเสมอแม้ URL เก่ามีเลขหน้า
- granularity: `day` (ค่าเริ่มต้น) หรือ `month` เพิ่มกราฟย้อนหลัง 6 เดือนถึงเดือนที่เลือก การ์ดและตารางยังใช้เดือนที่เลือก
- query ซ้ำ/ไม่รู้จักหรือเดือนอนาคตคืน 400; ไม่ล็อกอิน 401; ไม่มีสิทธิ์ 403
- สำเร็จครบหรือบางส่วนคืน 200; ไม่มีเว็บใดโหลดได้คืน 503 พร้อมสถานะรายเว็บ; storage/auth infrastructure ขัดข้องคืน safe error 503
- ทุก response เป็น `private, no-store` และไม่มี upstream token/error body

โครงสร้าง response: `period`, `status`, `availableSites`, `selectedSites`, `totals`, `unattributed`, `daily`, `websites`, `villas: { rows, page, pageSize, total }` ใช้ `status` และ coverage เสมอ ไม่ควรตีความ HTTP 200 ว่าข้อมูลครบทุกเว็บ

Metric ทุกตัวเป็นจำนวนครั้ง: `page_views`, `phone_clicks`, `chat_clicks`, `line_clicks`, `gallery_opens`, `contact_clicks` โดย contact_clicks คือผลรวมโทร/แชท/LINE ไม่ใช่คนไม่ซ้ำ ไม่ใช่จำนวนการจอง และไม่มีการรวมข้อมูลจาก Google

เดือนปัจจุบันอ่านถึงวันนี้ด้วย as_of เดียวกันทุกเว็บ รายงานตรวจ site_id, contract/query, จำนวนเต็ม, จำนวนวัน และผลรวม daily/villas/unattributed ก่อนแสดง ข้อมูลไม่ผ่านตรวจจะเป็น invalid_report รายเว็บ

## ข้อมูลไม่ครบ

ต้นทางเก็บ raw events 180 วัน เมื่อเลือกช่วงที่เกิน coverage หรือเริ่มเก็บกลางเดือนจะแสดง partial แม้ endpoint ทำงานปกติ เว็บไซต์ที่เรียกไม่สำเร็จแสดงขีดและเหตุผลแทนศูนย์ ยอดรวม/กราฟ partial เป็นผลรวมเฉพาะข้อมูลที่ได้รับ หากไม่มีข้อมูลจากทุกเว็บ totals เป็น null

หน้า 2 ที่เคยมีข้อมูลอาจหายไปเมื่อบางเว็บล่ม จึงย้ายไปหน้าที่มีข้อมูลได้ใน response พร้อมคงสถานะ/ยอด partial; ไม่ทิ้งรายงานทั้งหมดเป็น invalid_query ในกรณีนี้ รายงานครบทุกเว็บยังปฏิเสธเลขหน้าที่เกินจริง

ยอดทั่วไปที่ไม่ระบุบ้านรวมอยู่ใน headline แล้ว และแสดงเป็นแถวกิจกรรมที่ไม่ระบุบ้านในแต่ละตารางเว็บ พร้อมยอดรวมทั้งเว็บไซต์ที่รวมทุกหน้า แต่ละเว็บมี `unattributed` และ `villas: {rows,page,total}` ของตนเอง ชื่อบ้าน join ด้วย `listings.property_id` ซึ่งตรงกับ public villa_id ไม่ใช้ UUID listing.id; อ่านเฉพาะชื่อของบ้านในหน้าปัจจุบันและ fallback แสดงรหัส DV เมื่อไม่มีชื่อ

หน้าสรุปมี 3 ยอดหลักและจำนวนกดโทร/LINE/Messenger ไม่มีเปอร์เซ็นต์ กราฟเส้นสลับรายวัน/รายเดือนและเปิดปิด series ได้ ตัวเลือกเดือนใช้ maxMonth เฉพาะหน้านี้

โหมดรายเดือนเพิ่ม `monthly` 6 จุด แบ่งคำขอย้อนหลังเป็นช่วงไม่เกิน 90 วัน (2 คำขอเพิ่มต่อเว็บ) เรียกพร้อมกันไม่เกิน 2 คำขอ ใช้ as_of เดียวกับเดือนปัจจุบัน วันข้ามช่วงรวมครั้งเดียว วันก่อน coverage และเว็บล่มทำให้เดือน partial; เดือนที่อยู่นอก coverage ทั้งหมดเป็น `no_data` และ metric null; ทุกคำขอที่เกี่ยวข้องล้มเหลวเป็น `unavailable` และ null ไม่วาดศูนย์แทนข้อมูลที่ไม่มี ไม่มีการเรียกย้อนหลังเมื่อเลือกกราฟรายวัน

## เจ้าของโค้ดและการตรวจ

- `lib/website-analytics.ts`: contracts, query/period, safe metric arithmetic, URL filters
- `server/site-analytics`: allowlist, secrets, transport, report validation, API handler
- `server/auth/website-analytics.ts`: nonredirecting API-safe authorization ใช้ Dashboard repository
- `server/services/website-analytics.ts`: bounded fan-out, aggregate/coverage/pagination
- `app/admin/dashboard/websites`: authenticated server page, loading/error; ใช้ service โดยตรง
- `components/admin/dashboard/website-analytics`: filters, chart, tables, summary

```text
node --import ./tests/register-server-only.mjs --test tests/website-analytics-*.test.ts tests/thai-month-picker-bounds.test.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

`npm run build` สร้าง public/sw.js จาก source revision; หากทดสอบ reproducibility ก่อน build หลังแก้ source ให้รัน `npm run build:pwa` ก่อน ห้ามแก้ generated worker ด้วยมือ รายงานนี้เป็น network-only ตาม PWA policy เดิม


## การแสดงอันดับบ้าน

หัวข้อแต่ละเว็บคือ “บ้านที่มีการกดติดต่อสูงสุด 5 อันดับ” เรียง contact_clicks มากไปน้อย ตามด้วย site key และ villa_id เพื่อให้ลำดับคงที่ ชื่อเว็บและโดเมนอยู่บรรทัดรอง อันดับนับเฉพาะบ้าน ไม่รวมกิจกรรมที่ไม่ระบุบ้าน ยอดรวมท้ายตารางรวมทุกอันดับ ปุ่ม “ดูทั้งหมด” เปิด `view=houses` ของเว็บนั้นพร้อมเดือนเดิม หน้ารายการไม่แสดงกราฟ/การ์ดซ้ำ แบ่งหน้าละ 10 และมีปุ่มกลับภาพรวมเว็บไซต์ ไม่เรียกประวัติรายเดือนในหน้ารายการ


## แสดงครั้งละเว็บไซต์

หน้า Dashboard แสดงเฉพาะเว็บไซต์ที่เลือก ไม่มีตัวเลือกทุกเว็บไซต์ การเปิดครั้งแรกหรือ URL เก่า site=all ใช้เว็บแรกใน registry เป็นค่าเริ่มต้น ทั้งการ์ด กราฟ 5 อันดับ และรายการทั้งหมดอ่านเฉพาะเว็บนั้น เปลี่ยนเว็บแล้วแทนรายงานเดิมและ reset หน้า ส่วน aggregate API ยังรองรับ site=all ตาม contract เดิม


## การซ่อนสถานะช่วงข้อมูลตามคำขอ

หน้าจอไม่แสดงป้าย/แบนเนอร์/ข้อความเดือนที่ข้อมูลไม่ครบช่วง แต่เก็บ status และ coverage ใน API เหมือนเดิม ไม่แปลง partial เป็น complete และไม่เติมศูนย์แทนเดือนที่ไม่มีข้อมูล ข้อผิดพลาดจากการโหลดจริงยังแสดงตามเดิม


## การเรียงบ้าน

query `sort` รองรับ contacts (ค่าเริ่มต้น), gallery, views, name, code เท่านั้น ยอดสถิติเรียงมากไปน้อย ชื่อใช้ตัวอักษรไทยและตัวเลขตามธรรมชาติ รหัสเรียงเป็นตัวเลขน้อยไปมาก ค่าที่เท่ากันเรียงรหัสแล้ว site key เพื่อให้หน้าคงที่ เรียงบ้านทั้งหมดก่อนแบ่งหน้า/ตัด 5 รายการแรก เปลี่ยน sort จะ reset หน้ารายการและคงเดือน/เว็บไซต์/โหมดไว้ ปุ่มดูทั้งหมดและกลับภาพรวมรักษา sort

การเรียงชื่ออ่านชื่อทั้งหมดด้วย property_id ก่อนแบ่งหน้า โดย repository แบ่งคำขอไม่เกิน 100 รหัสต่อครั้ง บ้านไม่มีชื่ออยู่ท้ายรายการ หากอ่านทะเบียนไม่ได้จะแสดงข้อความและใช้รหัสบ้านแทน ไม่เปลี่ยนยอดรวม การเรียงแบบอื่นอ่านชื่อเฉพาะบ้านในหน้าที่แสดง


## ตำแหน่ง sort ที่แก้ตามคำขอ

ตัวเลือกเรียงตามแสดงเฉพาะหน้า “ดูทั้งหมด” (view=houses) เท่านั้น หน้าภาพรวมไม่มี sort และแสดง 5 อันดับตามการกดติดต่อเสมอ รวมถึงลิงก์เก่าที่มี sort ติดมา ปุ่มกลับภาพรวมล้าง sort; ภายในหน้ารายการยังคง sort เมื่อแบ่งหน้า เปลี่ยนเว็บ หรือเปลี่ยนเดือน


## รูปแบบหน้ารายการทั้งหมด

view=houses ใช้ DashboardDetailLayout, DashboardTaskHeader, DashboardListToolbar และ DashboardPager เช่นเดียวกับรายการบ้าน/เอเจนซี่ ไม่มี Card ใหญ่ครอบตารางหรือหัวเรื่องซ้ำ Desktop เป็นตารางกรอบ rounded-xl ส่วน mobile เป็นการ์ดบ้านที่แสดงครบ 6 metrics พร้อมชื่อยาวตัดบรรทัดได้ `house-list.tsx` เป็นเจ้าของหน้ารายการ และ `table-metrics.tsx` รวมคอลัมน์/สถานะที่ใช้ร่วมกับตาราง 5 อันดับ


## ค้นหาในหน้าดูทั้งหมด

มีช่องค้นหาชื่อบ้าน/รหัสบ้านเหมือน list Dashboard อื่น กด Enter หรือปุ่มค้นหา ใช้ query search (trim, ไม่เกิน 100 ตัวอักษร) ชื่อค้นแบบข้อความย่อยไม่แยกตัวพิมพ์ใหญ่เล็ก รหัสตัวเลขหรือ DV-12/DV 12 ค้นแบบตรงรหัส กรองบ้านทั้งหมดก่อนแบ่งหน้า โดยอ่านชื่อผ่าน repository เป็น batch เดิม เปลี่ยนคำค้น reset หน้า; sort/แบ่งหน้า/เดือน/เว็บไซต์รักษาคำค้น ยอดรวมเว็บไซต์ไม่เปลี่ยนตามผลค้นหา กลับภาพรวมล้าง search และไม่มีช่องค้นหาในภาพรวม หากโหลดทะเบียนชื่อไม่ได้แสดงข้อผิดพลาดและระบุว่าค้นหาได้เฉพาะรหัส ไม่แสดงว่าค้นหาชื่อสำเร็จแต่ไม่มีผล

### Main dashboard website summary

The admin overview streams a per-website summary below the existing dashboard sections instead of a navigation button. The table shows domain, load status and all six metric totals for the selected dashboard month. Website-name links retain that month and select the corresponding website overview. Partial coverage uses the successful-load label; unavailable totals render as dashes. Owners do not mount the server loader. Source tokens remain server-only; optional house title lookups are skipped for this summary. Focused rendering/navigation checks: tests/website-analytics-summary.test.ts.

### Compact mobile overview

The application uses the shared white/blue/green palette defined in app/globals.css, including website analytics. Mobile summary uses three metric columns with one contact-channel strip. The chart is shorter, with green views and blue contacts. Mobile top-five rows live in `mobile-ranking.tsx`: native details reveal full names and phone/LINE/chat counts; whole-site and unattributed totals remain available in a collapsed disclosure. Desktop keeps the full table. Numbers wrap within their column when unusually long. House images are not part of the reporting metadata and are not fabricated.
