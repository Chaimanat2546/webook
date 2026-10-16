# สถิติเข้าเว็บไซต์

## ขอบเขตกราฟและชุดเปรียบเทียบ

Dashboard เริ่มด้วยกราฟปกติของทุกเว็บไซต์และสถิติเข้าชม ไม่มีปุ่ม “ทุกเว็บไซต์” หรือหน้าต่างเลือกเว็บซ้ำ ใช้รายชื่อเว็บไซต์เพียงชุดเดียว กดซ่อน/แสดงเว็บใดจะมีผลกับทั้งช่วงหลักและช่วงเทียบพร้อมกัน ทั้งกราฟรายวันและยอดรวม การซ่อนมีผลเฉพาะกราฟ ไม่แก้ยอดในตารางสรุป และต้องเหลืออย่างน้อยหนึ่งเว็บที่แสดง

คงตัวเลือกวันที่หลักไว้ที่หัวการ์ดและรายชื่อเว็บไว้ใน legend เหนือกราฟตาม UI เดิม ปุ่ม “เพิ่มชุดเปรียบเทียบ” อยู่ข้างตัวเลือกวันที่เดิมและเพิ่มเฉพาะตัวเลือกวันที่เทียบ โดยเริ่มจากช่วงก่อนหน้าที่มีจำนวนวันเท่ากัน ทั้งสองช่วงเลือกวันที่เองและยืนยันใช้ หรือยกเลิกได้อิสระ ใช้รายชื่อเว็บร่วมกันเสมอ เส้นทึบเป็นช่วงหลัก เส้นประเป็นช่วงเทียบ ไม่มีรายการชื่อเว็บซ้ำสำหรับแต่ละช่วง

การเปลี่ยนวันที่ สลับรายวัน/ยอดรวม และเพิ่ม/เอาชุดเทียบออก คงสถานะการซ่อนร่วมไว้ ปุ่ม × เอาออกเฉพาะช่วงเทียบและหยุดอ่านช่วงนั้น รายชื่อเว็บใช้ flex-wrap และรูปแบบเส้นของ legend เดิม โดยปุ่มสูงอย่างน้อย 44px สถานะซ่อนแสดงด้วยชื่อขีดฆ่าและ aria-pressed ไม่อาศัยสีเพียงอย่างเดียว การซ่อนเป็น state ชั่วคราวในกราฟ ไม่เขียน URL ทุกครั้งที่กดชื่อเว็บ

- รายวันจับคู่วันตามลำดับ 1..N เส้นทึบเป็นชุดหลัก เส้นประเป็นชุดเทียบ tooltip แสดงวันที่จริงของแต่ละชุด เว็บไซต์ที่ไม่ได้เลือกในอีกชุดแสดงจุด “ไม่อยู่ในชุด” แยกจากข้อมูลที่โหลดไม่ได้ (`—`) หากช่วงยาวไม่เท่ากันจะคงทุกวันของช่วงที่ยาวกว่า และระบุว่านอกช่วงสำหรับฝั่งที่สั้นกว่า ไม่สร้างวันที่หรือเติมศูนย์
- ยอดรวมแสดงแท่งและยอดของเว็บที่เปิดแสดงทั้งสองช่วง บนสเกลร่วมกัน ตารางใต้ Dashboard แสดงชุดหลักเท่านั้น
- คำนวณผลต่าง/% เฉพาะแถวเว็บเดียวกันที่อยู่ทั้งสองชุด มีจำนวนวันเท่ากัน และข้อมูลทั้งสองชุดยืนยันครบ ไม่มีผลต่างอัตโนมัติระหว่างคนละเว็บ
- ข้อมูลครบต้องมี `status=complete`, `range_complete`, `rows_complete`, daily ครบทุกวันและรวมตรงกับยอดต้นทาง รวมถึงไม่มีวันที่ยังไม่สิ้นสุดตาม snapshot ของ Asia/Bangkok ข้อมูลบางส่วน/ช่วงยังไม่จบงดผลต่างและดูเหตุผลใน Popover ได้
- วันที่ไม่มีรายงานหรือก่อน retention เป็น `null` ไม่เชื่อมเส้นข้ามช่องว่าง จุดที่เหลือวันเดียวต้องมองเห็นได้ ศูนย์จริงคงเป็น 0 ฐานศูนย์แสดงจำนวนครั้งที่เพิ่มแทนเปอร์เซ็นต์ ไม่มีการตัดวันมาเทียบเอง
- เลือกสองช่วงคนละจำนวนวันได้ แต่แสดงจำนวนวันกำกับและงด % ยอดรวม เว็บที่ไม่อยู่ในอีกชุดไม่ถูกนับเป็นโหลดล้มเหลวหรือข้อมูลไม่ครบ

