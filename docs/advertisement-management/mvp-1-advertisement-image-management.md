# MVP 1: Advertisement Image Management

## Goal

สร้างระบบ admin สำหรับจัดการโฆษณาและรูปภาพโฆษณา

MVP นี้ให้ admin สร้าง แก้ไข เปิด/ปิด และจัดการรูปโฆษณาได้ โดยระบบอื่นจะอ่านข้อมูล active advertisements ผ่าน Supabase API และนำ `image_name` ไปสร้าง URL รูปจาก Cloudflare Worker เอง

## In Scope

- จำกัดการใช้งานเฉพาะ Administrator
- สร้างตาราง `advertisements`
- สร้างตาราง `advertisement_images`
- แสดงรายการโฆษณาทั้งหมดใน admin
- เรียง `is_active = true` ก่อน `is_active = false`
- ในกลุ่ม active เดียวกันเรียง `updated_at` ใหม่สุดก่อน
- สร้างโฆษณาใหม่พร้อม title และรูป 1-2 รูป
- แก้ไข title
- เปิด/ปิด `is_active`
- เพิ่มรูปใหม่เป็น draft และยังไม่ upload จนกดบันทึก
- ลบรูปเดิมทันทีหลัง confirm
- ป้องกันการลบรูปสุดท้าย
- preview รูปเดิมและรูป draft ได้
- ระบบกำหนด `image_order` เองเป็น 1, 2
- Public/Supabase API อ่านได้เฉพาะ active advertisements

## Out of Scope

- หน้า public/customer ใน `webook`
- Manual image ordering
- โฆษณาที่มีมากกว่า 2 รูป
- Rich text description
- CTA link
- Schedule start/end date
- Targeting
- Analytics
- Background reconciliation job สำหรับ orphaned R2 objects
- Database trigger เพื่อบังคับ minimum child image count

## Screens

### `/admin/advertisements`

ใช้สำหรับดูรายการโฆษณาทั้งหมด

ข้อมูลที่แสดง:

- `title`
- `is_active`
- จำนวนรูป
- `updated_at`
- action เข้า detail

Rules:

- แสดงโฆษณาทั้งหมด
- เรียง active ก่อน inactive
- เรียง `updated_at` ใหม่สุดก่อนภายในกลุ่มเดียวกัน
- มีปุ่มสร้างโฆษณาใหม่

### `/admin/advertisements/new`

ใช้สำหรับสร้างโฆษณาใหม่

ข้อมูลที่กรอก:

- `title`
- รูป 1-2 รูป

Rules:

- ต้องมี title
- ต้องมีรูปอย่างน้อย 1 รูป
- มีรูปได้สูงสุด 2 รูป
- เลือกรูปแล้วอยู่ใน draft ก่อน
- ยังไม่ upload ไป R2 จนกดบันทึก
- preview รูป draft ได้
- ออกจากหน้าแล้วทิ้ง draft ได้เลย

### `/admin/advertisements/[id]`

ใช้สำหรับแก้ไขโฆษณาเดิม

ข้อมูลที่แก้ไขได้:

- `title`
- `is_active`
- รูปโฆษณา

Rules:

- เพิ่มรูปใหม่เป็น draft ก่อน
- กดบันทึกแล้วค่อย upload รูปใหม่และ update metadata
- ลบรูปเดิมต้องกดปุ่มลบและ confirm ก่อน
- เมื่อลบหลัง confirm ให้ลบจริงทันที
- ถ้าลบแล้วจะเหลือ 0 รูป ต้องบล็อก
- ถ้ารูป preview/load ไม่ได้ ไม่บล็อกการ save title/status
- user ไม่สามารถจัด order เอง

## Data Source

Database: Supabase Database

### `advertisements`

Fields:

- `id`
- `title`
- `is_active`
- `created_at`
- `updated_at`

### `advertisement_images`

Fields:

- `id`
- `advertisement_id`
- `image_name`
- `image_order`
- `created_at`
- `updated_at`

Constraints:

- `advertisement_id` references `advertisements(id)` on delete cascade
- `unique(advertisement_id, image_order)`
- `image_order between 1 and 2`

Business rule:

- โฆษณา 1 รายการต้องมีรูปอย่างน้อย 1 รูป
- MVP นี้บังคับ minimum-one-image ใน admin service/route handler ไม่ใช้ database trigger

## Supabase API Behavior

ระบบอื่นอ่านผ่าน Supabase API

อ่านได้เฉพาะ:

