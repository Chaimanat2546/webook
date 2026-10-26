# Booking notifications: ในเว็บและ Web Push

วันที่: 2026-10-22

## ความต้องการที่ผู้ใช้ยืนยัน

เมื่อมี booking ใหม่ ให้ admin ทุกคนได้รับแจ้งเตือนทุกบ้าน และให้บัญชี
เจ้าของบ้านได้รับเฉพาะบ้านที่ DV ตรงกับบัญชี มีทั้งรายการแจ้งเตือนในเว็บ
และ Push บนมือถือ ผู้ใช้ยืนยันเกณฑ์ผู้รับและให้ดำเนินการต่อแล้ว

ผู้ใช้อนุมัติสเปกและแพ็กเกจแล้ว และให้เขียนโค้ดพร้อมทดสอบต่อโดยไม่หยุด
ขอยืนยันแผน เอกสารนี้เป็นข้อกำหนดสำหรับ implementation และการตรวจรับ

## รูปแบบที่เลือกและทางเลือก

แนะนำใช้ Supabase เก็บรายการแจ้งเตือนและคิวส่ง แล้วให้ Cloudflare Worker
ส่ง Web Push มาตรฐาน VAPID ต่อจาก PWA เดิม เหตุการณ์ต้องถูกบันทึกใน
transaction เดียวกับ booking เพื่อครอบคลุมการสร้างจากหลายช่องทาง
และไม่สูญหายเมื่อ HTTP response กลับไม่ถึงผู้ใช้

ทางเลือกที่พิจารณา:

- ส่งจาก Server Action หลังสร้าง booking อย่างเดียว: โค้ดน้อยกว่า แต่ไม่ครอบคลุม
  writer อื่นและอาจสูญหายระหว่าง booking commit กับการส่ง ไม่เลือก
- ใช้ผู้ให้บริการ Push ภายนอก: มีเครื่องมือบริหารพร้อม แต่เพิ่มบัญชีบริการและ
 การส่งข้อมูล subscription ให้บริการเพิ่ม ไม่จำเป็นสำหรับขอบเขตนี้
- เก็บคิวในฐานข้อมูลและส่งด้วย Worker เดิม: ใช้โครงสร้างที่มีอยู่ ตรวจสอบ
 สถานะและลองส่งใหม่ได้ เป็นแนวทางที่แนะนำ

เสนอใช้ `@block65/webcrypto-web-push` เฉพาะ adapter ส่ง Push เพราะใช้
Web Crypto และรองรับ Cloudflare Workers โดยตรง ไม่เขียนระบบเข้ารหัสเอง
ผู้ใช้อนุมัติการเพิ่มแพ็กเกจนี้อย่างชัดเจนตาม AGENTS.md แล้ว

## ขอบเขตเหตุการณ์

- แจ้งเฉพาะ booking ที่ INSERT ใหม่ด้วยสถานะ `waiting` หรือ `confirmed`
  หลังเปิดใช้งาน migration รวมรายการใหม่ที่มาจาก iCal
- ไม่สร้างแจ้งเตือนย้อนหลังให้ booking ที่มีอยู่ก่อน migration
- ไม่แจ้งการแก้ไข เปลี่ยนสถานะ ยกเลิก หมดเวลาชำระ หรือรายการ `repair`
- การ retry การสร้าง booking เดิมหรือ sync iCal UID เดิมต้องไม่สร้างแจ้งซ้ำ
- การซิงก์ iCal ครั้งแรกอาจ INSERT หลายรายการ จึงสร้างหลายแจ้งเตือนตามจริง
  ไม่อ้างว่ารายการที่เพิ่งนำเข้าถูกจอง ณ เวลานำเข้า
- ผู้รับรวมผู้สร้าง booking ด้วย หากผู้สร้างมีสิทธิ์รับตามกติกา

## ผู้รับและการตรวจสิทธิ์

ใช้ความสัมพันธ์เดียวกับ Dashboard ไม่ใช้ `listings.owner_id`:

- admin: `users.role_id = 1` และมี `users.uid` เชื่อมบัญชี Auth
- เจ้าของบ้าน: ผู้ใช้ที่ไม่ใช่ admin มี `users.dv_id` เป็นเลขบ้านที่ถูกต้อง
  และตรงกับทั้ง `bookings.houseid` และ `listings.property_id`
- `bookings.listing_id` ต้องอ้างถึง listing เดียวกันด้วย
- ใช้ Auth UID จาก session เท่านั้น ไม่รับ user ID, DV หรือ role จาก browser
- แต่ละ Auth UID ได้หนึ่งรายการต่อ booking แม้มีเงื่อนไขผู้รับซ้ำกัน
- การอ่าน จำนวนยังไม่อ่าน การทำเครื่องหมายอ่าน และการเปิดรายละเอียด
  ตรวจทั้งความเป็นเจ้าของ notification และสิทธิ์ปัจจุบัน
- Worker ตรวจสิทธิ์ปัจจุบันซ้ำก่อนส่ง หากเปลี่ยน DV หรือลดสิทธิ์จนไม่มีสิทธิ์
  ต้องยุติ job นั้น ไม่ส่งข้อมูล booking ให้ผู้รับเดิม
- บัญชีที่ไม่มี Auth UID หรือไม่มีสิทธิ์จะไม่ได้รับรายการ ไม่เดาเจ้าของจากอีเมล
- ผู้ใช้ที่เพิ่งได้รับสิทธิ์หลังเกิด booking จะไม่ได้รับแจ้งเตือนย้อนหลัง

## ประสบการณ์ในเว็บ

เพิ่มกระดิ่งใน shared admin header ทั้ง desktop และ mobile พร้อมจำนวนยังไม่อ่าน
แสดง `99+` เมื่อเกิน 99 ปุ่มมี accessible label ที่บอกจำนวน และไม่แสดงตอนพิมพ์
บนหน้าที่ซ่อน mobile header ต้องยังเข้ารายการได้จาก shared sidebar

ใช้ `components/ui/sheet`, `button`, `badge`, `skeleton` และ `sonner` เดิม
Sheet เหมาะกับรายการที่ต้องแตะบนมือถือและใช้รูปแบบเดียวกันบน desktop
ทางเลือก Popover เหมาะกับรายการสั้นบน desktop แต่ไม่จำเป็นต้องเพิ่ม
layout อีกชุดสำหรับงานนี้

ส่วนนี้เป็น notification ส่วนกลางและ Sheet ไม่ใช่ workspace ของบ้านหลังหนึ่ง
จึงไม่ใช้ House Workspace Shell และไม่เปลี่ยนโครงสร้างหน้า house เดิม

รายการแสดงชื่อบ้าน/DV วันเข้าพัก–ออก สถานะ แหล่งที่มา เวลาแจ้งเตือน
และสถานะอ่านแล้ว มี empty state, loading, retry และ pagination
ใช้ข้อความ “มี booking ใหม่” สำหรับรายการในระบบ และ “นำเข้า booking จาก iCal”
สำหรับรายการนำเข้า ไม่แสดงข้อมูลส่วนบุคคลของลูกค้าในรายการแจ้งเตือน

โหลดจำนวนและรายการด้วย authenticated endpoint ที่ใช้ `Cache-Control: no-store`
อัปเดตทุก 30 วินาทีขณะ tab มองเห็น และเมื่อกลับมา online/focus
ไม่ poll ต่อเมื่อ tab ถูกซ่อนหรือ browser offline และไม่แสดงรายการเก่าค้าง
หลังออกจากระบบ/เปลี่ยนบัญชี ความล้มเหลวไม่แสดงจำนวน 0 แทนค่าที่ยังไม่ทราบ

ทำเครื่องหมายอ่านทีละรายการเมื่อผู้ใช้เปิด และมี “อ่านทั้งหมด”
การอ่านในอุปกรณ์หนึ่งสะท้อนอุปกรณ์อื่นในการ refresh รอบถัดไป
ปุ่มซ้ำหรือ retry ต้อง idempotent และอ่านทั้งหมดไม่กินรายการที่เข้ามาหลัง
เวลาที่ผู้ใช้กดปุ่ม