หน้า `/admin/dashboard/websites` ยังคงรายงานหลักเป็นเว็บไซต์ที่เลือกในตัวกรองเดิม และเพิ่มช่วงเทียบที่เลือกวันที่ได้อิสระ โดยรายชื่อเว็บบนกราฟซ่อน/แสดงร่วมกัน กดเอาออกเพื่อกลับกราฟเดิม การเปลี่ยนเว็บไซต์หลัก ช่วงหลัก รายวัน/รายเดือน และการเข้า “ดูทั้งหมด” แบ่งหน้า/กลับภาพรวม คงชุดเทียบที่กำหนดเองไว้

การเลือกเว็บไซต์หลักใหม่จะเปิดเว็บไซต์นั้นในกราฟร่วมด้วย หากซ่อนเว็บไซต์หลักไว้แล้วถอดช่วงเทียบ กราฟรายเว็บจะแจ้งว่าเว็บไซต์ถูกซ่อน แทนการแจ้งว่าโหลดข้อมูลไม่ได้ และจำรายการที่เปิดไว้เมื่อเพิ่มช่วงเทียบกลับมา

`analyticsScope` เป็น query ของหน้าเว็บเท่านั้น เก็บ JSON `{ sites: string[], comparison?: { from, to, sites } }` โดยตรวจชื่อฟิลด์ ชนิด จำนวน/ความซ้ำของเว็บ และ allowlist รวมถึงตรวจวันที่ถึงวันนี้ตามเวลาไทย หน้าเว็บไซต์แยก query นี้ก่อนเข้า parser เดิมของ API ซึ่งยังปฏิเสธ query ดังกล่าว ไม่มีการส่ง endpoint หรือ credentials จาก client ลิงก์เดิม `analyticsCompare=previous` ยังเปิดช่วงก่อนหน้าขนาดเท่ากันได้ แต่หน้าปกติไม่มีชุดเทียบและตัวควบคุมใหม่จะบันทึกเป็น scope ที่ชัดเจน

`server/services/website-analytics-comparison.ts` อ่านผ่าน service เดิมหลังอนุญาต admin จับ snapshot ครั้งเดียว อ่านชุดหลักก่อนชุดเทียบเพื่อคง upstream concurrency ไม่เกิน 2 และโหลด series ของเว็บไซต์ใน allowlist ที่พร้อมเลือกให้แต่ละช่วงเพียงครั้งเดียว การกดชื่อเว็บซ่อน/แสดงใช้ state ฝั่ง client ไม่อ่านต้นทางซ้ำ หน้ารายเว็บไซต์อ่านปัจจุบันครั้งเดียวแล้วใช้ timestamp เดิมอ่านชุดเทียบ โดยไม่อ่านชื่อบ้านเพิ่ม หน้ารายการบ้านทั้งหมดไม่อ่านชุดเทียบแม้คง scope ในลิงก์ ไม่มี schema/dependency/สิทธิ์ API ใหม่

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

