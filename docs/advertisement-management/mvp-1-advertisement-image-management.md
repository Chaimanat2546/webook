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
- สร้างโฆษณาใหม่พร้อม title และรูป 0-2 รูป
- แก้ไข title
- เปิด/ปิด `is_active`
- หน้า create เพิ่มรูปใหม่เป็น draft; ตอนกดสร้างให้สร้าง `advertisements` ก่อน แล้ว client ใช้ id ที่ได้มา upload รูปผ่าน queue ทีละไฟล์
- หน้า edit เพิ่มรูปใหม่แบบ upload ทันทีผ่าน queue ทีละไฟล์
- หน้า edit ลบรูปจริงหลัง confirmation โดยใช้ single delete action หรือ bulk delete queue ทีละรูป
- validate จำนวนรูปสุดท้ายตอนกดบันทึก
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
- Database trigger เพื่อบังคับ image count business rule

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
- แบ่งหน้าแบบ numbered pagination หน้า `/admin/houses` โดยแสดง 8 รายการต่อหน้า และรักษา query `q` ระหว่างเปลี่ยนหน้า
- เรียง active ก่อน inactive
- เรียง `updated_at` ใหม่สุดก่อนภายในกลุ่มเดียวกัน
- มีปุ่มสร้างโฆษณาใหม่

### `/admin/advertisements/new`

ใช้สำหรับสร้างโฆษณาใหม่

ข้อมูลที่กรอก:

- `title`
- รูป 0-2 รูป

Rules:

- ต้องมี title
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

- เพิ่มรูปใหม่แล้ว upload ทันทีผ่าน client queue ทีละไฟล์
- กดบันทึกใช้สำหรับ update metadata เช่น title และ `is_active`
- ลบรูปเดิมต้องเปิด confirmation ก่อน แล้วค่อยเรียก delete action
- bulk delete ใช้ delete queue ฝั่ง client ทีละรูปพร้อมสถานะ `รอลบ`, `กำลังลบ`, `ลบแล้ว`, `ลบไม่สำเร็จ`
- ถ้าจำนวนรูปจะเกิน 2 รูป ต้อง block operation และแจ้ง error
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

- โฆษณา 1 รายการมีรูปได้ 0-2 รูป
- MVP นี้บังคับ maximum-two-images ใน admin service/route handler ไม่ใช้ database trigger

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

Current R2 storage contract:

- Supabase stores filename-only `advertisement_images.image_name` values, not full paths or URLs.
- New `image_name` values use `YYYYMMDDHHmmss_random10.ext`, for example `20260109220657_60b5a9a545.webp`.
- The server composes R2 object keys as `advertisements/{advertisement_id}/{image_name}`.
- Worker URLs are built as `{ADVERTISEMENT_IMAGE_WORKER_URL}/advertisements/{advertisement_id}/{image_name}`.
- Clients and public readers must not treat `image_name` alone as a full object key.

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
- Max upload size is 10 MB per image.
- Newly selected images are resized in the browser so the longest side is at most 1920px while preserving aspect ratio.
- Newly selected images are encoded from canvas as WebP with quality 0.82 before upload.
- GIF is not supported for advertisement image upload.
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
2. Validate image count 0-2
3. Generate advertisement id
4. Insert `advertisements`
5. Client uploads selected draft images one file at a time with the returned advertisement id
6. Each successful upload inserts `advertisement_images`
7. If an image row write fails during queue upload, best-effort delete the newly uploaded R2 object

Update:

1. Validate title
2. Update `advertisements`
3. Image uploads and deletes are handled by separate operation actions in edit mode

Upload image in edit form:

1. Select one or more files
2. Client resizes each file to WebP
3. Client uploads one file at a time with `uploadAdvertisementImagesAction`
4. Successful files are saved immediately
5. Failed files stay as muted cards with retry/remove actions

Delete image in edit form:

1. Click the trash icon and confirm from the preview dialog
2. The dialog closes and progress/result is shown through toast
3. Bulk delete opens a queue panel and calls `deleteAdvertisementImageAction(imageId)` one image at a time
4. Failed bulk rows stay visible and can be retried
5. Block deletion when it would leave the advertisement with 0 images

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
- กำลังบันทึกการลบรูป

Empty:

- ยังไม่มีโฆษณา
- ยังไม่ได้เลือกรูป

Error:

- ไม่มีสิทธิ์เข้าใช้งาน
- โหลดข้อมูลไม่สำเร็จ
- title ว่าง
- รูปเกิน 2 รูป
- จำนวนรูปสุดท้ายเกิน 2 รูป
- upload รูปไม่สำเร็จ
- ลบ R2 object ไม่สำเร็จ
- รูป preview/load ไม่ได้

## Testing Checklist

- newly selected files append to existing unsaved draft images instead of replacing them
- new uploads store filename-only `image_name` values and server-side R2 keys under `advertisements/{advertisement_id}/{image_name}`
- newly selected advertisement images are resized to max 1920px and encoded as WebP before upload
- GIF upload is rejected
- Administrator เข้าใช้งานได้
- non-admin เข้าใช้งานไม่ได้
- list แสดง active ก่อน inactive
- list เรียง `updated_at` ใหม่สุดก่อนในกลุ่มเดียวกัน
- create ต้องมี title
- create มีรูปได้ 0-2 รูป
- create ห้ามเกิน 2 รูป
- create เพิ่มรูปยังไม่ upload จนกดสร้าง จากนั้น client upload ทีละไฟล์หลังได้ advertisement id
- edit เพิ่มรูปแล้ว upload ทันทีผ่าน queue
- preview รูป draft ได้
- preview รูปเดิมได้
- edit delete image ต้อง confirm แล้วลบจริงผ่าน operation action
- bulk delete แสดงสถานะรายรูป, progress, summary toast, และ retry เฉพาะรายการที่ลบไม่สำเร็จ
- ปุ่มยกเลิก enabled เมื่อมี draft change
- save บล็อกเมื่อจำนวนรูปสุดท้ายเกิน 2 รูป
- ระบบ normalize `image_order` เป็น 1, 2
- public Supabase API เห็นเฉพาะ active advertisements
- public Supabase API ไม่เห็น inactive advertisement images
- ไม่มี R2 credential หรือ private token หลุดไป client
