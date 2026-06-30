# Advertisement Management

ระบบจัดการโฆษณาและรูปภาพโฆษณาสำหรับผู้ใช้ฝั่ง admin เท่านั้น

`webook` เป็นระบบจัดการ metadata และรูป ไม่ใช่หน้า public สำหรับแสดงโฆษณา ระบบอื่นจะอ่านข้อมูลผ่าน Supabase API แล้วนำ `image_name` ไปต่อ Cloudflare Worker URL เอง

ผู้ใช้ที่มีสิทธิ์:

- Administrator

## MVP Documents

- [MVP 1: Advertisement Image Management](advertisement-management/mvp-1-advertisement-image-management.md)

## Project Constraints

Current advertisement image storage contract:

- New uploads store filename-only `advertisement_images.image_name` values using `YYYYMMDDHHmmss_random10.ext`, for example `20260109220657_60b5a9a545.webp`.
- The server composes R2 object keys as `advertisements/{advertisement_id}/{image_name}`.
- External systems must compose display URLs with the advertisement id, not by appending `image_name` directly to the Worker URL.
- Create mode creates the advertisement first, then uploads selected draft images through the same client queue using the returned advertisement id. If any image upload fails, failed cards remain visible and can be retried.
- Edit mode uses operation-based image management: selected files upload immediately through a client queue, one file per request, and title/status changes are saved separately.
- Advertisement uploads reject GIF, resize client-side to WebP with max long edge 1920px and quality 0.82, and keep failed uploads as muted retryable cards.
- Single image delete requires confirmation. Bulk delete uses a client-side per-image delete queue with per-row status, final toast summary, and retry for failed rows.
- Advertisement images have no minimum count requirement; an advertisement may have 0-2 images.

- อ่านและใช้ pattern ที่มีอยู่ในโปรเจกต์ก่อนเพิ่ม abstraction ใหม่
- ถ้า dependency ใหม่ช่วยให้ maintain ง่ายขึ้น reuse ได้ดีขึ้น secure ขึ้น performance ดีขึ้น หรือ implementation ชัดขึ้น ให้เสนอพร้อมเหตุผลและคำสั่งติดตั้งก่อน
- ก่อนทำ UI flow หรือ screen structure ต้องถามก่อนว่ามี design/flow อยู่แล้วหรือไม่ และคุยทีละขั้นก่อน implement
- UI ต้องออกแบบแบบ mobile-first และรองรับ mobile, tablet, laptop, desktop
- ใช้ Supabase Auth และ admin authorization เดิม
- Admin pages ต้องตรวจสิทธิ์ผ่าน server-side auth
- ห้าม expose Supabase service role, R2 credential, Worker secret หรือ private token ไป client
- รูปเก็บใน Cloudflare R2 ผ่าน Worker/storage adapter
- ใช้ shared media bucket/worker:
  - R2 bucket: `webook-media`
  - Worker name: `webook-media`
  - Advertisement image prefix: `advertisements/`
- Supabase เก็บ `image_name` เป็น source of truth ไม่เก็บ full image URL
- ระบบอื่นอ่านผ่าน Supabase API ได้เฉพาะ `is_active = true`
- `webook` ไม่มี public/customer advertisement page

## Role Decisions

- MVP 1 อนุญาตเฉพาะ `role_id = 1` (Administrator)
- Public/Supabase API อ่านได้เฉพาะ active advertisements
- Public/Supabase API ไม่มีสิทธิ์ insert, update, delete