หน้ารายเว็บไซต์ `/admin/dashboard/websites` แสดงเฉพาะเว็บไซต์ที่เลือก ไม่มีตัวเลือกทุกเว็บไซต์ การเปิดครั้งแรกหรือ URL เก่า site=all ใช้เว็บแรกใน registry เป็นค่าเริ่มต้น ทั้งการ์ด กราฟ 5 อันดับ และรายการทั้งหมดอ่านเฉพาะเว็บนั้น เปลี่ยนเว็บแล้วแทนรายงานเดิมและ reset หน้า ส่วน Dashboard หลักแสดงทุกเว็บไซต์พร้อมกัน และ aggregate API ยังรองรับ site=all ตาม contract เดิม


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

The Card header owns the single “แนวโน้มประสิทธิภาพเว็บไซต์” heading and comparison description, including its chart icon. The chart body does not repeat this heading. The loading header mirrors this structure; table, links and metrics remain unchanged.

Controls in this dashboard card use the shared 32px height: primary/comparison date triggers, comparison add/remove buttons, chart view/metric buttons, website legend buttons, comparison issue buttons, and the mobile contact disclosure. Long website legend labels truncate within the available width, with the full website name available in the title. Primary-date shortcuts opt into `compactShortcuts` so their buttons match the existing 32px number inputs; other report pickers retain their existing shortcut sizes. Shared calendar month navigation buttons and day buttons are 32 × 32px, with a matching 32px month caption row.

The main dashboard has a local view switch: “แนวโน้มรายวัน” (default) and “ยอดรวมแต่ละเว็บ”. Daily view starts with page views and lets admins select contact clicks or gallery opens. Each website has a stable color and line pattern; its legend button hides or shows that website, keeping at least one available website visible. Hovering or tapping the chart shows the selected day's values. Missing dates and dates before source coverage remain gaps rather than zeroes, including when the selected range crosses months. Single-day ranges show dots. If daily data is absent, an empty state still leaves the total-view switch available.

Without comparison, “ยอดรวมแต่ละเว็บ” reuses the original grouped bar chart with all three metrics together. Both views use the same already-loaded report and selected date range, and the table always shows all primary website totals regardless of the selected metric or hidden lines. Switching views or changing the chart date range preserves the current view, metric and temporary website visibility; view and visibility changes do not fetch data. Adding comparison reads the second range, shows the selected metric for both periods and keeps the shared website legend. Removing comparison returns to the ordinary chart. Old `websiteGraph` parameters remain ignored. The separate `/admin/dashboard/websites` detail page retains its ordinary daily/monthly behavior when comparison is off.

The admin overview streams a per-website summary below the existing dashboard sections instead of a navigation button. The table shows domain, load status and all six metric totals for the selected dashboard month. Website-name links retain that month and select the corresponding website overview. Partial coverage uses the successful-load label; unavailable totals render as dashes. Owners do not mount the server loader. Source tokens remain server-only; optional house title lookups are skipped for this summary. Focused rendering/navigation checks: tests/website-analytics-summary.test.ts.

In total view, a grouped vertical bar chart above the summary table shows one website per horizontal-axis category and three adjacent bars: page views, total contact clicks, and gallery opens. `websiteComparisonData` reads the exact same `WebsiteSummary.totals` used by the selected-range table; daily/history rows are not re-summed. Zero totals remain zero and missing totals stay null, with unavailable websites listed explicitly rather than drawn as zero. The shared tooltip shows the full website name and all three totals. Dense charts scroll horizontally inside a keyboard-focusable region without widening the page. The tooltip follows the active bar coordinate instead of being pinned to the chart corner. Its content stays within the visible scroll region on selection, resize and horizontal scrolling. Desktop table and mobile summaries are unchanged. The loading skeleton reserves chart space.

When all chart totals are missing, the existing dashboard Empty primitives show a centered chart icon, “ยังไม่มีข้อมูลสถิติ” and “สถิติจากเว็บไซต์จะแสดงที่นี่เมื่อเชื่อมต่อสำเร็จ”, matching the recent-houses empty state. Future-month selections use the same icon/title layout with “ยังไม่มีสถิติสำหรับเดือนในอนาคต”, without fetching analytics. Source diagnostics and the table remain visible.