## การเปิด booking จากแจ้งเตือน

URL จาก Push เป็น same-origin `/admin/notifications/[notificationId]`
route นี้ตรวจ session, ผู้รับ และสิทธิ์ปัจจุบันก่อนแสดงข้อมูล
ไม่ทำเครื่องหมายอ่านจาก GET/prefetch ให้ทำผ่าน explicit POST/Server Action

สำหรับ booking ในระบบ มีลิงก์ไป Dashboard booking detail เดิม โดยใช้เดือน
ของ booking และตัวกรองที่ไม่ทำให้รายการ `waiting` ถูกซ่อน
เจ้าของบ้านไม่ต้องมี `allow_booking` เพื่ออ่านรายการในขอบเขต Dashboard ของตน

iCal ถูกแยกจากรายงาน Dashboard เดิม จึงแสดงสรุปที่ปลอดภัยใน notification
detail และเปิด calendar เดิมได้เฉพาะผู้ที่มีสิทธิ์ booking ไม่เปิดเส้นทาง
จัดการ booking ให้เจ้าของบ้านโดยข้าม authorization

หาก booking ถูกลบหรือผู้ใช้หมดสิทธิ์ ให้แสดงข้อความไม่สามารถเปิดรายการได้
โดยไม่เผยชื่อบ้าน ลูกค้า หรือรายละเอียดที่ไม่ควรเข้าถึง

## การเปิดรับ Push และหลายอุปกรณ์

ใน Sheet มีปุ่ม “เปิดแจ้งเตือนบนอุปกรณ์นี้” และ “ปิดแจ้งเตือนบนอุปกรณ์นี้”
ขอ browser permission หลังผู้ใช้แตะปุ่มเท่านั้น ไม่ขอทันทีที่เข้าเว็บ
แสดงสถานะไม่รองรับ ถูกบล็อก ยังไม่ได้เปิด และเปิดแล้วอย่างตรงกับผลจริง

ใช้ Service Worker `/sw.js` ตัวเดิม เพิ่ม `push` และ `notificationclick`
ใน source `worker/pwa-sw.js` แล้ว regenerate ด้วย `npm run build:pwa`
ไม่แก้ generated worker ด้วยมือและไม่สร้าง worker ตัวที่สองมาแย่ง scope

แต่ละบัญชีผูกได้หลาย subscription เช่น มือถือกับคอมพิวเตอร์
เก็บ endpoint และ keys ไว้ฝั่ง server ไม่ส่งกลับให้ผู้ใช้อื่น
การปิดจากอุปกรณ์หนึ่งไม่ปิดอีกอุปกรณ์
การ sign out/เปลี่ยนบัญชีต้องยกเลิก subscription หรือถอน binding ของ
browser นี้ก่อนจบ flow เพื่อไม่ให้บัญชีก่อนหน้ารับแจ้งต่อบนอุปกรณ์ร่วม
กรณี network failure ให้ unsubscribe ใน browser ด้วยและมีข้อความแจ้งผล

iPhone/iPad ต้องใช้ Home Screen web app บน OS ที่รองรับ (16.4 ขึ้นไป)
มีคำแนะนำภาษาไทยให้เพิ่มหน้าจอโฮมและเปิดจากไอคอนก่อนเปิด Push
Android/desktop ใช้ capability detection ไม่สัญญาว่าทุก browser รองรับ
การปฏิเสธ Push ไม่ปิดการแจ้งเตือนในเว็บ

## ข้อมูลและคิวส่ง

เพิ่ม migration ใหม่เท่านั้น ประกอบด้วย:

- `booking_notifications`: UUID, recipient Auth UID, booking ID,
  property ID, created_at, read_at; unique ต่อ recipient + booking
- `push_subscriptions`: UUID, recipient Auth UID, unique endpoint,
  p256dh/auth, created_at และ updated_at
- `booking_push_deliveries`: notification ID, subscription ID, สถานะ,
  attempt count, next_attempt_at, lease token/expiry, sent_at และ error code
  ที่ปลอดภัย; unique ต่อ notification + subscription
