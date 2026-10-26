# Login Location History — ร่างแบบระบบ

วันที่: 2026-10-26 (Asia/Bangkok)

สถานะ: ข้อเสนอสำหรับวางแผน ยังไม่ได้อนุมัติให้เริ่ม implementation

## เป้าหมายและขอบเขต

เก็บประวัติการล็อกอินสำเร็จของบัญชี Supabase Auth ใน WeBooks พร้อมข้อมูลอุปกรณ์
และพิกัดที่ผู้ใช้เลือกแชร์ครั้งเดียวต่อ session เพื่อให้ตรวจสอบย้อนหลังได้
ครอบคลุมฐานข้อมูล การบันทึก การขอพิกัด API หน้าประวัติ สิทธิ์ อายุข้อมูล และการทดสอบ

ภูระบุว่า **กฎการบังคับใช้พิกัดรอผู้บริหารกำหนด**:

- รุ่นแรกให้ปฏิเสธหรือข้ามการแชร์ได้ และยังเข้าใช้งานระบบได้
- ไม่บังคับพิกัดกับ booking, payment หรือฟังก์ชันอื่นในงานนี้
- เมื่อมีกฎใหม่ ต้องออกแบบและตรวจเงื่อนไขใน API ของฟังก์ชันนั้นด้วย
- พิกัดจาก browser เป็นข้อมูลที่ client ส่งมา อาจถูกปลอมได้ ไม่ใช่หลักฐานยืนยันตัวตนหรือสถานที่

ไม่ทำ continuous tracking, IP geolocation, reverse geocoding, แผนที่ฝังในหน้า,
export ข้อมูล, ประวัติล็อกอินล้มเหลว หรือประวัติของระบบ seller ภายนอกในรุ่นนี้
ประวัติใหม่เริ่มจากวันที่เปิดใช้ ไม่มีการสร้างประวัติย้อนหลังจาก session เก่า

## สิ่งที่พบในโค้ด

- `app/login/actions.ts`: `signInWithPassword()` ทำงานฝั่ง server แล้ว redirect `/`
- `lib/supabase/server.ts` จัดการ auth cookies; `lib/supabase/admin.ts` เป็น privileged client ฝั่ง server
- `server/auth/admin.ts` ใช้ `public.users.uid` เชื่อม Auth ID และมี email fallback สำหรับสิทธิ์เดิม
- `canManageWebookUsers()` ปัจจุบันตรวจ `allow_tools.allow_members`; เอกสาร `docs/webook-user-management.md`
  บางส่วนยังอธิบาย `role_id = 1` จึงไม่ควรนำ permission เดิมมาใช้กับพิกัดโดยอัตโนมัติ
- `lib/dashboard.ts` ใช้ `role_id = 1` เป็นผู้ดูแลหลัก และ `dv_id` เป็นขอบเขตบ้าน ไม่ใช่ tenant ID ทั่วไป
- `worker.ts` มี scheduled handler สำหรับ booking maintenance อยู่แล้ว; staging cron ทำงานทุกนาที
- `worker/pwa-sw.js` ใช้ NetworkOnly สำหรับ navigation และไม่ได้ทำ offline mutation replay
- `app/admin/users/actions.ts` และ `server/services/webook-users.ts` ปัจจุบันอนุญาตผู้มี
  `allow_members` เปลี่ยน role เป็น role ที่มีอยู่ได้ รวม role 1 โดยไม่ได้แยกสิทธิ์แต่งตั้งผู้ดูแลหลัก
  ต้องแก้ trust boundary นี้ก่อนใช้ role 1 เป็นสิทธิ์อ่านประวัติผู้อื่น

## ทางเลือก

| ทางเลือก | ข้อดี | ข้อเสีย / ความเสี่ยง | ค่าใช้จ่ายเพิ่ม |
| --- | --- | --- | --- |
| ตาราง `login_history` + server service | แนบพิกัด จัดสิทธิ์และลบตามอายุได้ตรงความต้องการ | ต้องดูแล schema, UI และการบันทึกเอง | DB storage, query และงาน Worker ตามการใช้งาน |
| นำ Auth audit log มารวมกับตารางพิกัด | ใช้เหตุการณ์ auth ที่ผู้ให้บริการบันทึกไว้ | ต้องพิสูจน์การเชื่อม session, สิทธิ์และ retention ของแหล่ง log ก่อน; ยังต้องมี API/UI | ขึ้นกับแหล่ง log และแผนบริการ ต้องประเมินก่อนเลือก |