### Compact mobile overview

The application uses the shared white/blue/green palette defined in app/globals.css, including website analytics. Mobile summary uses three metric columns with one contact-channel strip. The chart is shorter, with green views and blue contacts. Mobile top-five rows live in `mobile-ranking.tsx`: native details reveal full names and phone/LINE/chat counts; whole-site and unattributed totals remain available in a collapsed disclosure. Desktop keeps the full table. Numbers wrap within their column when unusually long. House images are not part of the reporting metadata and are not fabricated.
# ช่วงวันที่ในการ์ดภาพรวมเว็บไซต์

การ์ด “แนวโน้มประสิทธิภาพเว็บไซต์” บน Dashboard เลือกวันเริ่มต้นและสิ้นสุดได้ผ่านปฏิทินเดิม คลิกวันเริ่มต้นและวันสิ้นสุดเพื่อเลือกช่วงชั่วคราว แล้วกด “ใช้” ที่แถบด้านล่างภายในป๊อปอัปเพื่อโหลดกราฟและตาราง ปุ่ม “ยกเลิก” การกด Escape หรือคลิกด้านนอกจะทิ้งการเลือกชั่วคราวและคงช่วงเดิม ปุ่มใช้ถูกปิดเมื่อเลือกวันไม่ครบ คลิกวันเดียวกันสองครั้งเพื่อเลือกวันเดียว เริ่มต้นตามเดือนของ Dashboard (เดือนปัจจุบันถึงวันนี้) รองรับวันเดียวและข้ามเดือน โดยรวมวันต้นและวันท้ายตามเวลา Asia/Bangkok ไม่รับวันที่อนาคตหรือวันที่ไม่มีจริง

URL ของ Dashboard ใช้ `analyticsFrom` และ `analyticsTo` แยกจาก `month` จึงไม่เปลี่ยนเดือนของการ์ดอื่น เมื่อเปลี่ยนเดือนที่หัว Dashboard จะกลับไปช่วงเดือนนั้น ลิงก์ไปเว็บไซต์ส่งต่อ `from`/`to` ให้กราฟรายวันและรายละเอียดใช้ช่วงเดียวกัน การเลือกเดือนในหน้ารายละเอียดจะล้างช่วงที่ส่งต่อ โหมดรายเดือนย้อนหลัง 6 เดือนใช้เฉพาะเมื่อไม่มีช่วงกำหนดเอง

คำขอ upstream ถูกแบ่งช่วงละไม่เกิน 90 วันโดยไม่ซ้ำวันและใช้ `as_of` เดียวกัน รวมยอดบ้านที่ปรากฏหลายช่วงก่อนจัดอันดับ คงการเรียกพร้อมกันสูงสุด 2 เว็บไซต์ หากส่วนใดโหลดไม่สำเร็จจะไม่รายงานยอดบางส่วนของเว็บไซต์นั้นเป็นยอดเต็ม ช่วงก่อนเริ่มเก็บข้อมูลแสดงคำเตือนข้อมูลไม่ครบ มีเมนูช่วงสำเร็จรูปด้านซ้ายบน desktop และด้านบนบนมือถือ: วันนี้, เมื่อวาน, สัปดาห์นี้ (อาทิตย์ถึงวันนี้), สัปดาห์ก่อน (อาทิตย์ถึงเสาร์), 7/14/30 วันล่าสุด (รวมวันนี้), เดือนนี้, เดือนก่อน และตั้งแต่ต้นตามวันเริ่มมีข้อมูลที่เก่าที่สุดจากเว็บไซต์ที่โหลดได้ หากไม่ทราบวันเริ่มข้อมูลจะปิดตัวเลือกตั้งแต่ต้น พร้อมข้อความอธิบาย มีช่องระบุ N วันจนถึงวันนี้/เมื่อวาน (รวมวันสิ้นสุด) แก้จำนวนวัน กด Enter หรือชื่อช่วงข้างช่องเพื่อเลือกช่วงชั่วคราว (ค่าที่ไม่ถูกต้องจะปิดปุ่มใช้) ทั้งเมนูสำเร็จรูปและจำนวนวันย้อนหลังต้องกด “ใช้” ภายในป๊อปอัปเพื่อยืนยันเหมือนการเลือกผ่านปฏิทิน ชุดเปรียบเทียบเลือกช่วงผ่านปฏิทินขนาดกะทัดรัดข้างวันที่หลัก โดยแยกวันที่ออกจากทางลัดของช่วงหลัก

