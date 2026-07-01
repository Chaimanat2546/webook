# MVP 4: Add and Delete Image Records

## Goal

เพิ่มความสามารถในการเพิ่มรูปและลบรูปในระดับ database record

MVP นี้ต้องเริ่มจัดการ validation จริงจังขึ้น แต่ยังไม่จำเป็นต้องเชื่อม delete ไฟล์จริงจนกว่าจะยืนยัน external provider behavior ชัดเจน

## In Scope

- เพิ่มรูปจาก `image_name` หรือ URL ตามที่ project รองรับ
- validate extension
- validate duplicate
- validate `https` เมื่อใช้ URL
- เพิ่ม record ใน `images`
- ลบ record ใน `images`
- ถ้าการลบเกี่ยวข้องกับไฟล์จริง ต้องมี confirmation ก่อน
- ถ้าลบ cover แล้วยังมีรูปอื่น ต้องเลือก cover ใหม่ก่อน save

## Storage Boundary

Current R2 upload contract:

- New uploads store filename-only `images.image_name` values using `YYYYMMDDHHmmss_random10.ext`, for example `20260222205910_63fe3bcbc8.webp`.
- The server composes the R2 object key as `houses/{property_id}/{image_name}`.
- New house image rows store the full Worker URL in `images.image_url` for R2 display/provider detection.
- New house image rows assign `image_move` from the selected `image_zone` only; order is scoped to `property_id + image_zone`.
- Clients must not submit R2 paths such as `houses/{property_id}/...`.
- Multi-file selection is allowed, but the client processes files through an internal upload queue and shows in-progress status through toast notifications.
- Each queued file is resized/compressed to WebP before upload.
- The MVP sends one resized file per upload request.
- GIF files are rejected and are not part of the supported house image upload formats.

- MVP นี้ใช้ operation-based UI: เลือกรูปแล้วอัปโหลดทันทีผ่าน toast progress; single delete เปิด confirmation แล้วปิด dialog หลัง confirm พร้อม toast progress; bulk delete selection ใช้การคลิก image card เพื่อเลือก แล้ว confirmation แสดง delete queue รายรูปพร้อมสถานะ `รอลบ`, `กำลังลบ`, `ลบแล้ว`, `ลบไม่สำเร็จ`, progress และ retry สำหรับรายการที่ fail
- Bulk delete queue must call `deleteHouseImageAction(imageId)` one image at a time from the client; do not call one bulk server action when the UI needs per-image progress.
- Upload is exposed as the far-right action in the selected-zone header, while the image count remains in the left detail text; do not use a full-width upload drop zone.
- Zone navigation is a setup menu, not a gallery-only filter: show all configured zones in order (`cover`, `outside`, `parking`, `inside`, `kitchen`, `bedroom`, `bathroom`, `review`) even when empty, and show only image counts instead of zone order ranges.
- รูปใหม่ upload ไป Cloudflare R2 แล้วเพิ่ม record ใน `images`; รูปที่อัปโหลดไม่สำเร็จจะแสดงเป็นการ์ดสีเทาแบบยังไม่ถูกบันทึกใน grid ของโซนปัจจุบัน พร้อม summary, retry, และ remove
- record ใหม่ที่ผูกกับไฟล์จริงต้องใช้ Cloudflare R2 เป็น writable provider เท่านั้น
- AWS/S3-backed images เป็น legacy สำหรับ create/replace ยังใช้แสดงผลได้ และลบได้ผ่าน Lambda URL เดิมหลัง confirmation แต่ห้ามสร้างหรือแก้ไฟล์จริงบน AWS/S3
- ใช้ `images.image_url` เป็น discriminator ฝั่ง server สำหรับแยก AWS/S3 legacy กับ R2 ห้ามรับ provider จาก client และห้ามเพิ่ม provider column ใหม่
- AWS/S3 physical delete เปิดใช้ผ่าน delete API/behavior ที่อนุมัติแล้ว; failure ใช้ cleanup warning/failed queue เดิม

## Out of Scope

- ลบไฟล์จริงโดยไม่มี confirmation
- สร้าง open image proxy
- เพิ่ม provider config ใหม่โดยไม่มีเหตุผล
- advanced upload beyond one-at-a-time queue processing
- image optimization beyond the required 1920px WebP resize policy

## Rules

- `image_name` เป็น source of truth
- `image_url` ไม่ใช่ source of truth
- ห้ามเพิ่มรูปซ้ำในบ้านเดียวกัน
- ถ้าบ้านมีรูป ต้องมี cover เพียง 1 รูป
- Delete ต้องมี confirmation ถ้าเกี่ยวข้องกับไฟล์จริง
- ถ้าผู้ใช้ cancel confirmation ห้ามลบ record และห้ามลบไฟล์
- file create/replace/edit สำหรับรูปใหม่ต้องเป็น Cloudflare R2 เท่านั้นเมื่อเข้าสู่ MVP 5
- AWS/S3 อนุญาตเฉพาะ delete physical file ผ่าน server adapter; upload/replace/edit ยังถูกปฏิเสธ

## Testing Checklist

- New upload stores filename-only `images.image_name` and R2 object key `houses/{property_id}/{image_name}`.
- New upload into a zone with existing `#1` becomes `#2` even if another zone already has a higher `image_move`.
- เพิ่มรูปได้
- เพิ่มรูปซ้ำไม่ได้
- extension ที่ไม่รองรับถูกปฏิเสธ
- URL ที่ไม่ใช่ `https` ถูกปฏิเสธ
- ลบรูป R2 ได้หลัง confirmation
- bulk delete แสดงสถานะรายรูป, progress, summary toast, และ retry เฉพาะรายการที่ลบไม่สำเร็จ
- cancel confirmation แล้วไม่ลบ
- ลบ cover แล้วต้องเลือก cover ใหม่ก่อน save
- operation ที่พยายามสร้าง แก้ หรือ replace ไฟล์จริงบน AWS/S3 ต้องถูกปฏิเสธ; delete ต้องผ่าน confirmation
- รูปใหม่ใช้ key prefix `houses/{property_id}/...` และเก็บ full Worker URL ใน `images.image_url`
- หลังเพิ่ม/ลบแล้วข้อมูล reload ถูกต้อง
