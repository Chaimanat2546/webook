# Airbnb calendar import

นำวันไม่ว่างจาก Airbnb มาแสดงในตารางการจอง โดยเก็บข้อมูลใน Supabase กลาง
ใช้ `bookings` เดิมและแยกแหล่งเชื่อมต่อไว้ใน `property_calendar_sources`
ไม่ได้ดึงข้อมูลลูกค้า ราคา การชำระเงิน หรือส่งข้อมูลกลับ OTA
วันไม่ว่างจาก iCal อาจเป็นการจองหรือวันที่เจ้าของบล็อกเอง จึงไม่ใช้เป็นยอดขาย

## การตั้งค่า

1. ตรวจ schema เป้าหมายด้วย `scripts/inspect-ical-schema.sql` แบบอ่านอย่างเดียว
   โดยเฉพาะ `bookings`, constraint `no_overlapping_bookings` และ `dashboard_report`
   migration จะหยุดหากโครงสร้างรายงานไม่ตรงกับรูปแบบที่ตรวจไว้
2. เตรียม `ICAL_SOURCE_ENCRYPTION_KEY` เป็น key สุ่ม 32 bytes ที่เข้ารหัส base64
   เก็บเฉพาะ server environment หรือ Worker secret ห้ามใช้ชื่อขึ้นต้น `NEXT_PUBLIC_`
   อย่าใส่ค่า key หรือ URL จริงลง Git, command arguments หรือ log
3. ออก migration `20261009120000_ical_booking_import.sql` และโค้ดแอปพร้อมกัน
   ระหว่าง release ห้ามเพิ่ม source หรือเริ่ม import ก่อนโค้ด read-only และรายงานพร้อม
   Staging ใช้ขั้นตอน deploy ตาม AGENTS.md เท่านั้น
4. ผู้ดูแล role 1 ที่มี `allow_booking` เปิดบ้านใน `/admin/houses/[id]`
   แล้วเลือกหมวด “เชื่อมปฏิทินภายนอก” (`?section=calendar`)
   เพิ่มชื่อแหล่งกับลิงก์ Export calendar ของ Airbnb แล้วกดตรวจสอบการซิงก์

Key ต้องคงเดิมระหว่าง deploy และมีสำรองที่ปลอดภัย หากเปลี่ยน key เดิมจะถอดรหัส
URL ที่บันทึกไว้ไม่ได้ MVP ยังไม่มีเครื่องมือหมุนเวียน key อัตโนมัติ
จำเป็นต้องย้าย ciphertext ด้วย key เดิม หรือกรอก URL ใหม่ทุกแหล่ง
รูปแบบ payload เก็บ version, nonce และ ciphertext รวมในคอลัมน์เดียว
หน้าแก้ไขไม่ส่ง URL เดิมกลับ browser; เว้นช่อง URL ว่างเพื่อรักษาค่าเดิม

### Staging secret upload

สำหรับ local Staging deploy สามารถใส่ `ICAL_SOURCE_ENCRYPTION_KEY` ในไฟล์
`.env.ical-staging` ที่ Git ignore ไว้ แล้วใช้ `npm run deploy:cf:staging` ตามเดิม
runner ส่งไฟล์นี้ให้ Wrangler ผ่าน `--secrets-file` เฉพาะตอน upload/deploy
ไม่โหลด key เข้า build และไม่แทนที่ secrets อื่นที่ไม่ได้อยู่ในไฟล์
หากไม่มีไฟล์ runner ใช้ secrets ที่ตั้งไว้บน Worker แล้วตามเดิม
เก็บไฟล์อย่างปลอดภัย จำกัดสิทธิ์อ่าน และอย่าสร้าง key ใหม่ทุกครั้งที่ deploy

วันที่ 2026-10-09: Staging workflow run `37915145904` ผ่าน migration,
verify, build, deploy และตรวจ bundle ว่าไม่มี Production project reference
ตรวจพบ Worker secret สำหรับ iCal แล้ว โดยตอนเตรียมระบบไม่มี DV 2122 ใน Staging
ภายหลังผู้ใช้เพิ่ม source ที่บ้านทดสอบ DV 990001 และตรวจหลังแก้ redirect mode:
ซิงก์สำเร็จ 9 ต.ค. 2569 เวลา 17:21 (Asia/Bangkok), นำเข้า 16 UID ไม่ซ้ำ
ไม่พบรายการข้ามบ้านหรือรายการนำเข้าของบ้านอื่น
Staging Worker version: `afcafbb9-69c5-4f98-8c5e-4e4a973c684f`

## โครงสร้างข้อมูล

