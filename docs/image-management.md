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
- AWS/S3-backed images เป็น legacy/display-only ชั่วคราว: ยังใช้แสดงผลได้ แต่ห้าม upload, replace, edit, หรือ delete ไฟล์จริงบน AWS/S3 จนกว่าจะอนุมัติ delete endpoint และ failure behavior ชัดเจน
- ห้ามเพิ่ม provider column ใหม่ ให้ใช้ `images.image_url` เป็น discriminator สำหรับแยก AWS/S3 legacy กับ Cloudflare R2
- Database metadata และ physical file operations ต้องแยกกันชัดเจน service ต้อง route operation จาก `image_url` ที่ server เชื่อถือได้ และต้อง fail closed เมื่อ provider ไม่รองรับ operation นั้น

## Role Decisions

- MVP 1 หมวดบ้านพักอิงสิทธิ์จาก `public.users.allow_tools.allow_accommodation = true`
- การเพิ่มรูปบ้านพักต้องมี `mid > 0` เพื่อใช้เป็นค่า legacy `images.create_by`
- `role_id` ไม่ใช่ตัวตัดสินสิทธิ์ของ flow จัดการรูปบ้านพักใน MVP นี้
- การเพิ่มรูปบ้านพักใช้ `public.users.mid` เป็นค่า legacy `images.create_by`
- route `/admin/houses/[houseId]/images` ใช้ `listings.id` หรือ `property_id` เป็น identity หลัก
- cover ควรเก็บผ่าน `image_zone = cover` ต่อไป หรือควรมี field แยกใน phase หลัง
