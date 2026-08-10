# Deployment และ Database Incident Log — 3 สิงหาคม 2026

เอกสารนี้บันทึกปัญหาและมาตรฐานการดูแล Webook ซึ่งเป็นศูนย์กลาง
Central User Manager (CUM) โดยไม่เก็บ secret หรือค่า environment จริง

## ขอบเขต

Webook deploy เป็น Cloudflare Worker ชื่อ `webook-admin` และติดต่อ tenant
ผ่าน Cloudflare Service Binding แบบ explicit เท่านั้น

| Tenant | Service Binding | Worker |
| --- | --- | --- |
| Baan Party | `CUM_BAANPARTY` | `baan-pool-villa` |
| Poolvillapattaya | `CUM_POOLVILLAPATTAYA` | `baan-pool-villa02` |
| PMhee | `CUM_BAANPMHEE` | `baan-pool-villa03` |
| Fluk Nasa Poolvilla | `CUM_FLUK_NASA_POOLVILLA` | `fluk-nasa-poolvilla` |
| Villa Media Poolvilla | `CUM_VILLA_MEDIA_POOLVILLA` | `villa-media-poolvilla` |

## ปัญหาที่พบ

### Webook สร้าง bundle จาก DB ผิด environment

`NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY` ถูกฝังใน
browser bundle ตั้งแต่ build ดังนั้น Cloudflare secret ที่เปลี่ยนภายหลังไม่
เปลี่ยน DB ที่หน้า Login ใช้

**มาตรฐาน:**

- Staging build ต้องโหลด `.env.staging.local`
- Production build ต้องโหลด `.env.production.local`
- ตรวจ project ref ที่คาดหวังก่อน build โดยไม่แสดงค่า secret

### Service Binding อ้าง Worker ผิดหรือยังไม่ deploy

Wrangler จะปฏิเสธ deploy หากชื่อ Worker ปลายทางไม่อยู่ใน Cloudflare account
เดียวกัน หรือ Webook อาจเรียก CUM เวอร์ชันเก่าหาก tenant deploy ไม่สำเร็จ

**มาตรฐาน:** ใช้ tenant registry และ bindings แบบ explicit; ห้ามเพิ่ม public
HTTP/Bearer fallback

### Webook Production ขาด audit schema

Webook Production เคยขาดตาราง `public.central_user_audit_events` ซึ่งทำให้
CUM audit ใช้งานไม่ได้

**การแก้ที่ทำแล้ว:** ลง
`20260802090000_central_user_manager_rpc_audit.sql` และตรวจผ่าน Data API

## สถานะ migration

### ความเสี่ยงปัจจุบัน

Webook Production มี schema โฆษณาเก่า 3 ส่วนอยู่จริง แต่ history ไม่บันทึก:

- `20260702041630_advertisement_image_path.sql`
- `20260702080833_advertisement_zone.sql`
- `20260702082332_advertisement_all_zone.sql`

นอกจากนี้ audit migration CUM ถูกลงด้วย `supabase db query` โดยตรง

ดังนั้นห้ามรัน:

```text
supabase db push --include-all
```

จนกว่าจะตรวจ schema และ repair migration history เรียบร้อย เพราะอาจรัน
migration เก่าซ้ำ

### แนวทาง cleanup

1. เทียบ migration history กับ schema จริงของ Staging และ Production
2. ตรวจให้แน่ชัดว่า schema ของแต่ละ migration มีอยู่แล้ว
3. ใช้ `supabase migration repair --status applied` เฉพาะ migration ที่ผ่าน
   การตรวจ
4. เก็บไฟล์ migration เดิมใน git; ห้ามลบทิ้งเพื่อแก้ปัญหา history
5. หลัง history ตรงกัน จึงกลับมาใช้ `supabase db push` ตามมาตรฐาน

## Deploy checklist

ก่อน deploy `webook-admin`:

1. เลือกไฟล์ env ให้ถูก Staging หรือ Production
2. โหลด `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` และ
   `SUPABASE_SERVICE_ROLE_KEY` เข้า process ก่อน build
3. ตรวจ Cloudflare runtime secrets มีครบ โดยไม่แสดงค่า
4. build ด้วย `opennextjs-cloudflare build`
5. deploy ด้วย config target ที่ถูกต้อง
6. smoke test: Login, tenant selector, CUM health และ list users

## งานคงค้าง

- ยืนยันว่า `webook-admin` เวอร์ชัน Production ถูก deploy หลัง build จาก
  `.env.production.local`
- repair migration history ของ Webook Staging และ Production เป็นงานแยก
  หลังตรวจ schema ครบ
- สร้าง script deploy/preflight เพื่อไม่ต้องโหลด env และตรวจ secrets ด้วยมือ