- INSERT trigger บน bookings: สร้างรายการผู้รับและ delivery jobs ของ
  subscription ที่เปิดอยู่ใน transaction เดียวกัน ไม่มี network call ใน trigger
- service-role-only RPC สำหรับ claim jobs แบบ bounded batch พร้อม
  `FOR UPDATE SKIP LOCKED`, ตรวจสิทธิ์ และ acknowledge โดยใช้ lease token

เปิด RLS ทุกตารางและเพิกถอนสิทธิ์ browser roles ที่ไม่จำเป็น
รายการและ mutations ผ่าน server auth → service → repository/RPC
ไม่ให้ client ใช้ privileged client หรือกำหนดผู้รับเอง
ดัชนีครอบคลุม recipient/created_at, unread และ due jobs
ไม่ scan bookings ทั้งหมดเพื่อหาเหตุการณ์ใหม่

งาน scheduled เดิมยังคงยกเลิก waiting ที่หมดเวลาได้ แม้ Push ล้มเหลว
และ Push ยังทำงานได้หาก expiry sweep ล้มเหลว แยกการจัดการ error ของสองงาน
claim ครั้งละไม่เกิน 50 deliveries ส่งพร้อมกันไม่เกิน 5 รายการ
มี timeout 10 วินาทีต่อ request และ lease 3 นาที
crash หลัง claim ต้องปล่อยให้ worker รอบหลังรับ job ต่อได้

retry ข้อผิดพลาด network/429/5xx สูงสุด 5 attempts โดยหน่วง
1, 2, 4 และ 8 นาทีตามลำดับ และไม่เร็วกว่าค่า Retry-After ที่ถูกต้อง
400/401/403 ถือเป็น permanent/configuration failure ของ delivery
ไม่ลบ subscription เพราะ VAPID/config ผิด
404/410 ยกเลิก subscription ที่หมดอายุและจบ jobs ที่เกี่ยวข้อง
ไม่ replay Push เกิน 24 ชั่วโมงหลังเกิด notification

การส่งเป็น at-least-once: หากบริการรับ Push แล้ว worker crash ก่อน acknowledge
อาจส่งซ้ำได้ ใช้ notification UUID เป็น notification tag เพื่อแทนที่รายการเดิม
ไม่อ้างว่าการส่งถึง Push provider คือผู้ใช้ได้รับหรืออ่านแล้ว

รุ่นแรกส่งจาก cron ที่มีอยู่ทุกนาที จึงอาจรอประมาณหนึ่งนาทีบวกเวลา provider
การแจ้งเตือนในเว็บปรากฏในการ refresh รอบถัดไป ความหน่วงไม่ใช่ SLA

## Push payload และความปลอดภัย

หน้าจอล็อกแสดงเพียง “WeBooks: มี booking ใหม่” และ
“เปิด WeBooks เพื่อดูรายละเอียด” พร้อมไอคอนแอปและ notification UUID
ไม่ใส่ชื่อลูกค้า เบอร์โทร ราคา หรือชื่อบ้านใน payload
ใช้ VAPID และ encryption มาตรฐานผ่าน adapter ของแพ็กเกจที่เสนอ

subscription input ต้องมีขนาดจำกัด keys ถูกความยาว และ endpoint HTTPS
ใช้ allowlist ของ Push provider ที่รองรับ ไม่รับ arbitrary host, credentials,
port หรือ redirect ในการส่ง เพื่อลด SSRF
Worker ใช้ fetch `redirect: error` และไม่ log endpoint, auth keys หรือ response body

notificationclick รับเฉพาะ URL same-origin ในเส้นทาง notification ที่กำหนด
focus tab เดิมหรือเปิดแอป แล้วให้ server ตรวจ session อีกครั้ง
ไม่รับ external redirect จาก payload และไม่เก็บข้อมูลส่วนบุคคลใน SW cache