ข้อเสนอของผู้วางแผน: ทางเลือกแรก เพราะ flow server มีอยู่แล้วและต้องควบคุมประวัติเอง
ยังไม่มีการเลือกทางเทคนิคหรืออนุมัติแบบจากภูอย่างเป็นทางการ
ไม่ติดตั้ง dependency ใหม่; ใช้ browser API, Supabase และ component เดิม

## แบบข้อมูล

สร้าง migration ใหม่เท่านั้น: `supabase/migrations/20261026110000_login_history.sql`
ตรวจ timestamp ไม่ชน migration ใหม่เมื่อเริ่มงานจริง

| Column | Type / ข้อกำหนด |
| --- | --- |
| `id` | UUID primary key, database สร้าง |
| `user_id` | UUID อ้าง `auth.users.id`, `on delete cascade`; ไม่ใช่ `public.users.id` |
| `session_id` | UUID จาก verified JWT; ไม่ทำ FK ไป `auth.sessions` เพื่อรักษาประวัติหลัง logout |
| `logged_in_at` | timestamptz จาก server ตอน sign-in สำเร็จ |
| `created_at` | timestamptz default database `now()` สำหรับเวลารับบันทึก |
| `ip_address` | inet nullable; หาค่าไม่ได้ให้ null |
| `os`, `browser` | text แบบจำกัดความยาว; ค่าอ่านไม่ได้เป็น `unknown` |
| `device_type` | `desktop`, `mobile`, `tablet`, `unknown` |
| `latitude`, `longitude`, `accuracy_m` | double precision nullable; ต้องมีครบเมื่อ `success` เท่านั้น |
| `location_status` | `pending`, `success`, `skipped`, `denied`, `unavailable`, `timeout`, `unsupported` |
| `location_captured_at` | timestamptz จาก browser, nullable และถือเป็นข้อมูลที่ไม่เชื่อถือ |
| `location_received_at` | timestamptz จาก database เมื่อรับผลพิกัดหรือสถานะ |

- Unique `(user_id, session_id)` ป้องกันคำขอซ้ำพร้อมกันในระดับ DB
- Index `(user_id, logged_in_at desc, id desc)` และ `(logged_in_at desc, id desc)`
- Latitude อยู่ใน [-90, 90], longitude [-180, 180], accuracy เป็นจำนวน finite >= 0
- ตรวจ constraint ที่ DB และ validation ที่ service; พิกัด 0 เป็นค่าที่ใช้ได้
- จำกัด OS/browser ไม่เกิน 100 ตัวอักษร ไม่เก็บ raw User-Agent ระยะยาว; parse แบบ best effort
- ไม่เก็บ access token, refresh token, cookie, password หรือ error message จาก browser
- การลบบัญชี Auth จะลบประวัติของบัญชีนั้นด้วย เป็นนโยบายที่เสนอในรุ่นแรก

## Flow และความล้มเหลว

1. หลัง sign-in สำเร็จ อ่าน identity/session จากผล auth ฝั่ง server
2. บันทึก user, session, เวลา และ request metadata โดย `await` ก่อน redirect
   duplicate ให้คืน record เดิม ห้าม overwrite IP/เวลา/พิกัดเดิม
3. เข้าหน้า `/login/location` ซึ่งต้องมี auth และรายการของ session นี้อยู่แล้ว
   หน้าอ่านอย่างเดียวไม่สร้างประวัติใหม่ จึงไม่บันทึก refresh หรือ reset-password เป็น login
4. อธิบายก่อนใช้ location permission พร้อมปุ่ม “แชร์ตำแหน่งครั้งนี้” และ “ข้าม”
   ตัวอย่างข้อความ: “ระบบจะเก็บตำแหน่งครั้งนี้เพื่อประกอบประวัติการเข้าสู่ระบบ
   คุณข้ามได้โดยยังใช้งานระบบได้ ระบบไม่ติดตามตำแหน่งต่อเนื่อง”
5. เมื่อผู้ใช้เลือกแชร์ เรียก `getCurrentPosition()` ครั้งเดียว:
   `maximumAge: 0`, `timeout: 10000`, `enableHighAccuracy: false`
   เพิ่ม UI watchdog 15 วินาทีเพื่อไม่รอ permission prompt ค้าง และละทิ้ง callback ที่มาทีหลัง
6. ส่งผลเข้ารายการเดิม แล้วไป `/` ตาม landing permission เดิม
   ปิดหน้า/ไม่ตอบ prompt: คง `pending` และแสดง “ไม่ได้รับข้อมูลพิกัด” หลังหน้าต่างรับผลหมดอายุ