ตาราง source มี 13 คอลัมน์ตามที่ตกลง: `id`, `listing_id`, `provider`, `label`,
`ical_url_encrypted`, `enabled`, `last_attempted_at`, `last_synced_at`,
`next_refresh_at`, `last_error_code`, `sync_lease_token`, `sync_lease_expires_at`,
`created_at` ไม่มีข้อบังคับว่าแต่ละบ้านต้องมี provider เพียงแหล่งเดียว
schema รองรับ `airbnb`, `agoda`, `booking_com`, `other` แต่การเพิ่ม URL และ fetch
ใน MVP เปิดเฉพาะ Airbnb การรองรับ provider ใหม่ต้องเพิ่ม allowlist และทดสอบ feed ก่อน

`bookings` เพิ่ม `calendar_source_id` กับ `external_uid` และใช้ `booking_type`
เป็น provider เช่น `airbnb` โดยไม่เปลี่ยนค่า `booking` ของรายการภายใน
UID มีเอกลักษณ์เฉพาะภายใน source เดียว รายการคนละแหล่งที่ UID หรือวันเหมือนกัน
ยังเก็บแยกได้ FK ตรวจว่าบ้านของ booking ตรงกับ source
ไม่ลบ source ที่มีประวัติ booking ให้ปิดใช้งานแทน

## นโยบายซิงก์

- ซิงก์เฉพาะบ้านที่เปิดใน gallery ไม่สแกนทุกบ้านและไม่มี cron สำหรับ iCal
- cache หลังสำเร็จ 300 วินาที; หลังผิดพลาดพัก 60 วินาที ปุ่มตรวจสอบเคารพช่วงนี้
- สูงสุด 6 แหล่งต่อคำขอ และ 3 fetch พร้อมกัน เริ่มจากแหล่งที่ตรวจนานที่สุด
  แหล่งที่เหลือแสดงข้อมูลเดิม/ยังไม่ล่าสุดและถูกพิจารณาในคำขอถัดไป
- lease ใน DB อายุ 30 วินาที มีผู้ชนะเดียว การเขียนต้องใช้ token ปัจจุบันที่ยังไม่หมดอายุ
  การ claim คืนค่า config ปัจจุบันแบบ atomic เพื่อไม่ fetch URL เก่าหลังเปลี่ยนแหล่ง
- fetch/read จำกัด 8 วินาทีและ 1 MiB รับไม่เกิน 5,000 events
- รับ HTTPS เฉพาะ `www.airbnb.com/calendar/ical/<ตัวเลข>.ics` ไม่รับ redirect,
  userinfo, IP address, port อื่น หรือ URL ภายนอกที่ client กำหนดเอง
- รับ standalone all-day events ใช้ `DTEND` เป็นวันออกที่ไม่รวมคืนวันนั้น
  ถ้าไม่มี DTEND ให้หนึ่งคืน ไม่รับ timed event, recurrence, DURATION,
  component ที่ไม่รองรับ หรือ METHOD ของ partial scheduling
- parse ทั้ง feed ก่อนเขียน หากรายการใดผิดให้คง snapshot เดิมทั้งหมด
  feed สมบูรณ์ที่ไม่มี events ถือว่าสำเร็จและยกเลิกรายการเดิมของ source
- UID เดิมเปลี่ยนวันจะ update แถวเดิม; UID ที่หายหรือ CANCELLED จะเปลี่ยนเป็น `cancelled`
  snapshot เหมือนเดิมไม่ update booking เพื่อลด audit log

เวลาซิงก์สำเร็จของแต่ละแหล่งแสดงเป็น Asia/Bangkok หากมีข้อผิดพลาดหรือไม่มี snapshot
อย่าตีความช่องว่างในตารางเป็นวันว่างที่ยืนยันจากต้นทางแล้ว iCal ไม่ใช่ real-time

## การชนกันและสิทธิ์

Import เก็บช่วงวันที่แม้ชน booking ภายในหรือ source อื่น และแสดงเครื่องหมายเตือน
รายการภายในยังเปิดแก้ไขได้ โดยแก้รายละเอียดช่วงวันเดิมได้แม้ภายหลังมี import มาชน
แต่การสร้าง ย้ายวัน หรือเปิดใช้งานรายการภายในที่ยกเลิกแล้ว จะไม่ข้ามวันไม่ว่างที่นำเข้า
DB guard ป้องกันกรณีส่งคำขอเองแทนการเลือกผ่านปฏิทิน

รายการที่นำเข้าเปิดรายละเอียดแบบอ่านอย่างเดียว ไม่ให้แก้/ยกเลิกผ่าน service
หรือ RPC เดิม และไม่รวมยอด/รายการ/รายละเอียดใน dashboard
ตาราง source เปิด RLS และไม่ให้ anon/authenticated อ่าน ciphertext หรือเรียก sync RPC
server ตรวจ `allow_booking` ทุก action และ role 1 สำหรับเปลี่ยน source

ปิด source หรือเปลี่ยน URL จะยกเลิกรายการ active เดิมและ invalidate lease แบบ atomic
เปิดกลับจะรอ snapshot ใหม่ หาก fetch ล้มเหลวจะไม่คืนสถานะรายการที่ยกเลิกเอง
เมื่อหลายแหล่งชนวันเดียวกัน ระบบเก็บและแสดงการชนครบ แต่หน้ารายละเอียดปัจจุบัน
เปิด booking ภายในก่อน หรือ external รายการแรก ยังไม่มีตัวเลือกเปิดทุกรายการที่ซ้อนกัน

