# สถิติการใช้งานเว็บไซต์ใน Webook

สถานะ: อนุมัติและพัฒนาแล้ว — 2026-10-07; ดูรายงานการตรวจใน ../reports/2026-10-07-website-analytics-verification.md

## เป้าหมายที่ตกลง

ผู้ใช้เลือก API พร้อมหน้าสถิติใน Webook เพื่อดูการเข้าชมและการกดติดต่อแยกโดเมน เลือกเดือนได้ และดูแยกบ้านได้ ใช้ข้อมูล collector ของเรา ไม่ใช้ Google Analytics เป็นแหล่งข้อมูล และไม่เปลี่ยน GTM ของเจ้าของเว็บไซต์ ทดสอบนำร่องเพียงสองเว็บ

ยอดทั้งหมดคือจำนวนเหตุการณ์ ไม่ใช่คนไม่ซ้ำ ไม่มีการเพิ่ม visitor ID, session ID หรือการติดตามบุคคล

## หน้าจอ

- เพิ่ม `/admin/dashboard/websites` และลิงก์จาก Dashboard เฉพาะผู้มีสิทธิ์
- ส่วนหัว “สถิติเข้าเว็บไซต์” พร้อมตัวเลือกเดือนและเว็บไซต์ (ทั้งหมดหรือเว็บเดียว) ค่าเริ่มต้นเดือนปัจจุบันตาม Asia/Bangkok
- การ์ดยอดเข้าชม, ยอดกดติดต่อรวม, กดโทร, LINE, แชท และเปิดรูป
- กราฟรายวัน: เข้าชมและกดติดต่อ ใช้ ChartContainer/Recharts ที่ติดตั้งแล้ว
- ตารางแยกโดเมนพร้อมสถานะข้อมูล และตารางแยกบ้านแบบแบ่งหน้า 10 รายการ ใช้รหัสบ้านที่รายงานให้มา ไม่มีการเดาจับคู่รหัสกับรายการจอง
- ใช้ Card, Button, Input, Select, Table, Badge, Skeleton และส่วนประกอบ Dashboard เดิมตามที่มีอยู่ ไม่เพิ่ม dependency
- ใช้ layout Dashboard ไม่ใช้ House Workspace Shell เพราะเป็นภาพรวมหลายเว็บ ไม่ใช่ workspace ของบ้านหนึ่งหลัง
- มือถือเรียงการ์ดแนวตั้ง ตารางอยู่ในพื้นที่เลื่อนแนวนอน มี loading, empty, error และข้อมูลไม่ครบแยกชัดเจน
- หากบางเว็บเรียกไม่สำเร็จ ยอดรวมต้องระบุว่าเป็นยอดเฉพาะเว็บที่โหลดได้ พร้อมจำนวนเว็บที่ขาด ไม่แปลงข้อผิดพลาดเป็นยอดศูนย์

## สิทธิ์และ API ของ Webook

เพิ่ม `GET /api/admin/website-analytics?month=YYYY-MM&site=all&page=1` โดย `site` รับเฉพาะ key ในรายการอนุญาต และ `page` แบ่งหน้าตารางบ้าน ตัวกรอง/หน้าที่ไม่ถูกต้องคืน 400

ทั้งหน้าและ API ตรวจ session และอ่าน `users.role_id` จาก uid ที่ยืนยันแล้ว ใช้ owner เดิมของ Dashboard สำหรับข้อมูลสิทธิ์ อนุญาตเฉพาะ role 1 ไม่อนุญาต owner หรือ email fallback ให้ขยายสิทธิ์ API คืน JSON 401/403 แทน redirect หน้า login และทุก response เป็น private, no-store

หน้า Server Component เรียก service เดียวกับ API โดยตรง ไม่ fetch กลับเข้า API ของ Webook เอง ส่งเฉพาะข้อมูลสรุปที่จำเป็นให้ client chart ไม่ส่ง token หรือ response ดิบของต้นทาง

Response มี period/as_of, สถานะ complete/partial/unavailable, totals, daily, รายการ websites พร้อมสถานะ coverage และ villas แบบแบ่งหน้า ถ้าทุกเว็บล้มเหลว API คืน 503; ถ้าบางเว็บล้มเหลวคืน 200 พร้อม partial อย่างชัดเจน การ์ดและกราฟไม่เปลี่ยนตามเลขหน้าตาราง

## การเชื่อมต่อ

ใช้ `POST https://<allowed-domain>/api/analytics/v1/report` ที่มีอยู่แล้วใน baan-pool-villa ด้วย Bearer token ฝั่งเซิร์ฟเวอร์ ไม่ต้องเพิ่ม API หรือตารางในเว็บต้นทาง

สร้าง server-only adapter ใน `server/site-analytics/` สำหรับ registry, credentials, HTTP และตรวจสัญญาข้อมูล; business aggregation อยู่ `server/services/website-analytics.ts`; types/validation ที่ไม่ใช้ secret อยู่ `lib/website-analytics.ts`; หน้าจออยู่ `components/admin/dashboard/website-analytics/`