Primary website-analytics month controls use `ReportDateRangePicker` with shortcuts and an internal confirmation footer. The compact comparison picker uses the same calendar and confirmation flow without shortcuts. Existing month links remain valid; selecting a primary range writes `from`/`to`, resets pagination, and uses daily chart points. The dashboard website card follows the global business range (clipped to today) unless `analyticsFrom`/`analyticsTo` overrides it. Comparison dates are stored separately in `analyticsScope` and stay unchanged when the primary range changes.

## Hourly website reports (2026-10-16)

Implemented source changes, not evidence of online rollout. Selecting an explicit single date uses upstream contract 1.1 and an hourly chart. Select the start/end clock hour in Thai time, default 00:00–24:00; 24:00 is end-only. The interval includes start and excludes end. Apply time once after editing; primary and comparison clocks are independent. Multiple dates keep daily reports, and implicit month reports remain daily even on the first day of the month.

Dashboard URLs use analyticsTimeFrom/analyticsTimeTo alongside analyticsFrom/analyticsTo. Website details/admin API use timeFrom/timeTo alongside from/to; comparison clocks live in analyticsScope.comparison. Paired canonical HH:00 fields are required if either is sent; reject incomplete, reversed, non-hourly or multi-day times. Changing business dates preserves an explicit analytics range. Changing analytics dates to multiple days clears only that dataset's clocks; pagination/site/search/sort links preserve the selected time.

The producer's SQL filters the same events for hourly/daily/totals/villas/unattributed, so charts and tables share the exact chosen-hour totals. Timestamps represent database ingestion time. The consumer validates echoed query, site, canonical hour bounds (including sub-millisecond spoofing), expected elapsed buckets and sum invariants. PostgreSQL microsecond retention watermarks are respected. Future/pre-retention buckets are gaps; elapsed event-free buckets are true zeroes. Current-hour tooltips display the as_of cut-off, and future selections retain a notice in total/detail views.

Two hourly periods pair by ordinal hour with actual dates/times in the tooltip; mixed daily/hourly periods use separate charts. Percentages require both complete, elapsed, equally long and equally granular periods. Upstream 422 for a valid 1.1 query yields hourly_unavailable (not a daily fallback); authorization/rate-limit/timeout/invalid-report errors remain distinct. Old contract 1.0 reports still parse normally. Producer deployment/migration must precede consumer production rollout.

Controls reuse existing Select/Button/Input/Calendar: height 32 CSS px, icon/calendar arrows 32 × 32 CSS px, wrapping on narrow screens. No new runtime dependency or collector/storage field was added.

Focused checks: node --import ./tests/register-server-only.mjs --test "tests/website-analytics-*.test.ts". Local real-SQL/HTTP integration: node --import ./tests/register-server-only.mjs scripts/test-hourly-analytics-integration.mjs <producer-checkout> <local-supabase_db_container>. It creates/drops its own disposable database, never loads .env, and tests the producer guard/validator/RPC through the Webook client/parser/service. Optional --serve exposes only local fixture UI assets; it is not a production route or API.

## Pull request validation

PRs targeting `staging` and `main` run the same security audit, type check, lint, tests, Next/OpenNext builds and Worker dry-run. The dry-run uses the target branch's Wrangler config with placeholder Supabase settings and no deployment credentials. PR validation does not apply migrations or publish a Worker.
