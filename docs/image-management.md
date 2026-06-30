# Pool Villa Image Management

ระบบจัดการรูปภาพบ้านพักพูลวิลล่าสำหรับผู้ใช้ฝั่ง admin เท่านั้น

ผู้ใช้ที่มีสิทธิ์:

- ผู้ใช้ที่มี `public.users.allow_tools.allow_accommodation = true`

MVP 1 ใช้สิทธิ์รายหมวดจาก `allow_tools` เป็นหลัก โดยหมวดบ้านพักต้องเปิด `allow_accommodation = true`

ไม่รวม public gallery, SEO, booking, pricing หรือระบบจัดการข้อมูลบ้านพักแบบเต็มรูปแบบ

## MVP Documents

- [MVP 1: Read-only Image Display](image-management/mvp-1-read-only-image-display.md)
- [MVP 2: Draft UI Interaction](image-management/mvp-2-draft-ui-interaction.md)
- [MVP 3: Save Image Metadata](image-management/mvp-3-save-image-metadata.md)
- [MVP 4: Add and Delete Image Records](image-management/mvp-4-add-delete-image-records.md)
- [MVP 5: External Provider and Physical File CRUD](image-management/mvp-5-external-provider-file-crud.md)

## Current Admin Flow

- `/admin/houses/[propertyId]/images` is a zone-scoped image manager. The `zone` query value controls the current image zone.
- The zone menu always shows the configured setup zones in this order, even when a zone has no images: รูปปก, ภายนอก, ที่จอดรถ, ภายใน, ห้องครัว, ห้องนอน, ห้องน้ำ, รีวิว. Zone menu items show only the image count, and empty zones render an in-grid empty state.
- Uploading files starts immediately after the admin chooses files. There is no staged house-image draft and no save button for uploads.
- Single delete is explicit: R2-backed images show a delete control, clicking it opens a confirmation dialog with the image preview, and confirming deletes that one image.
- Bulk delete uses a selection mode in the current zone only. `Select all` selects only deletable images visible in the current zone, admins can click image cards to toggle individual selections, then confirm deletion from a larger delete queue preview.
- AWS/S3-backed legacy images can be viewed and deleted after confirmation when `image_url` identifies the AWS/S3 provider. AWS/S3 upload and replace remain disabled.
- AWS/S3 delete sends signed server-side S3 `DELETE` requests using `AWS_REGION`, `AWS_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`, then deletes the database row only after signed S3 `HEAD` verifies the object is gone.
- AWS/S3 delete errors include provider status diagnostics such as `DELETE 403` or `verify HEAD 200 image/webp` without exposing AWS credentials.
- Storage delete treats provider 404/410 responses as already deleted, so stale database rows can still be cleaned up.
- Single delete confirmation dialogs close immediately after confirm, then in-progress/success/warning/error feedback is shown through toast notifications. Bulk delete keeps the queue visible while deleting so the admin can see per-image status and retry failed rows.
- Bulk delete is controlled by the client one image at a time with `deleteHouseImageAction(imageId)`. Do not call one bulk server action for the progress UI, because the client would only know start/end instead of per-image progress.
- House image upload uses a client-side queue internally, but in-progress feedback is shown through toast notifications instead of a persistent queue panel.
- GIF is not supported for house image upload.
- Selected files are resized to WebP before upload.
- Resize target: max long edge 1920px, WebP quality 0.82.
- Upload requests are sent one file at a time in the MVP to avoid large combined request bodies.
- Upload uses partial success: successful files stay saved, failed files appear as muted, unsaved cards in the current zone grid with a failed-upload summary and retry/remove actions.

## Project Constraints

- อ่านและใช้ pattern ที่มีอยู่ในโปรเจกต์ก่อนเพิ่ม abstraction ใหม่
- ถ้า dependency ใหม่ช่วยให้ maintain ง่ายขึ้น reuse ได้ดีขึ้น secure ขึ้น performance ดีขึ้น หรือ implementation ชัดขึ้น ให้เสนอพร้อมเหตุผลและคำสั่งติดตั้งก่อน
- ก่อนทำ UI flow หรือ screen structure ต้องถามก่อนว่ามี design/flow อยู่แล้วหรือไม่ และคุยทีละขั้นก่อน implement
- UI ต้องออกแบบแบบ mobile-first และรองรับ mobile, tablet, laptop, desktop
- UI ต้องออกแบบให้ implement ด้วย Tailwind และ shadcn/ui ได้ง่าย ไม่ใช้ custom widget ซับซ้อนถ้าไม่จำเป็น
- Admin navigation ต้องรองรับเมนูที่เพิ่มในอนาคต: desktop ใช้ sidebar, mobile ใช้ top bar พร้อม hamburger/sheet menu
- หน้า `/admin/houses` เป็น house selector สำหรับเข้าหน้าจัดการรูปเท่านั้น และไม่แสดง cover image, thumbnail หรือ gallery preview
- ห้าม expose Bearer token หรือ credential ไป client
- ห้ามสร้าง open image proxy
- ห้ามเดา external provider endpoint เอง
- ถ้าต้องเพิ่ม env, dependency, schema หรือ provider config ใหม่ ต้องอธิบายเหตุผลก่อน

## Storage Provider Policy

- รูปบ้านพักเดิมที่ import/แสดงผลผ่าน AWS/S3-backed source ยังถือว่าถูกต้องและใช้แสดงผลต่อได้
- รูปบ้านพักใหม่ หรือรูปที่ต้องสร้าง/แทนที่/แก้ไฟล์จริงผ่าน admin tool ต้องเก็บและจัดการบน Cloudflare R2 เท่านั้น
- Cloudflare R2 เป็น provider เดียวที่อนุญาตให้ทำ file operations แบบ create, replace/edit, และ delete สำหรับรูปที่ระบบนี้จัดการใหม่
- AWS/S3-backed images เป็น legacy สำหรับ create/replace: ยังใช้แสดงผลได้ และลบได้ผ่าน Lambda URL เดิมหลัง confirmation แต่ยังห้าม upload, replace, หรือ edit ไฟล์จริงบน AWS/S3
- ห้ามเพิ่ม provider column ใหม่ ให้ใช้ `images.image_url` เป็น discriminator สำหรับแยก AWS/S3 legacy กับ Cloudflare R2
- Database metadata และ physical file operations ต้องแยกกันชัดเจน service ต้อง route operation จาก `image_url` ที่ server เชื่อถือได้ และต้อง fail closed เมื่อ provider ไม่รองรับ operation นั้น

## Role Decisions

- MVP 1 หมวดบ้านพักอิงสิทธิ์จาก `public.users.allow_tools.allow_accommodation = true`
- การเพิ่มรูปบ้านพักต้องมี `mid > 0` เพื่อใช้เป็นค่า legacy `images.create_by`
- `role_id` ไม่ใช่ตัวตัดสินสิทธิ์ของ flow จัดการรูปบ้านพักใน MVP นี้
- การเพิ่มรูปบ้านพักใช้ `public.users.mid` เป็นค่า legacy `images.create_by`
- route `/admin/houses/[houseId]/images` ใช้ `listings.id` หรือ `property_id` เป็น identity หลัก
- cover ควรเก็บผ่าน `image_zone = cover` ต่อไป หรือควรมี field แยกใน phase หลัง