7. ถ้า API บันทึกไม่ได้ ให้แจ้ง “ยังบันทึกตำแหน่งไม่ได้” พร้อมไปต่อได้
   retry การส่งผลเดิมได้ภายใน 10 นาทีหลัง `logged_in_at`; ห้ามอ่านพิกัดซ้ำอัตโนมัติ

หน้าต่างรับผล 10 นาทีเป็นข้อเสนอเพื่อให้ข้อมูลยังใกล้เวลาล็อกอิน ไม่ใช่กฎการเข้าใช้งาน
หากออกจากระบบหรือเปลี่ยนบัญชีระหว่างรอพิกัด ให้ทิ้งผลเก่าและไม่ส่งไปบัญชีใหม่

หากบันทึก login history ล้มเหลว: retry เฉพาะ insert ด้วย key เดิมได้หนึ่งครั้งสำหรับ transient error
ภายใต้งบเวลา metadata persistence รวมไม่เกิน 3 วินาที ไม่ retry sign-in;
หากยังล้มเหลวให้เข้าใช้งานต่อและส่ง diagnostic รหัสความผิดพลาดที่ไม่มีข้อมูลส่วนตัว
ไม่เปิดหน้าขอพิกัดเมื่อไม่มี record จริง และไม่สร้างประวัติปลอมตอน refresh
นี่เป็นข้อเสนอแบบ fail-open: ยอมให้มีช่องว่างในประวัติเมื่อฐานข้อมูลขัดข้อง
การรับประกันว่า login ทุกครั้งต้องมี log ต้องเป็นงานแยกที่ผู้บริหารตัดสินใจ

## API และการเขียนอย่างปลอดภัย

`POST /api/login-history/location` รับเฉพาะ `historyId` และผลพิกัดหรือสถานะ
ใช้ discriminated union: success ต้องมี latitude/longitude/accuracy/capturedAt;
สถานะอื่นห้ามมี coordinates และห้ามรับ `pending` จาก client
ไม่รับ user ID, session ID, เวลา login, IP หรือ role จาก request body

- ตรวจ verified claims ผ่าน Supabase `getClaims()` และผูก `sub` กับ identity ที่ server ยืนยัน
- ใช้ `user_id` และ `session_id` จาก token เดียวกัน ไม่เพียง decode JWT โดยไม่ verify
- ตรวจ session ยังมีอยู่และเป็นของ user นั้นผ่าน service-only DB function ก่อนเขียน
- DB function ตรวจ `historyId + user_id + session_id`, หน้าต่างเวลา และ update แบบ atomic
- เปลี่ยน `pending` เป็น terminal status ครั้งเดียว; retry payload เดิมให้ผลสำเร็จเดิม
  payload ขัดกับผลที่บันทึกแล้วตอบ 409 โดยไม่แก้ข้อมูล
- การเทียบ historyId ป้องกัน callback เก่าของบัญชี A ไปเขียนรายการของบัญชี B
- จำกัด JSON body 2 KiB, UUID, finite number, valid timestamp, timestamp ไม่เกินอนาคต 60 วินาที
  และไม่เก่ากว่าเวลา login; คลาดเคลื่อนนาฬิกาให้ตอบ validation error โดยไม่กระทบ login
- ใช้ same-origin POST ตรวจ Origin กับ URL ต้นทางจาก deployment ที่เชื่อถือได้
  ไม่เปิด CORS ให้ origin อื่น; response `Cache-Control: private, no-store`
- 400 input ไม่ถูกต้อง, 401 session ใช้ไม่ได้, 403 cross-origin, 404 รายการไม่ตรงกับเจ้าของ/session,
  409 หมดเวลา/ขัดกับผลเดิม, 503 storage ใช้ไม่ได้; ไม่ส่งรายละเอียด DB กลับ client
- RPC ที่เขียนต้อง revoke EXECUTE จาก public/anon/authenticated และ grant ให้ service_role เท่านั้น
  ใช้ชื่อ schema เต็มและ search_path คงที่; ไม่เชื่อ user/session ที่ client ระบุ

IP ใช้ `CF-Connecting-IP` เฉพาะ request ที่ผ่าน Cloudflare ingress ที่เชื่อถือได้
ไม่ใช้ค่าที่ client ส่งใน body หรือหยิบค่าแรกของ `X-Forwarded-For` โดยไม่มี trust boundary
local development หรือเส้นทางที่พิสูจน์ไม่ได้ให้ null; ต้องทดสอบ OpenNext header forwarding บน Staging
OS/browser/device เป็นการประมาณจาก User-Agent ไม่ใช้ตัดสินสิทธิ์