ต้องตั้งค่า `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
ฝั่ง server ของแต่ละ environment; public key เท่านั้นที่ส่งให้ browser
ใช้ key คนละชุดสำหรับ Staging และ Production ไม่พิมพ์ private key ลง log
หากยังไม่ตั้งค่า ปิดปุ่มสมัคร Push พร้อมข้อความอธิบาย และให้กระดิ่งทำงานได้

## ขอบเขตไฟล์ที่จะเปลี่ยน

- `supabase/migrations/`: notification/subscription/delivery tables, RLS,
  trigger และ service-role-only RPC ใหม่
- `lib/booking-notifications.ts`: types, validation และค่าข้อความที่ใช้ร่วมกัน
- `server/auth/notifications.ts`: ผูก Auth session กับสิทธิ์ปัจจุบัน
- `server/repositories/booking-notifications.ts`: queries และ RPC เท่านั้น
- `server/services/booking-notifications.ts`: use cases และ orchestration
- `server/notifications/web-push.ts`: adapter ส่ง Push แยกจาก repository
- `app/api/notifications/route.ts`, notification actions และ detail route
- `components/admin/notifications/`: bell, Sheet, list และปุ่มตั้งค่า Push
- shared desktop/mobile header/sidebar และ sign-out flow ที่เกี่ยวข้อง
- `worker/pwa-sw.js`, `worker.ts`, environment documentation และ tests
- `package.json`/lockfile เฉพาะเมื่อผู้ใช้อนุมัติ dependency แล้ว

workspace มีการแก้ navigation และ permissions ค้างอยู่ก่อนงานนี้
ต้องเก็บการแก้เหล่านั้นไว้และปรับ notification ให้เข้ากับโครงสร้างล่าสุด
ไม่ reset, stash หรือ commit การแก้เดิมรวมกับงานนี้

## การตรวจรับ

- Database integration: admin ทุกคนและ owner DV ตรงได้รับคนละหนึ่งรายการ;
  DV อื่น ไม่มี UID และไม่มีสิทธิ์ไม่รับ; update/repair/retry ไม่แจ้งซ้ำ;
  rollback booking ไม่ทิ้ง notification; first iCal import สร้างตามขอบเขต
- Authorization: ปลอม notification ID, actor, DV และ role ไม่ข้ามสิทธิ์;
  เปลี่ยน DV/ลดสิทธิ์แล้วอ่านหรือรับ Push ของบ้านเดิมไม่ได้
- Queue: concurrent claim, lease expiry, retry/backoff, Retry-After,
  timeout, permanent failure, 404/410 และการไม่ขัดขวาง expiry sweep
- Push adapter: encrypted payload, provider allowlist, ไม่ตาม redirect,
  ไม่เผยข้อมูลส่วนบุคคลและ keys; mock provider ไม่เท่ากับทดสอบมือถือจริง
- UI: loading/empty/error, pagination, unread และ read-all cutoff,
  ปุ่มตั้งค่าตาม capability, หลายอุปกรณ์, sign out และเปลี่ยนบัญชี
- Browser/mobile: ตรวจ desktop และ viewport 390px; ทดสอบ Push จริง
  บน Android และ iPhone Home Screen app ด้วยการอนุญาตจากเจ้าของอุปกรณ์
- รัน `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
  ก่อนรายงานว่า implementation เสร็จ พร้อมบอกการตรวจจริงที่ยังทำไม่ได้

## การนำขึ้นใช้งาน

หลังโค้ดผ่าน review/checks ต้อง apply migration และตั้ง VAPID keys
ก่อนเปิด Push บน environment นั้น การเขียนโค้ดไม่เท่ากับเปิดใช้งานแล้ว
หากมี deployment ในงานนี้ ให้ใช้ Staging เท่านั้นตาม AGENTS.md
Production ต้องได้คำสั่งและ confirmation แยกตามกฎโครงการ

## แหล่งอ้างอิง

- [Apple/WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Web Push adapter และตัวอย่าง Cloudflare Workers](https://github.com/block65/webcrypto-web-push)
- [RFC 8291: Message Encryption for Web Push](https://www.rfc-editor.org/rfc/rfc8291.html)
- Next.js guides ใน `node_modules/next/dist/docs/01-app/02-guides/`
  และ flow ของ Dashboard/PWA/booking ใน repository นี้