- `advertisements.is_active = true`
- `advertisement_images` ของ active advertisements เท่านั้น

ตัวอย่าง query:

```text
advertisements?select=id,title,advertisement_images(image_name,image_order)&is_active=eq.true
```

Supabase API ส่ง `image_name` เท่านั้น ไม่ส่ง full image URL

## Image Storage Behavior

รูปเก็บใน Cloudflare R2 ผ่าน Worker/storage adapter

MVP นี้ใช้ shared media storage:

- R2 bucket: `webook-media`
- Worker name: `webook-media`
- Start domain: `*.workers.dev`
- Advertisement image prefix: `advertisements/`
- Public read: `GET /{image_name}`
- Private write/delete: `PUT /{image_name}` และ `DELETE /{image_name}` ต้องมี Bearer secret

`image_name` เป็น source of truth และควรเป็น key เช่น:

```text
advertisements/{advertisement_id}/1.webp
advertisements/{advertisement_id}/2.webp
```

รูปถูกเรียกด้วยรูปแบบ:

```text
{ADVERTISEMENT_IMAGE_WORKER_URL}/{image_name}
```

ต้องมี helper สำหรับ R2 image key/URL แยกจาก `lib/aws-image-url.ts` เพราะ helper เดิมของบ้านพักห้าม `/` ในชื่อรูป

Rules:

- ห้ามเก็บ binary รูปใน Supabase
- ห้ามเก็บ full image URL เป็น source of truth
- ห้าม expose R2 credential ไป client
- ห้ามสร้าง open image proxy
- validate `image_name` ว่าอยู่ใต้ prefix `advertisements/`
- ห้าม `..`, protocol, host หรือ path traversal
- อนุญาตเฉพาะ image extension ที่กำหนด

Environment variables:

```env
ADVERTISEMENT_IMAGE_WORKER_URL=
ADVERTISEMENT_IMAGE_WORKER_SECRET=
```

## Save And Delete Behavior

Create:

1. Validate title
2. Validate image count 1-2
3. Generate advertisement id
4. Upload images to R2
5. Insert `advertisements`
6. Insert `advertisement_images`
7. If Supabase write fails, best-effort delete newly uploaded R2 objects

Update:

1. Validate title
2. Validate final image count 1-2
3. Upload newly added draft images on save
4. Update `advertisements`
5. Insert new `advertisement_images`
6. Normalize `image_order` to 1, 2

Delete image:

1. Confirm with user
2. Check image is not the last image
3. Delete R2 object
4. Delete `advertisement_images` row
5. Normalize remaining `image_order`

If R2 delete fails, do not delete the database row.

## RLS

- Enable RLS on `advertisements`
- Enable RLS on `advertisement_images`
- Public read on `advertisements` only where `is_active = true`
- Public read on `advertisement_images` only where parent advertisement is active
- Administrator can create, update, delete
- Public users cannot create, update, delete

## States

Loading:

- กำลังโหลดรายการโฆษณา
- กำลังโหลด detail
- กำลังบันทึก
- กำลังลบรูป

Empty:

- ยังไม่มีโฆษณา
- ยังไม่ได้เลือกรูป

Error:

- ไม่มีสิทธิ์เข้าใช้งาน
- โหลดข้อมูลไม่สำเร็จ
- title ว่าง
- ไม่มีรูป
- รูปเกิน 2 รูป
- ลบรูปสุดท้ายไม่ได้
- upload รูปไม่สำเร็จ
- ลบ R2 object ไม่สำเร็จ
- รูป preview/load ไม่ได้

## Testing Checklist

- Administrator เข้าใช้งานได้
- non-admin เข้าใช้งานไม่ได้
- list แสดง active ก่อน inactive
- list เรียง `updated_at` ใหม่สุดก่อนในกลุ่มเดียวกัน
- create ต้องมี title
- create ต้องมีรูปอย่างน้อย 1 รูป
- create ห้ามเกิน 2 รูป
- เพิ่มรูปยังไม่ upload จนกดบันทึก
- preview รูป draft ได้
- preview รูปเดิมได้
- delete image ต้อง confirm
- delete image ลบทันทีหลัง confirm
- delete image บล็อกเมื่อเป็นรูปสุดท้าย
- ระบบ normalize `image_order` เป็น 1, 2
- public Supabase API เห็นเฉพาะ active advertisements
- public Supabase API ไม่เห็น inactive advertisement images
- ไม่มี R2 credential หรือ private token หลุดไป client