ทั้งจองภายในและ iCal ใช้ `BookingEditor` (Dialog/Sheet), `BookingEditorLayout`
และปฏิทิน `BookingDateRange` ชุดเดียวกัน เปลี่ยนเฉพาะรายละเอียดทางขวา:
จองภายในใช้ฟอร์มเดิม ส่วน iCal ใช้ `IcalBookingSummary` อ่านอย่างเดียว
เมื่อเปิดรายการ iCal จากตารางจอง หน้ารายละเอียดใช้ dialog สองคอลัมน์:
ปฏิทินบ้านและช่วงเข้าพักทางซ้าย ข้อมูลต้นทาง จำนวนคืน สถานะ และเวลาซิงก์ทางขวา
มือถือและการเปิดจาก Sheet เรียงเป็นคอลัมน์เดียว ปฏิทินแสดงสีสถานะเดิม
และเน้นเฉพาะคืนที่เข้าพัก ไม่รวมวันเช็กเอาต์ เลื่อนเดือนได้ด้วยปุ่มปฏิทินเดิม
ช่องวันที่และวันในปฏิทินปิดการแก้ไขเมื่อเป็น iCal; รายการยกเลิกไม่เน้นคืนเข้าพัก
รายการนี้ไม่มีปุ่มบันทึก ยกเลิก เลือกเอเจนซี่ หรือเปิดสร้าง booking จากปฏิทิน
ไม่ได้แสดงข้อมูลลูกค้า ราคา หรือ URL feed และไม่เปลี่ยนฟอร์มจองภายใน

รายละเอียด Airbnb ใช้ `SiAirbnb` จาก `react-icons/si` เป็นโลโก้ต้นทาง
หัวปฏิทินและ provider อื่นยังใช้ไอคอนปฏิทิน ไม่ติดตั้ง dependency เพิ่ม
การตั้งค่าอยู่ใน House Workspace Shell และเมนูหมวดข้อมูลของบ้านแต่ละหลัง
จากรายการบ้าน ใช้เมนูสามจุดบน desktop หรือปุ่ม “จัดการ” บนมือถือ
แล้วเลือก “เชื่อมปฏิทินภายนอก” โดยไม่เพิ่มลิงก์หรือปุ่มนอกเมนูเดิม
ไม่มีลิงก์ตั้งค่าบนการ์ดตารางจองแล้ว; `/calendar-sources` เดิมตรวจสิทธิ์แล้ว
redirect ไป `?section=calendar` ฟอร์มใช้คำว่า “เพิ่มปฏิทิน Airbnb”, “ลิงก์ปฏิทิน”
และ “อัปเดตข้อมูล” โดยยังเก็บ URL ลับและตรวจสิทธิ์บน server เหมือนเดิม

## การทดสอบ

การดึงใช้ `redirect: 'manual'` และปฏิเสธ HTTP 3xx ทุกกรณี ไม่ตาม Location
ไปยังปลายทางอื่น เนื่องจาก Workers runtime ไม่รองรับ `redirect: 'error'`
regression test เรียก native fetch ใน Miniflare โดยจำลองเฉพาะ outbound server
จึงตรวจทั้งความเข้ากันได้กับ runtime และการไม่ตาม redirect โดยไม่เรียก live feed

```powershell
npm run typecheck
npm run lint
npm test
npm run build
$env:ICAL_DB_INTEGRATION='1'
$env:ICAL_WORKER_INTEGRATION='1'
node --import ./tests/register-server-only.mjs --test "tests/ical-*.test.ts"
```

DB integration ใช้ Docker PostgreSQL 17 ชั่วคราว ไม่มี network หรือ published port
ใช้ข้อมูลสังเคราะห์และลบเฉพาะ container ที่สร้างเองเมื่อจบ
Workers integration ใช้ Miniflare ที่ติดมากับ Wrangler เวอร์ชัน pinned ของโปรเจกต์
เป็น local runtime ไม่มี cloud bindings ไม่มี live customer data และไม่ deploy
ดู [Miniflare documentation](https://developers.cloudflare.com/workers/testing/miniflare/)
สำหรับข้อจำกัดของการจำลอง runtime

ข้อผิดพลาดที่แสดงเป็นรหัสปลอดภัย เช่น `calendar_timeout`, `calendar_http_error`,
`invalid_ics`, `unsupported_ics`, `calendar_secret_unconfigured`, `calendar_secret_invalid`
ไม่แสดง response ดิบหรือ tokenized URL หากถอดรหัสไม่ได้ให้ตรวจ key ของ server
ก่อนเปลี่ยน source; หาก feed ไม่รองรับให้คงข้อมูลเดิมและตรวจรูปแบบโดยไม่เผยข้อมูลส่วนตัว