## สิทธิ์และหน้าประวัติ

ข้อเสนอเริ่มต้นที่ยังรอนโยบาย: ผู้ใช้ดูตนเองได้; เฉพาะ `public.users.uid = auth.uid()`
และ `role_id = 1` ดูบัญชีอื่นในฐาน WeBooks นี้ได้ ไม่ใช้ email fallback,
`allow_members`, `mid` หรือ `dv_id` เป็นสิทธิ์เข้าถึงพิกัดของคนอื่น
หากผู้ใช้ไม่มี public.users mapping ยังอ่านประวัติตนเองได้ แต่ไม่มีสิทธิ์อ่านผู้อื่น
ไม่ query หรือเชื่อม tenant ภายนอก และไม่ให้ seller/property manager ดูบัญชีอื่นในรุ่นแรก
ถ้าภายหลังต้องมีผู้ดูแลระดับ seller ต้องเพิ่ม membership/scope ที่พิสูจน์ได้ก่อน

Prerequisite ด้านสิทธิ์: ผู้ที่ไม่ใช่ root admin ที่ตรวจจาก uid จริงต้องแต่งตั้ง role 1
ให้ตนเองหรือคนอื่นไม่ได้ และต้องแก้บัญชีที่เป็น role 1 ไม่ได้ ไม่ว่าผ่าน details หรือ permissions form
ตรวจและปิด direct Data API/RPC paths ที่ทำให้ authenticated เปลี่ยน role_id, uid หรือข้อมูลที่ใช้เพิ่มสิทธิ์ได้
ต้องทดสอบกับ grants/RLS จริง ไม่สรุปจาก Server Action อย่างเดียว
root actor ต้องผ่านสิทธิ์จัดการผู้ใช้เดิมด้วยเมื่อต้องแก้ผู้ใช้; งานนี้ไม่เพิ่มสิทธิ์จัดการผู้ใช้ให้ทุก root โดยปริยาย
ป้องกัน race ด้วย atomic guarded update ที่ตรวจ actor/target role จาก DB ณ เวลาเขียน
ก่อนพิสูจน์ prerequisite นี้ผ่าน ห้ามเปิดอ่านประวัติของผู้อื่น แม้ read policy จะตรวจ role 1 แล้ว

- Enable RLS และ revoke สิทธิ์ทั้งหมดจาก anon; authenticated มีเฉพาะ SELECT ตาม own/root-admin policy
- ไม่มี INSERT/UPDATE/DELETE/TRUNCATE สำหรับ authenticated; การแก้ไขผ่าน server service เท่านั้น
- service-role bypass RLS จึงต้องตรวจ permission และใส่ scope ใน query ฝั่ง service ซ้ำด้วย
- หน้าประวัติ `/admin/login-history`: ผู้ใช้ทั่วไปเห็นของตนเอง; root admin ค้นหาผู้ใช้ได้
  ค้นหาชื่อ/username/email ผ่าน `public.users.uid` ที่ตรงจริง กรองช่วงวันที่เวลาไทย
  และเรียง `logged_in_at desc, id desc` ครั้งละ 25 รายการ (สูงสุด 100)
- ค้นหาเป็น server-side; ช่วงวันที่ inclusive ตามวันไทยแปลงเป็น [start, next-day-start) UTC
  ค่า filter ผิดให้แสดง validation error ไม่ขยายผลเป็นข้อมูลทุกคน
- แสดงผู้ใช้ เวลา อุปกรณ์ Browser/OS, IP, พิกัด, accuracy เมตร และ status
  ไม่มี mapping ให้แสดง “ไม่พบข้อมูลโปรไฟล์”; ไม่แสดง token หรือ session UUID ใน UI
- แสดง latitude/longitude โดยไม่ส่งพิกัดให้ map provider อัตโนมัติ
- วางลิงก์ประวัติใน sidebar ที่ใช้ร่วมกันทั้ง desktop/mobile โดยไม่เปลี่ยน landing module เดิม
  และเพิ่มลิงก์ของตนเองบน `AdminNoAccess` สำหรับบัญชีที่ไม่มีสิทธิ์โมดูล
