# Pool Villa Image Management

ระบบจัดการรูปภาพบ้านพักพูลวิลล่าสำหรับผู้ใช้ฝั่ง admin เท่านั้น

ผู้ใช้ที่มีสิทธิ์:

- Administrator
- Operator

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
- ห้าม expose Bearer token หรือ credential ไป client
- ห้ามสร้าง open image proxy
- ห้ามเดา external provider endpoint เอง
- ถ้าต้องเพิ่ม env, dependency, schema หรือ provider config ใหม่ ต้องอธิบายเหตุผลก่อน

## Open Questions

- role ของ Administrator/Operator อ่านจาก Supabase Auth metadata, profile table, custom claims หรือ RLS
- route `/admin/houses/[houseId]/images` ใช้ `listings.id` หรือ `property_id` เป็น identity หลัก
- cover ควรเก็บผ่าน `image_zone = cover` ต่อไป หรือควรมี field แยกใน phase หลัง