Tenant key และ site_id ใช้ resolver ใน `server/central-user-manager/tenant-bindings.ts` ที่มีอยู่ ไม่คัดลอก UUID ซ้ำ และแยก endpoint/secret สำหรับ analytics จากสิทธิ์ Central User Manager

| Tenant key | โดเมนที่อนุญาต | ชื่อ secret ใหม่ของ Webook |
| --- | --- | --- |
| baanparty | www.baanpartypattaya.com | ANALYTICS_REPORT_TOKEN_BAANPARTY |
| poolvillapattaya | www.poolvillapattaya.co.th | ANALYTICS_REPORT_TOKEN_POOLVILLAPATTAYA |
| baanpmhee | www.pmheevilla.com | ANALYTICS_REPORT_TOKEN_BAANPMHEE |
| fluknasapoolvilla | nasapoolvilla.com | ANALYTICS_REPORT_TOKEN_FLUKNASA |
| villamediapoolvilla | pukmoodpoolvilla.com | ANALYTICS_REPORT_TOKEN_PUKMOOD |

ค่า secret แต่ละตัวตรงกับ ANALYTICS_REPORT_READ_TOKEN ของเว็บนั้น อ่านจาก server environment/Cloudflare binding เท่านั้น ไม่ใส่ค่าใน git, NEXT_PUBLIC, logs หรือ browser หากขาด secret แสดง “ยังไม่ได้ตั้งค่า” ไม่มีการหมุน token

ห้ามรับ URL หรือ token จาก query/body ของ browser ใช้ HTTPS และ exact endpoint ที่ allowlist, redirect:error, timeout 10 วินาที, จำกัด response 3 MiB และเรียกพร้อมกันไม่เกินสองเว็บ ไม่มี background polling หรือ retry อัตโนมัติ ใช้ as_of เดียวกันทั้งคำขอ

Request ใช้ contract_version 1.0, timezone Asia/Bangkok, villa_id:null, from_date วันแรกของเดือน, to_date วันสุดท้ายหรือวันนี้สำหรับเดือนปัจจุบัน ปฏิเสธเดือนอนาคต ตรวจ response contract_version, site_id, query ช่วงวันที่, ตัวเลข safe integer ไม่ติดลบ, รายวัน/รหัสบ้านไม่ซ้ำ และ coverage ก่อนรวมยอด

contact_clicks = phone_clicks + chat_clicks + line_clicks รวมด้วย safe integer checks ยอดทั่วไปที่ villa_id:null ยังคงอยู่ในยอดรวม แต่แสดงแยกจากยอดบ้าน ไม่แจกยอดทั่วไปให้แต่ละบ้าน วันที่อยู่นอกช่วงเก็บข้อมูล 180 วันต้องแสดงข้อมูลไม่ครบตาม coverage ไม่อ้างว่าไม่มีการใช้งาน

ไม่มีตารางใหม่, การคัดลอก raw events หรือ shared persistent report cache ในระยะแรก แยกสถานะรายเว็บเมื่อ token ไม่ผ่าน, rate limit, timeout, contract ไม่ตรง หรือข้อมูลไม่ครบ ไม่ส่ง upstream error body/รายละเอียด secret ออกไป

## การตรวจรับ

- ทดสอบ authentication/role 1, query validation, allowlisted destinations, secret isolation, timeout/redirect/oversize และ site_id mismatch
- ทดสอบรวมยอดรายวัน/รายเว็บ/รายบ้าน, ติดต่อรวม, เดือนกรุงเทพฯ, วันที่ไม่มี event, partial coverage, missing token, upstream failure และ safe integer overflow
- ใช้ต้นทางนำร่องสองตัวแทน nasapoolvilla และ pukmood ใน fixture/Docker ตรวจยอดใน report เทียบฐานข้อมูลจริง ไม่ยิง event สังเคราะห์เข้า production
- ตรวจ browser desktop/mobile: เลือกเดือน/เว็บ, pagination, กราฟ, empty/error/partial/loading และไม่พบ secret ใน network responses หรือ HTML
- รัน relevant Node tests, typecheck, lint และ production build; อัปเดต docs การตั้งค่าและวิธีเรียก API
- ตรวจ source diff และทำ code review ก่อนสรุป ไม่ commit หรือ deploy production ในขอบเขตนี้

## สิ่งที่ยังไม่รวม

ไม่เพิ่ม unique visitors, conversion attribution, รายงาน Google, เจ้าของโดเมนล็อกอินดูเอง, export หรือเชื่อมยอดจองเป็น conversion ผู้ใช้อนุมัติขอบเขตนี้แล้วจึงเขียน implementation plan และลงมือในแชทนี้


## Approved presentation revision

User approved a single three-metric summary with channel counts, no percentages, separate per-website house tables and no per-table site filter. Global month/site filters remain. Each table has independent ten-row pagination, unattributed activity and full-site totals. Names use listings.property_id with a safe missing-name fallback. Chart switches daily/monthly (six months ending at the selected month); cards/tables remain selected-month totals. Missing historical coverage is shown explicitly, never as observed zero traffic.