- ไม่ใช้ House Workspace Shell เพราะเป็นโมดูลประวัติบัญชี ไม่ใช่งานจัดการบ้าน
- ตัวเลือก UI: ใช้ `Table` บนจอใหญ่ + `Card` บนมือถือ (แนะนำ), หรือ Table scroll แนวนอนทุกขนาด
  ใช้ `Alert`, `Button`, `thai-date-range-picker`, `Input`, `Badge`, `Skeleton`, `Pagination` เดิม
  หน้าขอพิกัดใช้ Card แยกเพื่ออธิบายก่อน permission แทน dialog ที่เปิดโดยอัตโนมัติ
  ตัวเลือกเหล่านี้ต้องนำเสนอให้ภูเลือกก่อน implementation ตาม AGENTS.md

## อายุข้อมูลและการเปิดใช้

เสนอ retention 90 วันเท่ากันทั้ง metadata และพิกัด ต้องยืนยันก่อนเปิดใช้จริง
เอกสารอธิบายการเก็บข้อมูลต้องระบุอายุ ผู้เข้าถึง และวัตถุประสงค์ตามนโยบายที่องค์กรรับรอง
permission ของ browser เป็นสิทธิ์ทางเทคนิค ไม่ถือเป็นข้อสรุปเรื่องฐานกฎหมายขององค์กร

ใช้ cron ของ `worker.ts` ที่มีอยู่ เรียก service-only purge function ทุก tick
ลบสูงสุด 1,000 รายการต่อ tick ตาม `logged_in_at < now() - interval '90 days'`
ใช้ index และล็อกเฉพาะ batch; งานรันซ้ำพร้อมกันได้ ไม่ลบข้อมูลที่ยังไม่ครบอายุ
cleanup ล้มเหลวไม่ขัดขวาง booking maintenance และ booking ล้มเหลวไม่ข้าม cleanup
ติดตามจำนวนที่ลบ ความล้มเหลว และ backlog โดยไม่ log IP/coordinates
ถ้า batch เต็มต่อเนื่องให้แจ้งผู้ดูแลเพื่อปรับ batch หรือความถี่; ไม่รับประกันลบทันทีในช่วง outage
การลบ primary database ไม่ทำให้ backup เก่าหายทันที ต้องระบุ backup lifecycle แยกในนโยบาย

ไม่เพิ่ม pg_cron หรือ scheduler ตัวใหม่ เพราะระบบมี Worker cron แล้ว
ไม่อ้างราคาเป็นตัวเลขจนทราบจำนวน login/วัน ขนาด record และแผนบริการที่ใช้อยู่
ประมาณจำนวนแถว steady state เป็น login/วัน × 90; วัดขนาดจริงรวม index บน Staging

## เกณฑ์รับงาน

- ล็อกอินใหม่มีหนึ่งรายการต่อ session; reload, token refresh, retry และคำขอพร้อมกันไม่สร้างซ้ำ
- พิกัดไม่ทำให้ login/งานหลักติดขัด; ไม่มีการอ่านซ้ำหรือส่งข้อมูลจากบัญชีเก่า
- มี behavioral tests สำหรับ validation, ownership/session, race, permission และ failure
- ผู้มี allow_members แต่ไม่ใช่ root เปลี่ยนตนเอง/ผู้อื่นเป็น role 1 ไม่ได้ และแก้ role/uid ผ่าน direct API ไม่ได้
- ทดสอบ RLS/RPC ด้วย user จริงสองบัญชีบน local Supabase หรือ Staging ไม่อาศัยอ่าน SQL text อย่างเดียว
- ช่วงวันไทยถูกต้อง, pagination ไม่ข้ามขอบเขตสิทธิ์ และหน้าบนมือถือใช้งานได้
- cleanup ผ่านกรณี boundary, duplicate scheduler, backlog และ failure isolation
- ผ่าน `npm run verify` และ `npm run build` ก่อนส่ง implementation
- เอกสาร runtime, failure behavior, อายุข้อมูล และ rollout อัปเดตแล้ว
- ถ้าต้อง deploy ใช้ Staging เท่านั้นตาม AGENTS.md; Production ต้องได้รับคำสั่งและยืนยันเป้าหมายใหม่

## แหล่งอ้างอิงที่ตรวจเมื่อ 2026-10-26

- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions): session_id ใน JWT และอายุ session
- [Supabase getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims): verify claims
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): grants/policies และ service-role bypass
- [MDN getCurrentPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition): HTTPS, permission, timeout, accuracy
- [Cloudflare request headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/): ขอบเขตของ CF-Connecting-IP และ forwarded headers
- Next.js รุ่นติดตั้ง: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
